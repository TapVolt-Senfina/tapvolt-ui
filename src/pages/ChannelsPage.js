import React, { useState, useEffect, useMemo } from 'react';

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

const ChannelsPage = ({ lnc, darkMode, nodeChannels = [] }) => {
    const [chanAliasMap, setChanAliasMap] = useState({});
    const [chanInfoMap, setChanInfoMap] = useState({}); // chanId => { node1_pub, node2_pub, node1_policy, node2_policy }
    const [forwards, setForwards] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

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

    // 2. Fetch forwarding history to calculate generated fees
    useEffect(() => {
        if (!lnc?.lnd?.lightning) return;

        const fetchAllForwards = async () => {
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
        };

        fetchAllForwards();
    }, [lnc]);

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
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Channel Management
                </h2>
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
                                        <tr key={chanId} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
                < /div>
            </div>
            );
                };

            export default ChannelsPage;
