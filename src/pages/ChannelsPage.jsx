import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { fmtSats, shortChan, getFeeRatePpm, computeStats } from '../utils/channelUtils';
import ChannelFeeModal from '../components/ChannelFeeModal';

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

    // Modal state
    const [feeModalOpen, setFeeModalOpen] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);

    // Node Lookup state
    const [lookupPubkey, setLookupPubkey] = useState('');

    const handleNodeLookup = () => {
        const pk = lookupPubkey.trim();
        if (!pk) return;
        setSelectedChannel({
            chanId: 'N/A', // Special flag indicating an arbitrary node lookup
            alias: '', // The modal will try to resolve an alias if it can, or it will just show the pubkey
            peerPubkey: pk,
            myPolicy: null,
            peerPolicy: null,
        });
        setFeeModalOpen(true);
        setLookupPubkey(''); // Clear after lookup? or keep it. Let's keep it in case they want to see what they typed.
    };

    // 1. Fetch channel aliases + policies
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

    // 2. Fetch all forwards (used for channel stats + fee suggestion)
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
        setIsRefreshing(true);
        try {
            await Promise.race([
                Promise.all([
                    onRefreshChannels ? onRefreshChannels() : Promise.resolve(),
                    fetchAllForwards(),
                ]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Refresh timeout')), 10000)),
            ]);
        } catch (e) {
            console.warn('Channels refresh error/timeout:', e);
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // 3. Compute routing stats per channel (historical earnings)
    const channelStats = useMemo(() => {
        const stats = new Map();

        forwards.forEach(f => {
            const chanIn = String(f.chan_id_in || f.chanIdIn || '');
            const chanOut = String(f.chan_id_out || f.chanIdOut || '');
            const feeSats = Number(f.fee || 0);
            const feeMsat = Number(f.fee_msat || f.feeMsat || 0);

            if (!stats.has(chanIn)) stats.set(chanIn, { feeOutSats: 0, feeOutMsat: 0, feeInSats: 0, feeInMsat: 0, fwdsOut: 0, fwdsIn: 0 });
            if (!stats.has(chanOut)) stats.set(chanOut, { feeOutSats: 0, feeOutMsat: 0, feeInSats: 0, feeInMsat: 0, fwdsOut: 0, fwdsIn: 0 });

            const inStats = stats.get(chanIn);
            inStats.fwdsIn++;
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

    // ── Totals ─────────────────────────────────────────────────────────────
    const totalCapacity = nodeChannels.reduce((sum, ch) => sum + Number(ch.capacity || 0), 0);
    const totalLocal = nodeChannels.reduce((sum, ch) => sum + Number(ch.localBalance || ch.local_balance || 0), 0);
    const totalRemote = nodeChannels.reduce((sum, ch) => sum + Number(ch.remoteBalance || ch.remote_balance || 0), 0);
    const totalFeesSats = Array.from(channelStats.values()).reduce((sum, s) => sum + s.feeOutSats, 0);
    const totalFeesMsat = Array.from(channelStats.values()).reduce((sum, s) => sum + s.feeOutMsat, 0);

    // ── Shared styles ───────────────────────────────────────────────────────
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

    return (
        <div className="p-6 space-y-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* ── Page header ──────────────────────────────────────────────── */}
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

            {/* ── Balances bar ──────────────────────────────────────────────── */}
            <div className="rounded-xl p-6 transition-colors duration-300" style={cardStyle}>
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-1">Local / Outbound</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {totalLocal.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>sats</span>
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">Total Capacity</p>
                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                            {totalCapacity.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>sats</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-1">Remote / Inbound</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            {totalRemote.toLocaleString()} <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>sats</span>
                        </p>
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

            {/* ── Remote Node Analysis ──────────────────────────────────────── */}
            <div className="rounded-xl p-6 transition-colors duration-300 flex flex-wrap gap-6 items-center justify-between" style={cardStyle}>
                <div className="flex-1 min-w-[280px]">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">Remote Node Analysis</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Enter any node's public key to analyze its fee distribution across the network.
                    </p>
                </div>
                <div className="flex gap-3 flex-1 min-w-[300px]">
                    <input
                        type="text"
                        placeholder="Node Public Key (PubKey)"
                        className="flex-1 px-4 py-2 rounded-xl text-sm outline-none transition-colors"
                        style={{
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            color: 'var(--text-primary)',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        }}
                        value={lookupPubkey}
                        onChange={(e) => setLookupPubkey(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNodeLookup();
                        }}
                    />
                    <button
                        onClick={handleNodeLookup}
                        disabled={!lookupPubkey.trim()}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                            ${lookupPubkey.trim() ? 'hover:bg-indigo-600 shadow-md hover:shadow-lg' : 'opacity-50 cursor-not-allowed'}`}
                        style={{
                            backgroundColor: lookupPubkey.trim() ? '#4f46e5' : 'transparent',
                            color: lookupPubkey.trim() ? '#fff' : 'var(--text-secondary)',
                            border: lookupPubkey.trim() ? '1px solid #4f46e5' : `1px solid ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                        }}
                    >
                        Analyze
                    </button>
                </div>
            </div>

            {/* ── Channel list table ────────────────────────────────────────── */}
            <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                    <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Channel List</h3>
                    {isLoading && <span className="text-xs animate-pulse text-indigo-500">Updating stats…</span>}
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

                                    // Resolve our policy vs peer's policy
                                    const cInfo = chanInfoMap[chanId];
                                    let myPolicy = null;
                                    let peerPolicy = null;
                                    if (cInfo) {
                                        const n1pub = String(cInfo.node1_pub || cInfo.node1Pub || '').toLowerCase();
                                        const n1pol = cInfo.node1_policy || cInfo.node1Policy;
                                        const n2pol = cInfo.node2_policy || cInfo.node2Policy;
                                        const peerPub = String(ch.remotePubkey || ch.remote_pubkey || '').toLowerCase();
                                        if (n1pub === peerPub) {
                                            myPolicy = n2pol;
                                            peerPolicy = n1pol;
                                        } else {
                                            myPolicy = n1pol;
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

            {/* ── Fee Modal ─────────────────────────────────────────────────── */}
            <ChannelFeeModal
                open={feeModalOpen}
                onClose={() => setFeeModalOpen(false)}
                darkMode={darkMode}
                selectedChannel={selectedChannel}
                lnc={lnc}
                myPubkey={myPubkey}
                ourPeerPubkeys={ourPeerPubkeys}
            />
        </div>
    );
};

export default ChannelsPage;
