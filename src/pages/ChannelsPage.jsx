import React, { useState, useCallback, useEffect, useMemo } from 'react';

const fmtSats = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString();
};

const shortChan = (id) => {
    if (!id) return '—';
    const s = String(id);
    return s.length > 10 ? `…${s.slice(-8)}` : s;
};

const ChannelsPage = ({ lnc, darkMode, nodeChannels = [], onRefreshChannels, nodeInfo }) => {
    // Derive our own pubkey from nodeInfo (returned by getInfo)
    const myPubkey = String(nodeInfo?.identityPubkey || nodeInfo?.identity_pubkey || '').toLowerCase();

    // Build a set of pubkeys we have direct channels with (our peers)
    const ourPeerPubkeys = useMemo(() => {
        const s = new Set();
        nodeChannels.forEach(ch => {
            const pk = String(ch.remotePubkey || ch.remote_pubkey || '').toLowerCase();
            if (pk) s.add(pk);
        });
        return s;
    }, [nodeChannels]);
    const [chanAliasMap, setChanAliasMap] = useState({});
    const [chanInfoMap, setChanInfoMap] = useState({}); // chanId => { node1_pub, node2_pub, node1_policy, node2_policy }
    const [forwards, setForwards] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [feeModalOpen, setFeeModalOpen] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [peerFeeStats, setPeerFeeStats] = useState(null);
    const [peerOutFeeStats, setPeerOutFeeStats] = useState(null);
    const [peerFeeSeries, setPeerFeeSeries] = useState({ incoming: [], outgoing: [] });
    const [inboundZoom, setInboundZoom] = useState(null);
    const [outboundZoom, setOutboundZoom] = useState(null);
    const [peerFeeLoading, setPeerFeeLoading] = useState(false);
    const [peerFeeError, setPeerFeeError] = useState(null);
    const [peerChannels, setPeerChannels] = useState([]);
    const [peerChannelAliases, setPeerChannelAliases] = useState({});
    const [peerChanSort, setPeerChanSort] = useState({ col: 'capacity', dir: 'desc' });

    // 1. Fetch channel aliases
    useEffect(() => {
        if (!lnc?.lnd?.lightning || !nodeChannels.length) return;

        const chanMap = {};
        nodeChannels.forEach((ch) => {
            const id = String(ch.chanId || ch.chan_id || '');
            const pubkey = ch.remotePubkey || ch.remote_pubkey || '';
            if (id && pubkey) chanMap[id] = { remotePubkey: pubkey, alias: '' };
        });

        const uniquePubkeys = [...new Set(Object.values(chanMap).map((v) => v.remotePubkey).filter(Boolean))];

        Promise.allSettled(
            uniquePubkeys.map((pk) =>
                lnc.lnd.lightning
                    .getNodeInfo({ pub_key: pk, include_channels: false })
                    .then((info) => ({ pk, alias: info?.node?.alias || '' }))
                    .catch(() => ({ pk, alias: '' }))
            )
        ).then((results) => {
            const pubkeyAlias = {};
            results.forEach((r) => {
                if (r.status === 'fulfilled') pubkeyAlias[r.value.pk] = r.value.alias;
            });
            Object.values(chanMap).forEach((entry) => {
                entry.alias = pubkeyAlias[entry.remotePubkey] || '';
            });
            setChanAliasMap({ ...chanMap });
        });

        // Fetch channel policies
        const fetchChanInfos = async () => {
            const infoMap = {};
            const promises = nodeChannels.map(async (ch) => {
                const id = String(ch.chanId || ch.chan_id || '');
                if (!id) return;
                try {
                    const info = await lnc.lnd.lightning.getChanInfo({ chan_id: id });
                    infoMap[id] = info;
                } catch (e) {
                    // channel might be closed or not fully gossiped yet
                }
            });
            await Promise.allSettled(promises);
            setChanInfoMap(infoMap);
        };
        fetchChanInfos();

    }, [lnc, nodeChannels]);

    const fetchAllForwards = useCallback(async () => {
        if (!lnc?.lnd?.lightning) return;
        setIsLoading(true);
        try {
            const response = await lnc.lnd.lightning.forwardingHistory({
                start_time: '0',
                end_time: Math.floor(Date.now() / 1000).toString(),
                num_max_events: 50000,
            });
            const events = Array.isArray(response?.forwardingEvents) ? response.forwardingEvents : [];
            setForwards(events);
        } catch (err) {
            console.error('Failed to fetch forwards for channels page:', err);
            setError(err.message || 'Failed to load forwarding history.');
        } finally {
            setIsLoading(false);
        }
    }, [lnc]);

    useEffect(() => {
        fetchAllForwards();
    }, [fetchAllForwards]);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const handleRefresh = async () => {
        if (isRefreshing) return;
        console.log('Refreshing channels page data...');
        setIsRefreshing(true);
        try {
            await Promise.race([
                Promise.all([
                    onRefreshChannels ? onRefreshChannels() : Promise.resolve(),
                    fetchAllForwards()
                ]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), 10000))
            ]);
        } catch (e) {
            console.warn("Channels refresh error/timeout:", e);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // 3. Compute stats per channel
    // We separate fees generated when this channel was the INCOMING leg vs OUTGOING leg
    const channelStats = useMemo(() => {
        const stats = new Map(); // chanId => { feeOutSats: 0, feeOutMsat: 0, feeInSats: 0, feeInMsat: 0, fwdsOut: 0, fwdsIn: 0 }

        forwards.forEach(f => {
            const chanIn = String(f.chan_id_in || f.chanIdIn || '');
            const chanOut = String(f.chan_id_out || f.chanIdOut || '');
            const feeSats = Number(f.fee || 0);
            const feeMsat = Number(f.fee_msat || f.feeMsat || 0);

            if (!stats.has(chanIn)) stats.set(chanIn, { feeOutSats: 0, feeOutMsat: 0, feeInSats: 0, feeInMsat: 0, fwdsOut: 0, fwdsIn: 0 });
            if (!stats.has(chanOut)) stats.set(chanOut, { feeOutSats: 0, feeOutMsat: 0, feeInSats: 0, feeInMsat: 0, fwdsOut: 0, fwdsIn: 0 });

            const inStats = stats.get(chanIn);
            inStats.fwdsIn++;
            // When a route comes IN through this channel, it *earns* the routing fee for the node
            // (technically the fee is charged on the OUTGOING channel, but we attribute it to both for analysis if desired,
            // however standard LND accounting attributes the fee earned to the OUTGOING channel policy).
            inStats.feeInSats += feeSats;
            inStats.feeInMsat += feeMsat;

            const outStats = stats.get(chanOut);
            outStats.fwdsOut++;
            outStats.feeOutSats += feeSats;
            outStats.feeOutMsat += feeMsat;
        });

        return stats;
    }, [forwards]);

    const chanLabel = (chanId) => {
        const entry = chanAliasMap[String(chanId)];
        if (entry?.alias) return entry.alias;
        return shortChan(chanId);
    };

    const getFeeRatePpm = (pol) => {
        if (!pol) return null;
        const raw =
            pol.feeRateMilliMsat !== undefined ? pol.feeRateMilliMsat :
                pol.fee_rate_milli_msat !== undefined ? pol.fee_rate_milli_msat :
                    null;
        const num = Number(raw);
        return Number.isFinite(num) ? num : null;
    };

    const computeStats = (values, weights = []) => {
        const pairs = values
            .map((v, i) => ({ v: Number(v), w: Number(weights[i]) }))
            .filter((p) => Number.isFinite(p.v));
        if (pairs.length === 0) return null;

        const nums = pairs.map((p) => p.v);
        const sorted = [...nums].sort((a, b) => a - b);
        const n = sorted.length;
        const sum = nums.reduce((s, v) => s + v, 0);
        const avg = sum / n;
        const variance = nums.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / n;
        const std = Math.sqrt(variance);
        const min = sorted[0];
        const max = sorted[n - 1];
        const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

        const correctedValues = nums.filter((v) => v > 0);
        const correctedAvg = correctedValues.length
            ? correctedValues.reduce((s, v) => s + v, 0) / correctedValues.length
            : avg;

        const weightedPairs = pairs.filter((p) => Number.isFinite(p.w) && p.w > 0);
        const weightedSum = weightedPairs.reduce((s, p) => s + p.v * p.w, 0);
        const totalWeight = weightedPairs.reduce((s, p) => s + p.w, 0);
        const weightedAvg = totalWeight > 0 ? weightedSum / totalWeight : avg;

        return { avg, std, min, max, median, correctedAvg, weightedAvg };
    };

    useEffect(() => {
        if (!feeModalOpen || !selectedChannel?.peerPubkey || !lnc?.lnd?.lightning) return;
        let isMounted = true;
        const fetchPeerFees = async () => {
            setPeerFeeLoading(true);
            setPeerFeeError(null);
            setPeerChannels([]);
            setPeerChannelAliases({});
            try {
                const info = await lnc.lnd.lightning.getNodeInfo({
                    pub_key: selectedChannel.peerPubkey,
                    include_channels: true,
                });

                const channels = info?.channels || info?.node?.channels || [];
                const peerKey = selectedChannel.peerPubkey.toLowerCase();
                const incomingFees = [];
                const incomingWeights = [];
                const outgoingFees = [];
                const outgoingWeights = [];

                // Build annotated channel list for the peer channels table
                const annotatedChannels = [];

                channels.forEach((ch) => {
                    const n1 = String(ch.node1_pub || ch.node1Pub || '').toLowerCase();
                    const n2 = String(ch.node2_pub || ch.node2Pub || '').toLowerCase();
                    const n1pol = ch.node1_policy || ch.node1Policy;
                    const n2pol = ch.node2_policy || ch.node2Policy;
                    const cap = Number(ch.capacity || 0);

                    // Determine which pub is the peer and which is the "other" node
                    const isPeerNode1 = n1 === peerKey;
                    const otherPub = isPeerNode1 ? (ch.node2_pub || ch.node2Pub || '') : (ch.node1_pub || ch.node1Pub || '');
                    const peerPolicy = isPeerNode1 ? n1pol : n2pol; // fee peer charges outbound
                    const otherPolicy = isPeerNode1 ? n2pol : n1pol; // fee other node charges outbound (= inbound to peer)

                    annotatedChannels.push({
                        chanId: String(ch.chan_id || ch.chanId || ''),
                        capacity: cap,
                        otherPub: String(otherPub).toLowerCase(),
                        peerFeeRate: getFeeRatePpm(peerPolicy),   // peer → other (peer's outbound fee)
                        otherFeeRate: getFeeRatePpm(otherPolicy),  // other → peer (other's outbound fee)
                        peerBaseFee: Number(peerPolicy?.feeBaseMsat ?? peerPolicy?.fee_base_msat ?? 0),
                        otherBaseFee: Number(otherPolicy?.feeBaseMsat ?? otherPolicy?.fee_base_msat ?? 0),
                        active: ch.active,
                    });

                    if (isPeerNode1) {
                        const fee = getFeeRatePpm(n2pol);
                        if (fee !== null) { incomingFees.push(fee); incomingWeights.push(cap); }
                        const outFee = getFeeRatePpm(n1pol);
                        if (outFee !== null) { outgoingFees.push(outFee); outgoingWeights.push(cap); }
                    } else {
                        const fee = getFeeRatePpm(n1pol);
                        if (fee !== null) { incomingFees.push(fee); incomingWeights.push(cap); }
                        const outFee = getFeeRatePpm(n2pol);
                        if (outFee !== null) { outgoingFees.push(outFee); outgoingWeights.push(cap); }
                    }
                });

                const statsIn = computeStats(incomingFees, incomingWeights);
                const statsOut = computeStats(outgoingFees, outgoingWeights);
                if (isMounted) {
                    setPeerFeeStats(statsIn);
                    setPeerOutFeeStats(statsOut);
                    setPeerFeeSeries({ incoming: incomingFees, outgoing: outgoingFees });
                    setPeerChannels(annotatedChannels);
                }

                // Batch-resolve aliases for the other-end nodes
                const uniqueOtherPubs = [...new Set(annotatedChannels.map(c => c.otherPub).filter(Boolean))];
                const aliasResults = await Promise.allSettled(
                    uniqueOtherPubs.map(pk =>
                        lnc.lnd.lightning
                            .getNodeInfo({ pub_key: pk, include_channels: false })
                            .then(r => ({ pk, alias: r?.node?.alias || '' }))
                            .catch(() => ({ pk, alias: '' }))
                    )
                );
                if (isMounted) {
                    const aliasMap = {};
                    aliasResults.forEach(r => { if (r.status === 'fulfilled') aliasMap[r.value.pk] = r.value.alias; });
                    setPeerChannelAliases(aliasMap);
                }
            } catch (e) {
                if (isMounted) setPeerFeeError(e?.message || 'Failed to load peer network fee data.');
            } finally {
                if (isMounted) setPeerFeeLoading(false);
            }
        };

        fetchPeerFees();
        return () => {
            isMounted = false;
        };
    }, [feeModalOpen, selectedChannel, lnc]);

    // ── Shared styles ──────────────────────────────────────────────────────────
    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };

    const thStyle = {
        padding: '12px 16px',
        textAlign: 'left',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        whiteSpace: 'nowrap',
    };

    const tdStyle = {
        padding: '12px 16px',
        fontSize: 13,
        color: 'var(--text-primary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        whiteSpace: 'nowrap',
    };

    const totalCapacity = nodeChannels.reduce((sum, ch) => sum + Number(ch.capacity || 0), 0);
    const totalLocal = nodeChannels.reduce((sum, ch) => sum + Number(ch.localBalance || ch.local_balance || 0), 0);
    const totalRemote = nodeChannels.reduce((sum, ch) => sum + Number(ch.remoteBalance || ch.remote_balance || 0), 0);
    const totalFeesSats = Array.from(channelStats.values()).reduce((sum, s) => sum + s.feeOutSats, 0);
    const totalFeesMsat = Array.from(channelStats.values()).reduce((sum, s) => sum + s.feeOutMsat, 0);

    return (
        <div className="p-6 space-y-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Channel Management
                    </h2>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-500/10'
                            }`}
                        style={{ color: 'var(--accent-light)', border: `1px solid var(--accent-light)` }}
                    >
                        <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {nodeChannels.length} active channels
                </div>
            </div>

            {error && (
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-text)' }}>
                    {error}
                </div>
            )}

            {/* Overall Balances Bar */}
            <div className="rounded-xl p-6 transition-colors duration-300" style={cardStyle}>
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-1">Local / Outbound</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalLocal.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>sats</span></p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">Total Capacity</p>
                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{totalCapacity.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>sats</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-1">Remote / Inbound</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalRemote.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>sats</span></p>
                    </div>
                </div>

                {totalCapacity > 0 && (
                    <div className="w-full h-4 rounded-full overflow-hidden flex" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                        <div style={{ width: `${(totalLocal / totalCapacity) * 100}%`, backgroundColor: '#10b981' }} title={`Local: ${(totalLocal / totalCapacity * 100).toFixed(1)}%`} />
                        <div style={{ width: `${(totalRemote / totalCapacity) * 100}%`, backgroundColor: '#f59e0b' }} title={`Remote: ${(totalRemote / totalCapacity * 100).toFixed(1)}%`} />
                    </div>
                )}

                <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Routing Fees Earned:</span>
                    <div className="text-right">
                        <span className="font-bold text-emerald-500">{totalFeesSats.toLocaleString()} sats</span>
                        <span className="text-xs ml-2 text-emerald-500/70">({totalFeesMsat.toLocaleString()} msat)</span>
                    </div>
                </div>
            </div>

            {/* Channels Table */}
            <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                    <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Channel List</h3>
                    {isLoading && <span className="text-xs animate-pulse text-indigo-500">Updating stats...</span>}
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Peer / Channel ID</th>
                                <th style={{ ...thStyle, width: '25%' }}>Liquidity (Local 🟩 / Remote 🟧)</th>
                                <th style={thStyle}>Current Policy (Fee Rate)</th>
                                <th style={thStyle}>Historical Routing Fees</th>
                            </tr>
                        </thead>
                        <tbody>
                            {nodeChannels.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                                        No active channels found.
                                    </td>
                                </tr>
                            ) : (
                                nodeChannels.map((ch, i) => {
                                    const chanId = String(ch.chanId || ch.chan_id || '');
                                    const active = ch.active;
                                    const capacity = Number(ch.capacity || 0);
                                    const local = Number(ch.localBalance || ch.local_balance || 0);
                                    const remote = Number(ch.remoteBalance || ch.remote_balance || 0);
                                    const localPct = capacity > 0 ? (local / capacity) * 100 : 0;
                                    const remotePct = capacity > 0 ? (remote / capacity) * 100 : 0;

                                    const stats = channelStats.get(chanId) || { feeOutSats: 0, feeOutMsat: 0, feeInSats: 0, feeInMsat: 0 };

                                    // Extract policies (handle camelCase or snake_case from LNC)
                                    const cInfo = chanInfoMap[chanId];
                                    let myPolicy = null;
                                    let peerPolicy = null;
                                    if (cInfo) {
                                        const n1pub = String(cInfo.node1_pub || cInfo.node1Pub || '').toLowerCase();
                                        const n1pol = cInfo.node1_policy || cInfo.node1Policy;
                                        const n2pol = cInfo.node2_policy || cInfo.node2Policy;
                                        const peerPub = String(ch.remotePubkey || ch.remote_pubkey || '').toLowerCase();

                                        if (n1pub === peerPub) {
                                            myPolicy = n2pol; // We are node2, peer is node1
                                            peerPolicy = n1pol;
                                        } else {
                                            myPolicy = n1pol; // We are node1, peer is node2
                                            peerPolicy = n2pol;
                                        }
                                    }

                                    const getFeeRate = (pol) => {
                                        if (!pol) return null;
                                        if (pol.feeRateMilliMsat !== undefined) return pol.feeRateMilliMsat;
                                        if (pol.fee_rate_milli_msat !== undefined) return pol.fee_rate_milli_msat;
                                        return '0';
                                    };

                                    const myFeeRate = getFeeRate(myPolicy);
                                    const peerFeeRate = getFeeRate(peerPolicy);

                                    return (
                                        <tr
                                            key={chanId}
                                            style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}
                                            className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setSelectedChannel({
                                                    chanId,
                                                    alias: chanLabel(chanId),
                                                    peerPubkey: String(ch.remotePubkey || ch.remote_pubkey || ''),
                                                    myPolicy,
                                                    peerPolicy,
                                                });
                                                setFeeModalOpen(true);
                                            }}
                                        >
                                            <td style={tdStyle}>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    <span className="text-xs font-semibold">{active ? 'Active' : 'Offline'}</span>
                                                </div>
                                            </td>
                                            <td style={tdStyle} title={chanId}>
                                                <div className="font-bold text-indigo-400">{chanLabel(chanId)}</div>
                                                <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{shortChan(chanId)}</div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div className="flex flex-col gap-1 w-full max-w-xs">
                                                    <div className="flex justify-between text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                                                        <span>{fmtSats(local)}</span>
                                                        <span>{fmtSats(remote)}</span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                                        <div style={{ width: `${localPct}%`, backgroundColor: '#10b981' }} />
                                                        <div style={{ width: `${remotePct}%`, backgroundColor: '#f59e0b' }} />
                                                    </div>
                                                    <div className="text-[10px] text-center mt-0.5 text-gray-500">{fmtSats(capacity)} cap</div>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div className="flex flex-col gap-1 text-xs">
                                                    <div className="flex justify-between items-center gap-4">
                                                        <span className="text-emerald-500 font-semibold" title="Fee you charge for routing OUT of this channel">Outbound:</span>
                                                        <span className="font-mono">{myFeeRate !== null ? `${myFeeRate} ppm` : '—'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center gap-4">
                                                        <span className="text-fuchsia-500 font-semibold" title="Fee peer charges for routing IN to this channel">Inbound:</span>
                                                        <span className="font-mono">{peerFeeRate !== null ? `${peerFeeRate} ppm` : '—'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <div className="flex flex-col gap-1 text-xs text-right font-mono">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <span className="text-emerald-500/70 text-[10px] uppercase">Out:</span>
                                                        <span className="text-emerald-500 font-bold">{stats.feeOutSats > 0 ? `+${fmtSats(stats.feeOutSats)}` : '0'}</span>
                                                        <span className="text-emerald-500/70 text-[10px] min-w-[60px]">{stats.feeOutMsat > 0 ? `${stats.feeOutMsat} msat` : '0 msat'}</span>
                                                    </div>
                                                    <div className="flex justify-end items-center gap-2">
                                                        <span className="text-fuchsia-500/70 text-[10px] uppercase">In:</span>
                                                        <span className="text-fuchsia-400 font-bold">{stats.feeInSats > 0 ? `+${fmtSats(stats.feeInSats)}` : '0'}</span>
                                                        <span className="text-fuchsia-400/70 text-[10px] min-w-[60px]">{stats.feeInMsat > 0 ? `${stats.feeInMsat} msat` : '0 msat'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {feeModalOpen && selectedChannel && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
                    onClick={() => setFeeModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl"
                        style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-widest text-indigo-400">Fee Report</p>
                                <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                                    {selectedChannel.alias}
                                </h3>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    Channel {shortChan(selectedChannel.chanId)} · Peer {shortChan(selectedChannel.peerPubkey)}
                                </p>
                            </div>
                            <button
                                onClick={() => setFeeModalOpen(false)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold"
                                style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}
                            >
                                Close
                            </button>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                            <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Current Fees Snapshot</div>
                            <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                Live channel policies
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="rounded-xl p-4" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                <p className="text-xs uppercase tracking-widest text-emerald-400 mb-3">Peer Fee To You</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {(() => {
                                        const peerFee = getFeeRatePpm(selectedChannel.peerPolicy);
                                        const stats = peerOutFeeStats;
                                        return (
                                            <>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Corrected Avg</div>
                                                    <div className="text-lg font-bold text-emerald-400">{stats ? stats.correctedAvg.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Weighted Avg</div>
                                                    <div className="text-lg font-bold text-emerald-400">{stats ? stats.weightedAvg.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Average</div>
                                                    <div className="text-base font-semibold">{stats ? stats.avg.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Std Dev</div>
                                                    <div className="text-base font-semibold">{stats ? stats.std.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Min</div>
                                                    <div className="text-base font-semibold">{stats ? stats.min.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Max</div>
                                                    <div className="text-base font-semibold">{stats ? stats.max.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Median</div>
                                                    <div className="text-base font-semibold">{stats ? stats.median.toFixed(0) : '—'} ppm</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Peer Fee To You</div>
                                                    <div className="text-base font-semibold">{peerFee !== null ? `${peerFee.toFixed(0)} ppm` : '—'}</div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="rounded-xl p-4" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                <p className="text-xs uppercase tracking-widest text-fuchsia-400 mb-3">Fees Other Peers Set To It</p>
                                {peerFeeLoading ? (
                                    <div className="text-sm animate-pulse text-indigo-400">Loading peer network fees...</div>
                                ) : peerFeeError ? (
                                    <div className="text-sm" style={{ color: 'var(--error-text)' }}>{peerFeeError}</div>
                                ) : peerFeeStats ? (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Corrected Avg</div>
                                            <div className="text-lg font-bold text-fuchsia-400">{peerFeeStats.correctedAvg.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Weighted Avg</div>
                                            <div className="text-lg font-bold text-fuchsia-400">{peerFeeStats.weightedAvg.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Average</div>
                                            <div className="text-base font-semibold">{peerFeeStats.avg.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Std Dev</div>
                                            <div className="text-base font-semibold">{peerFeeStats.std.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Min</div>
                                            <div className="text-base font-semibold">{peerFeeStats.min.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Max</div>
                                            <div className="text-base font-semibold">{peerFeeStats.max.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Median</div>
                                            <div className="text-base font-semibold">{peerFeeStats.median.toFixed(0)} ppm</div>
                                        </div>
                                        <div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your Fee To Peer</div>
                                            <div className="text-base font-semibold">
                                                {Number.isFinite(getFeeRatePpm(selectedChannel.myPolicy))
                                                    ? `${getFeeRatePpm(selectedChannel.myPolicy).toFixed(0)} ppm`
                                                    : '—'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No peer network fee data available.</div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6">
                            {(() => {
                                const getNiceStep = (raw) => {
                                    if (!Number.isFinite(raw) || raw <= 0) return 10;
                                    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
                                    const scaled = raw / pow;
                                    const nice =
                                        scaled <= 1 ? 1 :
                                            scaled <= 2 ? 2 :
                                                scaled <= 5 ? 5 : 10;
                                    return nice * pow;
                                };

                                const buildHistogram = (values, rangeParam) => {
                                    const clean = values
                                        .map((v) => Number(v))
                                        .filter((v) => Number.isFinite(v));
                                    if (!clean.length) return { bins: [], maxCount: 0, total: 0 };
                                    const filtered = rangeParam
                                        ? clean.filter((v) => v >= rangeParam.min && v < rangeParam.max)
                                        : clean;
                                    if (!filtered.length) return { bins: [], maxCount: 0, total: clean.length, binSize: 0, range: rangeParam };
                                    const maxVal = Math.max(...filtered, 0);
                                    const minVal = Math.min(...filtered, 0);
                                    const rangeSpan = Math.max(maxVal - minVal, 1);
                                    const targetBins = 18;
                                    const binSize = getNiceStep(rangeSpan / targetBins);
                                    const start = rangeParam ? rangeParam.min : 0;
                                    const binCount = Math.max(1, Math.ceil((maxVal - start) / binSize));
                                    const bins = Array.from({ length: binCount }, (_, i) => ({
                                        min: start + i * binSize,
                                        max: start + (i + 1) * binSize,
                                        count: 0,
                                    }));
                                    filtered.forEach((v) => {
                                        const idx = Math.min(Math.floor((v - start) / binSize), bins.length - 1);
                                        bins[idx].count += 1;
                                    });
                                    const nonZeroBins = bins.filter((b) => b.count > 0);
                                    const maxCount = Math.max(...nonZeroBins.map((b) => b.count), 1);
                                    return { bins: nonZeroBins, maxCount, total: clean.length, binSize, range: rangeParam };
                                };

                                const inboundHist = buildHistogram(peerFeeSeries.incoming, inboundZoom);
                                const outboundHist = buildHistogram(peerFeeSeries.outgoing, outboundZoom);
                                const inboundMarker = getFeeRatePpm(selectedChannel.myPolicy);
                                const outboundMarker = getFeeRatePpm(selectedChannel.peerPolicy);
                                const chartHeight = 200;
                                const getTicks = (maxCount) => {
                                    const max = Math.max(maxCount, 1);
                                    const mid = Math.ceil(max / 2);
                                    return [max, mid, 0];
                                };
                                const labelEvery = (bins) => Math.max(1, Math.ceil(bins.length / 6));
                                const getMarkerLeftPct = (marker, bins) => {
                                    if (!Number.isFinite(marker) || !bins.length) return null;
                                    const idx = bins.findIndex((b) => marker >= b.min && marker < b.max);
                                    if (idx === -1) return null;
                                    return ((idx + 0.5) / bins.length) * 100;
                                };

                                return (
                                    <>
                                        <div className="rounded-xl p-4" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-xs uppercase tracking-widest text-emerald-400">Inbound Fees To Peer</p>
                                                {inboundZoom && (
                                                    <button
                                                        className="text-[10px] px-2 py-1 rounded-full"
                                                        style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}
                                                        onClick={() => setInboundZoom(null)}
                                                    >
                                                        Reset Zoom
                                                    </button>
                                                )}
                                            </div>
                                            {inboundHist.total > 0 ? (
                                                <>
                                                    <div className="flex gap-3">
                                                        <div className="flex flex-col justify-between text-[10px] pr-2" style={{ color: 'var(--text-secondary)' }}>
                                                            {getTicks(inboundHist.maxCount).map((t) => (
                                                                <div key={`in-tick-${t}`} className="h-0 leading-none">{t}</div>
                                                            ))}
                                                        </div>
                                                        <div className="relative flex-1">
                                                            <div className="absolute inset-0 pointer-events-none">
                                                                {getTicks(inboundHist.maxCount).map((t) => (
                                                                    <div
                                                                        key={`in-line-${t}`}
                                                                        className="absolute left-0 right-0 h-px"
                                                                        style={{
                                                                            top: `${(1 - t / Math.max(inboundHist.maxCount, 1)) * 100}%`,
                                                                            backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div className="relative pb-2" style={{ height: chartHeight, overflowY: 'hidden' }}>
                                                                <div className="absolute left-0 right-0 bottom-0 h-px" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />
                                                                <div
                                                                    className="relative flex items-end gap-1.5"
                                                                    style={{ height: chartHeight, width: '100%' }}
                                                                >
                                                                    {inboundHist.bins.map((b) => (
                                                                        <div
                                                                            key={`${b.min}-${b.max}`}
                                                                            className="relative group"
                                                                            style={{ flex: 1, minWidth: 0 }}
                                                                            onClick={() => setInboundZoom({ min: b.min, max: b.max })}
                                                                            role="button"
                                                                            title={`Zoom to ${b.min}-${b.max} ppm`}
                                                                        >
                                                                            <div
                                                                                className="rounded-t border"
                                                                                style={{
                                                                                    height: `${(b.count / inboundHist.maxCount) * chartHeight}px`,
                                                                                    backgroundColor: '#34d399',
                                                                                    borderColor: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                                                                    minHeight: b.count ? 2 : 0,
                                                                                }}
                                                                            />
                                                                            <div
                                                                                className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', whiteSpace: 'nowrap', zIndex: 2 }}
                                                                            >
                                                                                {b.min}-{b.max} ppm · {b.count}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {(() => {
                                                                        const left = getMarkerLeftPct(inboundMarker, inboundHist.bins);
                                                                        return left !== null ? (
                                                                            <div
                                                                                className="absolute bottom-0 w-0.5 pointer-events-none"
                                                                                style={{
                                                                                    left: `${left}%`,
                                                                                    height: chartHeight,
                                                                                    backgroundColor: '#f59e0b',
                                                                                    boxShadow: '0 0 6px rgba(245,158,11,0.7)',
                                                                                    zIndex: 1,
                                                                                }}
                                                                                title="Your fee to this peer"
                                                                            />
                                                                        ) : null;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-1.5 pt-1" style={{ height: 18, overflowY: 'hidden' }}>
                                                                {inboundHist.bins.map((b, i) => (
                                                                    <div key={`in-label-${b.min}`} className="text-[9px] text-center" style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)' }}>
                                                                        {i % labelEvery(inboundHist.bins) === 0 ? b.min : ''}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
                                                        <span>
                                                            {inboundHist.total} channels · Bin {inboundHist.binSize || 0} ppm
                                                            {inboundZoom ? ` · Zoom ${inboundZoom.min}-${inboundZoom.max}` : ''}
                                                        </span>
                                                        <span>Your Fee {Number.isFinite(inboundMarker) ? `${inboundMarker.toFixed(0)} ppm` : '—'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No inbound fee distribution.</div>
                                            )}
                                        </div>

                                        <div className="rounded-xl p-4" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-xs uppercase tracking-widest text-fuchsia-400">Outbound Fees From Peer</p>
                                                {outboundZoom && (
                                                    <button
                                                        className="text-[10px] px-2 py-1 rounded-full"
                                                        style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}
                                                        onClick={() => setOutboundZoom(null)}
                                                    >
                                                        Reset Zoom
                                                    </button>
                                                )}
                                            </div>
                                            {outboundHist.total > 0 ? (
                                                <>
                                                    <div className="flex gap-3">
                                                        <div className="flex flex-col justify-between text-[10px] pr-2" style={{ color: 'var(--text-secondary)' }}>
                                                            {getTicks(outboundHist.maxCount).map((t) => (
                                                                <div key={`out-tick-${t}`} className="h-0 leading-none">{t}</div>
                                                            ))}
                                                        </div>
                                                        <div className="relative flex-1">
                                                            <div className="absolute inset-0 pointer-events-none">
                                                                {getTicks(outboundHist.maxCount).map((t) => (
                                                                    <div
                                                                        key={`out-line-${t}`}
                                                                        className="absolute left-0 right-0 h-px"
                                                                        style={{
                                                                            top: `${(1 - t / Math.max(outboundHist.maxCount, 1)) * 100}%`,
                                                                            backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <div className="relative pb-2" style={{ height: chartHeight, overflowY: 'hidden' }}>
                                                                <div className="absolute left-0 right-0 bottom-0 h-px" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />
                                                                <div
                                                                    className="relative flex items-end gap-1.5"
                                                                    style={{ height: chartHeight, width: '100%' }}
                                                                >
                                                                    {outboundHist.bins.map((b) => (
                                                                        <div
                                                                            key={`${b.min}-${b.max}`}
                                                                            className="relative group"
                                                                            style={{ flex: 1, minWidth: 0 }}
                                                                            onClick={() => setOutboundZoom({ min: b.min, max: b.max })}
                                                                            role="button"
                                                                            title={`Zoom to ${b.min}-${b.max} ppm`}
                                                                        >
                                                                            <div
                                                                                className="rounded-t border"
                                                                                style={{
                                                                                    height: `${(b.count / outboundHist.maxCount) * chartHeight}px`,
                                                                                    backgroundColor: '#f472b6',
                                                                                    borderColor: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                                                                    minHeight: b.count ? 2 : 0,
                                                                                }}
                                                                            />
                                                                            <div
                                                                                className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', whiteSpace: 'nowrap', zIndex: 2 }}
                                                                            >
                                                                                {b.min}-{b.max} ppm · {b.count}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    {(() => {
                                                                        const left = getMarkerLeftPct(outboundMarker, outboundHist.bins);
                                                                        return left !== null ? (
                                                                            <div
                                                                                className="absolute bottom-0 w-0.5 pointer-events-none"
                                                                                style={{
                                                                                    left: `${left}%`,
                                                                                    height: chartHeight,
                                                                                    backgroundColor: '#f59e0b',
                                                                                    boxShadow: '0 0 6px rgba(245,158,11,0.7)',
                                                                                    zIndex: 1,
                                                                                }}
                                                                                title="Peer fee to you"
                                                                            />
                                                                        ) : null;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-1.5 pt-1" style={{ height: 18, overflowY: 'hidden' }}>
                                                                {outboundHist.bins.map((b, i) => (
                                                                    <div key={`out-label-${b.min}`} className="text-[9px] text-center" style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)' }}>
                                                                        {i % labelEvery(outboundHist.bins) === 0 ? b.min : ''}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
                                                        <span>
                                                            {outboundHist.total} channels · Bin {outboundHist.binSize || 0} ppm
                                                            {outboundZoom ? ` · Zoom ${outboundZoom.min}-${outboundZoom.max}` : ''}
                                                        </span>
                                                        <span>Peer Fee {Number.isFinite(outboundMarker) ? `${outboundMarker.toFixed(0)} ppm` : '—'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No outbound fee distribution.</div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                                <p className="text-xs uppercase tracking-widest text-indigo-400">Comparison</p>
                                {(() => {
                                    const outFee = getFeeRatePpm(selectedChannel.myPolicy);
                                    const inFee = getFeeRatePpm(selectedChannel.peerPolicy);
                                    const ratio = outFee && inFee ? (outFee / inFee) : null;
                                    return (
                                        <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                            Out / In Ratio: <span className="text-indigo-400">{ratio ? ratio.toFixed(2) : '—'}x</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {(() => {
                                const outFee = getFeeRatePpm(selectedChannel.myPolicy) || 0;
                                const inFee = getFeeRatePpm(selectedChannel.peerPolicy) || 0;
                                const networkIn = peerFeeStats?.correctedAvg || 0;
                                const networkOut = peerOutFeeStats?.correctedAvg || 0;
                                const maxOutbound = Math.max(outFee, networkIn, 1);
                                const maxInbound = Math.max(inFee, networkOut, 1);
                                const barStyle = (value, max, color) => ({
                                    width: `${(value / max) * 100}%`,
                                    backgroundColor: color,
                                });
                                return (
                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold text-emerald-400">Your Fee (Outbound)</span>
                                                <span className="font-mono">{outFee ? `${outFee.toFixed(0)} ppm` : '—'}</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                                <div style={barStyle(outFee, maxOutbound, '#10b981')} className="h-full" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold text-fuchsia-400">Peer Fee To You (Incoming)</span>
                                                <span className="font-mono">{inFee ? `${inFee.toFixed(0)} ppm` : '—'}</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                                <div style={barStyle(inFee, maxInbound, '#e879f9')} className="h-full" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold text-indigo-400">Network Avg Fees To Peer</span>
                                                <span className="font-mono">{peerFeeStats ? `${peerFeeStats.correctedAvg.toFixed(0)} ppm` : '—'}</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                                <div style={barStyle(networkIn, maxOutbound, '#6366f1')} className="h-full" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold text-amber-400">Network Avg Fees From Peer</span>
                                                <span className="font-mono">{peerOutFeeStats ? `${peerOutFeeStats.correctedAvg.toFixed(0)} ppm` : '—'}</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                                <div style={barStyle(networkOut, maxInbound, '#f59e0b')} className="h-full" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── Peer Channels Table ─────────────────────────────── */}
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Peer's Channels</p>
                                {peerChannels.length > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: darkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                                        {peerChannels.length} channel{peerChannels.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                            {peerFeeLoading ? (
                                <div className="text-sm animate-pulse text-indigo-400 py-4">Loading peer channels…</div>
                            ) : peerChannels.length === 0 ? (
                                <div className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>No channel data available.</div>
                            ) : (() => {
                                // Column definitions for the sortable table
                                const COLS = [
                                    { key: 'alias',        label: 'Other Peer',       tip: 'The remote node on the other side of this channel', sortable: true },
                                    { key: 'capacity',     label: 'Capacity',         tip: 'Total channel capacity in sats — click to sort', sortable: true },
                                    { key: 'peerFeeRate',  label: 'Peer Fee Rate ↗',  tip: 'Fee rate our peer charges outbound (ppm) — click to sort', sortable: true },
                                    { key: 'otherFeeRate', label: 'Other Fee Rate ↗', tip: 'Fee rate the other node charges outbound (ppm) — click to sort', sortable: true },
                                    { key: 'peerBaseFee',  label: 'Peer Base Fee',    tip: 'Base fee our peer charges (msat) — click to sort', sortable: true },
                                    { key: 'otherBaseFee', label: 'Other Base Fee',   tip: 'Base fee other node charges (msat) — click to sort', sortable: true },
                                ];

                                const handleSort = (colKey) => {
                                    setPeerChanSort(prev =>
                                        prev.col === colKey
                                            ? { col: colKey, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
                                            : { col: colKey, dir: 'desc' }
                                    );
                                };

                                // Sort channels
                                const sorted = [...peerChannels].sort((a, b) => {
                                    const { col, dir } = peerChanSort;
                                    let va, vb;
                                    if (col === 'alias') {
                                        va = (peerChannelAliases[a.otherPub] || a.otherPub || '').toLowerCase();
                                        vb = (peerChannelAliases[b.otherPub] || b.otherPub || '').toLowerCase();
                                        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
                                    }
                                    va = a[col] ?? -1;  // null values sort last
                                    vb = b[col] ?? -1;
                                    return dir === 'asc' ? va - vb : vb - va;
                                });

                                return (
                                    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <thead>
                                                <tr style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                                                    {COLS.map(({ key, label, tip }) => {
                                                        const isActive = peerChanSort.col === key;
                                                        return (
                                                            <th
                                                                key={key}
                                                                title={tip}
                                                                onClick={() => handleSort(key)}
                                                                style={{
                                                                    padding: '10px 14px',
                                                                    textAlign: 'left',
                                                                    fontSize: 10,
                                                                    fontWeight: 700,
                                                                    textTransform: 'uppercase',
                                                                    letterSpacing: '0.05em',
                                                                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                    borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
                                                                    whiteSpace: 'nowrap',
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                    transition: 'color 0.15s',
                                                                }}
                                                            >
                                                                {label}
                                                                {isActive && (
                                                                    <span className="ml-1" style={{ color: '#6366f1' }}>
                                                                        {peerChanSort.dir === 'desc' ? '↓' : '↑'}
                                                                    </span>
                                                                )}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sorted.map((ch, i) => {
                                                    const alias = peerChannelAliases[ch.otherPub];
                                                    const shortPub = ch.otherPub.length > 10 ? `…${ch.otherPub.slice(-8)}` : ch.otherPub;
                                                    const isOurNode = myPubkey && ch.otherPub === myPubkey;
                                                    const isOurPeer = !isOurNode && ourPeerPubkeys.has(ch.otherPub);
                                                    const rowBg = isOurNode
                                                        ? (darkMode ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)')
                                                        : isOurPeer
                                                            ? (darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)')
                                                            : (i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)');
                                                    const labelColor = isOurNode ? '#6366f1' : isOurPeer ? '#10b981' : 'var(--text-primary)';
                                                    const td = {
                                                        padding: '9px 14px',
                                                        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                                                        whiteSpace: 'nowrap',
                                                    };
                                                    return (
                                                        <tr key={ch.chanId || i} style={{ backgroundColor: rowBg }}>
                                                            <td style={td}>
                                                                <div style={{ fontWeight: 700, color: labelColor }}>
                                                                    {alias || shortPub}
                                                                    {isOurNode && <span className="ml-1 text-[10px]" style={{ color: '#6366f1', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '1px 5px' }}>you</span>}
                                                                    {isOurPeer && <span className="ml-1 text-[10px]" style={{ color: '#10b981', background: 'rgba(16,185,129,0.15)', borderRadius: 4, padding: '1px 5px' }}>our peer</span>}
                                                                </div>
                                                                {alias && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{shortPub}</div>}
                                                            </td>
                                                            <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                                {fmtSats(ch.capacity)}
                                                            </td>
                                                            <td style={{ ...td, fontFamily: 'monospace' }}>
                                                                <span style={{
                                                                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                                    backgroundColor: ch.peerFeeRate !== null ? (darkMode ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)') : 'transparent',
                                                                    color: ch.peerFeeRate !== null ? '#10b981' : 'var(--text-secondary)',
                                                                }}>
                                                                    {ch.peerFeeRate !== null ? `${ch.peerFeeRate} ppm` : '—'}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...td, fontFamily: 'monospace' }}>
                                                                <span style={{
                                                                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                                                                    backgroundColor: ch.otherFeeRate !== null ? (darkMode ? 'rgba(244,114,182,0.15)' : 'rgba(244,114,182,0.1)') : 'transparent',
                                                                    color: ch.otherFeeRate !== null ? '#f472b6' : 'var(--text-secondary)',
                                                                }}>
                                                                    {ch.otherFeeRate !== null ? `${ch.otherFeeRate} ppm` : '—'}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...td, color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                                                                {ch.peerBaseFee} msat
                                                            </td>
                                                            <td style={{ ...td, color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                                                                {ch.otherBaseFee} msat
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChannelsPage;
