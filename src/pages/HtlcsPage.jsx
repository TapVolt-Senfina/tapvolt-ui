import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

// ─── HtlcsPage ────────────────────────────────────────────────────────────────
// Events are now received as props from App.jsx (global subscription).
// This component is display-only — no subscription code lives here.

const HtlcsPage = ({ lnc, darkMode, nodeChannels = [], events = [], isSubscribed = false, subError = null }) => {
    const [activeTab, setActiveTab] = useState('stream');
    const [chanAliasMap, setChanAliasMap] = useState({});

    // Build chanId → alias map: first from nodeChannels, then via getNodeInfo
    useEffect(() => {
        if (!nodeChannels.length && !lnc?.lnd?.lightning) return;

        const chanMap = {};
        const pubToResolve = [];

        nodeChannels.forEach((ch) => {
            const id = String(ch.chanId || ch.chan_id || '');
            const pubkey = String(ch.remotePubkey || ch.remote_pubkey || '');
            const alias = ch.peerAlias || ch.peer_alias || '';
            if (id) {
                chanMap[id] = { remotePubkey: pubkey, alias };
                if (pubkey && !alias) pubToResolve.push({ id, pubkey });
            }
        });

        // Attempt to resolve missing aliases via getNodeInfo
        if (lnc?.lnd?.lightning && pubToResolve.length) {
            Promise.allSettled(
                pubToResolve.map(({ id, pubkey }) =>
                    lnc.lnd.lightning.getNodeInfo({ pub_key: pubkey, include_channels: false })
                        .then(info => ({ id, alias: info?.node?.alias || '' }))
                        .catch(() => ({ id, alias: '' }))
                )
            ).then(results => {
                results.forEach(r => {
                    if (r.status === 'fulfilled' && r.value.alias && chanMap[r.value.id]) {
                        chanMap[r.value.id].alias = r.value.alias;
                    }
                });
                setChanAliasMap({ ...chanMap });
            });
        } else {
            setChanAliasMap(chanMap);
        }
    }, [nodeChannels, lnc]);

    const chanLabel = useCallback((chanId) => {
        if (!chanId || chanId === '0') return 'Local Node';
        const entry = chanAliasMap[String(chanId)];
        if (entry?.alias) return entry.alias;
        const s = String(chanId);
        return s.length > 10 ? `…${s.slice(-8)}` : s;
    }, [chanAliasMap]);

    const fmtMsat = (msat) => {
        const num = Number(msat) || 0;
        return `${(num / 1000).toLocaleString()} sats`;
    };

    // ─── Enrich events ─────────────────────────────────────────────────────
    const enrichedEvents = useMemo(() => {
        const forwardInfoMap = new Map();
        for (let i = events.length - 1; i >= 0; i--) {
            const e = events[i];
            if (e.forwardEvent) {
                const key = `${e.incomingChannelId}_${e.incomingHtlcId}`;
                forwardInfoMap.set(key, {
                    in: Number(e.forwardEvent.info?.incomingAmtMsat || 0),
                    out: Number(e.forwardEvent.info?.outgoingAmtMsat || 0),
                    outChan: String(e.outgoingChannelId || '0'),
                    incomingTimelock: e.forwardEvent.info?.incomingTimelock,
                    outgoingTimelock: e.forwardEvent.info?.outgoingTimelock,
                });
            }
        }
        return events.map(e => {
            const key = `${e.incomingChannelId}_${e.incomingHtlcId}`;
            const info = forwardInfoMap.get(key);
            return {
                ...e,
                enrichedAmtInMsat: info?.in || Number(e.info?.incomingAmtMsat || 0),
                enrichedAmtOutMsat: info?.out || Number(e.info?.outgoingAmtMsat || 0),
                enrichedOutChan: (info?.outChan && info?.outChan !== '0') ? info.outChan : String(e.outgoingChannelId || '0'),
                enrichedInTimelock: info?.incomingTimelock,
                enrichedOutTimelock: info?.outgoingTimelock,
            };
        });
    }, [events]);

    // ─── Sankey Data ───────────────────────────────────────────────────────
    const sankeyData = useMemo(() => {
        const linkMap = new Map();
        const countedHtlcs = new Set();

        for (let i = enrichedEvents.length - 1; i >= 0; i--) {
            const e = enrichedEvents[i];
            let status = null;
            if (e.settleEvent || (e.finalHtlcEvent && e.finalHtlcEvent.settled)) status = 'settled';
            else if (e.forwardFailEvent || e.linkFailEvent || (e.finalHtlcEvent && !e.finalHtlcEvent.settled)) status = 'failed';
            if (!status) continue;

            const htlcKey = `${e.incomingChannelId}_${e.incomingHtlcId}`;
            if (countedHtlcs.has(htlcKey)) continue;

            const inIdRaw = String(e.incomingChannelId || '0');
            const outIdRaw = String(e.enrichedOutChan || '0');
            const amtMsat = e.enrichedAmtOutMsat;
            if (!amtMsat) continue;
            const amtSats = Math.floor(amtMsat / 1000);
            if (amtSats <= 0) continue;

            countedHtlcs.add(htlcKey);

            const inId = `${inIdRaw}_in`;
            const outId = status === 'failed' ? `${outIdRaw}_out_failed` : `${outIdRaw}_out`;
            const key = `${inId}_${outId}_${status}`;
            if (!linkMap.has(key)) linkMap.set(key, { inId, outId, status, value: 0 });
            linkMap.get(key).value += amtSats;
        }

        const uniqueChanIds = new Set();
        linkMap.forEach(link => { uniqueChanIds.add(link.inId); uniqueChanIds.add(link.outId); });

        const nodes = Array.from(uniqueChanIds).map(id => {
            const isFailed = id.endsWith('_failed');
            const isOut = id.includes('_out');
            const realId = id.replace('_failed', '').replace('_in', '').replace('_out', '');
            return { name: isFailed ? `${chanLabel(realId)} (Failed)` : chanLabel(realId), id, isFailed, isOut };
        });

        const nodeMap = new Map();
        nodes.forEach((n, idx) => nodeMap.set(n.id, idx));

        const links = Array.from(linkMap.values()).map(link => ({
            source: nodeMap.get(link.inId),
            target: nodeMap.get(link.outId),
            value: link.value,
            status: link.status,
        }));

        if (nodes.length === 0 || links.length === 0) return null;
        return { nodes, links };
    }, [enrichedEvents, chanLabel]);

    // ─── Stats Data ────────────────────────────────────────────────────────
    const statsData = useMemo(() => {
        let forwards = 0, settles = 0, fwdFails = 0, linkFails = 0, finalFails = 0, others = 0;
        let totalForwardedMsat = 0n;
        let totalFeesMsat = 0n;
        const volumeByChannel = new Map();

        enrichedEvents.forEach(e => {
            if (e.forwardEvent) {
                forwards++;
                const out = BigInt(e.enrichedAmtOutMsat || 0);
                const inAmt = BigInt(e.enrichedAmtInMsat || 0);
                totalForwardedMsat += out;
                if (inAmt > out) totalFeesMsat += inAmt - out;

                const chanId = String(e.incomingChannelId || '0');
                const prev = volumeByChannel.get(chanId) || 0n;
                volumeByChannel.set(chanId, prev + out);
            } else if (e.settleEvent || (e.finalHtlcEvent?.settled)) {
                settles++;
            } else if (e.forwardFailEvent) {
                fwdFails++;
            } else if (e.linkFailEvent) {
                linkFails++;
            } else if (e.finalHtlcEvent && !e.finalHtlcEvent.settled) {
                finalFails++;
            } else {
                others++;
            }
        });

        const totalFails = fwdFails + linkFails + finalFails;
        const settleRate = forwards > 0 ? ((settles / forwards) * 100).toFixed(1) : '—';

        const pieData = [
            { name: 'Forward', value: forwards, color: '#3b82f6' },
            { name: 'Settle', value: settles, color: '#10b981' },
            { name: 'Fwd Fail', value: fwdFails, color: '#ef4444' },
            { name: 'Link Fail', value: linkFails, color: '#f97316' },
            { name: 'Final Fail', value: finalFails, color: '#dc2626' },
        ].filter(d => d.value > 0);

        const topChannels = Array.from(volumeByChannel.entries())
            .sort((a, b) => (b[1] > a[1] ? 1 : -1))
            .slice(0, 8)
            .map(([chanId, vol]) => ({
                label: chanLabel(chanId),
                sats: Number(vol) / 1000,
            }));

        return {
            total: enrichedEvents.length,
            forwards,
            settles,
            totalFails,
            settleRate,
            totalForwardedSats: Number(totalForwardedMsat) / 1000,
            totalFeesSats: Number(totalFeesMsat) / 1000,
            pieData,
            topChannels,
        };
    }, [enrichedEvents, chanLabel]);

    // ─── Styles ────────────────────────────────────────────────────────────
    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };
    const thStyle = {
        padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        whiteSpace: 'nowrap',
    };
    const tdStyle = {
        padding: '9px 14px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        whiteSpace: 'nowrap',
    };
    const chartTheme = {
        axis: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
        grid: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        tooltipBg: darkMode ? '#0b1220' : '#ffffff',
        tooltipBorder: darkMode ? '#334155' : '#e5e7eb',
    };

    return (
        <div className="p-6 space-y-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>HTLC Stream</h2>
                <div className="flex items-center gap-3">
                    {subError ? (
                        <span className="text-sm text-amber-400 font-semibold px-3 py-1 bg-amber-400/10 rounded-full">{subError}</span>
                    ) : isSubscribed ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-sm text-emerald-500 font-semibold">Listening (Live)</span>
                        </div>
                    ) : (
                        <span className="text-sm text-indigo-500 font-semibold px-3 py-1 bg-indigo-500/10 rounded-full">Connecting…</span>
                    )}
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                        {enrichedEvents.length} events
                    </span>
                </div>
            </div>

            <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                {/* Tabs */}
                <div className="flex items-center gap-4 px-4 pt-4 pb-0 border-b"
                    style={{ borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}>
                    {['stream', 'sankey', 'stats'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === tab ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>
                            {tab === 'stream' ? 'Live Stream' : tab === 'sankey' ? 'Sankey (Forwards)' : 'Stats'}
                        </button>
                    ))}
                </div>

                {/* Live Stream Tab */}
                {activeTab === 'stream' && (
                    <div style={{ overflowX: 'auto', maxHeight: 620, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                                <tr>
                                    <th style={thStyle}>Time</th>
                                    <th style={thStyle}>Action</th>
                                    <th style={thStyle}>In Channel</th>
                                    <th style={thStyle}>Out Channel</th>
                                    <th style={thStyle}>Amount (sats)</th>
                                    <th style={thStyle}>Fee (sats)</th>
                                    <th style={thStyle}>CLTV Δ</th>
                                    <th style={thStyle}>Failure Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {enrichedEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            No HTLC events observed yet. Waiting for routing activity…
                                        </td>
                                    </tr>
                                ) : (
                                    enrichedEvents.map((evt, i) => {
                                        const time = evt.timestampNs
                                            ? new Date(Number(evt.timestampNs) / 1e6).toLocaleTimeString()
                                            : '—';

                                        // Action: based solely on eventType
                                        const eventType = evt.eventType || evt.event_type || 'UNKNOWN';
                                        let action = 'Unknown';
                                        let actionColor = 'var(--text-secondary)';
                                        if (eventType === 'FORWARD' || evt.forwardEvent || evt.forwardFailEvent || evt.linkFailEvent) {
                                            action = 'Forward'; actionColor = '#6366f1';
                                        } else if (eventType === 'SEND') {
                                            action = 'Send'; actionColor = '#0ea5e9';
                                        } else if (eventType === 'RECEIVE') {
                                            action = 'Receive'; actionColor = '#10b981';
                                        }

                                        // Whether settled or failed (visual hint on amount cell)
                                        const isSettled = Boolean(evt.settleEvent || evt.finalHtlcEvent?.settled);
                                        const isFailed = Boolean(evt.forwardFailEvent || evt.linkFailEvent || (evt.finalHtlcEvent && !evt.finalHtlcEvent.settled));

                                        // Amounts
                                        let amtInMsat = Number(evt.forwardEvent?.info?.incomingAmtMsat || evt.linkFailEvent?.info?.incomingAmtMsat || 0);
                                        let amtOutMsat = Number(evt.forwardEvent?.info?.outgoingAmtMsat || evt.linkFailEvent?.info?.outgoingAmtMsat || 0);
                                        if (!amtInMsat) amtInMsat = evt.enrichedAmtInMsat || 0;
                                        if (!amtOutMsat) amtOutMsat = evt.enrichedAmtOutMsat || 0;

                                        const inChan = String(evt.incomingChannelId || evt.incoming_channel_id || '0');
                                        const outChan = evt.enrichedOutChan || '0';
                                        const feeMsat = amtInMsat > 0 && amtOutMsat > 0 ? amtInMsat - amtOutMsat : 0;

                                        // CLTV delta
                                        const inTl = evt.enrichedInTimelock;
                                        const outTl = evt.enrichedOutTimelock;
                                        const cltvDelta = (inTl && outTl) ? (Number(inTl) - Number(outTl)) : null;

                                        // Failure code
                                        const failCode = evt.linkFailEvent?.wireFailure?.code
                                            || evt.linkFailEvent?.failureDetail
                                            || null;

                                        // Amount color hint
                                        const amtColor = isSettled ? '#10b981' : isFailed ? '#ef4444' : 'var(--text-primary)';

                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                                                <td style={{ ...tdStyle, fontSize: 11 }}>{time}</td>
                                                <td style={{ ...tdStyle, color: actionColor, fontWeight: 'bold' }}>{action}</td>
                                                <td style={{ ...tdStyle, color: '#6366f1' }} title={inChan}>{chanLabel(inChan)}</td>
                                                <td style={{ ...tdStyle, color: '#10b981' }} title={outChan}>{chanLabel(outChan)}</td>
                                                <td style={{ ...tdStyle, color: amtColor }}>{amtOutMsat > 0 ? fmtMsat(amtOutMsat) : (amtInMsat > 0 ? fmtMsat(amtInMsat) : '—')}</td>
                                                <td style={{ ...tdStyle, color: '#f59e0b' }}>{feeMsat > 0 ? fmtMsat(feeMsat) : '—'}</td>
                                                <td style={{ ...tdStyle, color: '#a78bfa' }}>{cltvDelta != null ? cltvDelta : '—'}</td>
                                                <td style={{ ...tdStyle, color: '#f87171', fontSize: 11 }}>
                                                    {failCode ? String(failCode).replace('FAILURE_CODE_', '').replace(/_/g, ' ') : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Sankey Tab */}
                {activeTab === 'sankey' && (
                    <div style={{ width: '100%', height: Math.max(500, (sankeyData?.nodes?.length || 0) * 45), minHeight: 500, padding: 24, paddingRight: 48, paddingLeft: 48 }}>
                        {!sankeyData ? (
                            <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                                No settled or failed forward events observed yet to build visualization.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minHeight={500}>
                                <Sankey
                                    data={sankeyData}
                                    nodePadding={50}
                                    margin={{ left: 20, right: 20, top: 40, bottom: 40 }}
                                    node={(props) => <CustomNode {...props} darkMode={darkMode} />}
                                    link={{ stroke: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
                                >
                                    <Tooltip content={<CustomSankeyTooltip darkMode={darkMode} />} />
                                </Sankey>
                            </ResponsiveContainer>
                        )}
                    </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                    <div className="p-6 space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { label: 'Total Events', value: statsData.total.toLocaleString(), color: 'var(--text-primary)' },
                                { label: 'Settle Rate', value: `${statsData.settleRate}%`, color: '#10b981' },
                                { label: 'Forwarded', value: `${Math.round(statsData.totalForwardedSats).toLocaleString()} sats`, color: '#6366f1' },
                                { label: 'Fees Earned', value: `${Math.round(statsData.totalFeesSats).toLocaleString()} sats`, color: '#f59e0b' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="rounded-xl p-4" style={{ background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                                    <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                                    <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Pie: action breakdown */}
                            <div className="rounded-xl p-4" style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                                <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Event Type Breakdown</div>
                                {statsData.pieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie data={statsData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                                                {statsData.pieData.map((entry, index) => (
                                                    <Cell key={index} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8 }} itemStyle={{ color: 'var(--text-primary)' }} />
                                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-sm py-12 text-center" style={{ color: 'var(--text-secondary)' }}>No data yet.</div>
                                )}
                            </div>

                            {/* Bar: top channels by forwarded volume */}
                            <div className="rounded-xl p-4" style={{ background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }}>
                                <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Top Channels by Volume Forwarded</div>
                                {statsData.topChannels.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={statsData.topChannels} layout="vertical" margin={{ left: 8, right: 24 }}>
                                            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" tick={{ fill: chartTheme.axis, fontSize: 10 }} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v} />
                                            <YAxis type="category" dataKey="label" tick={{ fill: chartTheme.axis, fontSize: 11 }} width={90} />
                                            <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8 }} formatter={(v) => [`${Math.round(v).toLocaleString()} sats`, 'Forwarded']} />
                                            <Bar dataKey="sats" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="text-sm py-12 text-center" style={{ color: 'var(--text-secondary)' }}>No forward data yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Sankey Tooltip ───────────────────────────────────────────────────────────
const CustomSankeyTooltip = ({ active, payload, darkMode }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (data.source) {
            return (
                <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', padding: '10px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', color: darkMode ? '#f3f4f6' : '#111827', fontSize: '13px' }}>
                    <div className="mb-1 font-semibold">{data.source.name} → {data.target.name}</div>
                    <div style={{ color: data.status === 'failed' ? '#ef4444' : '#10b981' }}>
                        {data.status === 'failed' ? 'Failed Volume: ' : 'Settled Volume: '}
                        {data.value.toLocaleString()} sats
                    </div>
                </div>
            );
        }
        return (
            <div style={{ backgroundColor: darkMode ? '#1f2937' : '#ffffff', padding: '10px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`, borderRadius: '8px', color: darkMode ? '#f3f4f6' : '#111827', fontSize: '13px' }}>
                <div className="font-semibold">{data.name}</div>
                <div>Total Routed: {data.value.toLocaleString()} sats</div>
            </div>
        );
    }
    return null;
};

// ─── Sankey Node ──────────────────────────────────────────────────────────────
const CustomNode = ({ x, y, width, height, payload, darkMode }) => {
    const isOut = payload.isOut;
    const isFailed = payload.isFailed || payload.name.includes('(Failed)');
    let fill = isOut ? '#10b981' : '#3b82f6';
    if (isFailed) fill = '#ef4444';
    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity="0.8" rx={2} />
            <text x={isOut ? x - 6 : x + width + 6} y={y + height / 2} textAnchor={isOut ? 'end' : 'start'} dominantBaseline="middle" fontSize="12" fill={darkMode ? '#f3f4f6' : '#111827'} fontWeight="600">
                {payload.name}
            </text>
            <text x={isOut ? x - 6 : x + width + 6} y={y + height / 2 + 14} textAnchor={isOut ? 'end' : 'start'} fontSize="10" fill={darkMode ? '#9ca3af' : '#6b7280'}>
                {payload.value.toLocaleString()} sats
            </text>
        </g>
    );
};

export default HtlcsPage;
