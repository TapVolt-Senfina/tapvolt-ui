import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';

const HtlcsPage = ({ lnc, darkMode, nodeChannels = [] }) => {
    const [events, setEvents] = useState([]);
    const [activeTab, setActiveTab] = useState('stream');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subError, setSubError] = useState(null);

    // Map channel IDs to aliases
    const [chanAliasMap, setChanAliasMap] = useState({});

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
            results.forEach((r) => { if (r.status === 'fulfilled') pubkeyAlias[r.value.pk] = r.value.alias; });
            Object.values(chanMap).forEach((entry) => { entry.alias = pubkeyAlias[entry.remotePubkey] || ''; });
            setChanAliasMap({ ...chanMap });
        });
    }, [lnc, nodeChannels]);

    const chanLabel = useCallback((chanId) => {
        if (!chanId || chanId === '0') return 'Local Node';
        const entry = chanAliasMap[String(chanId)];
        if (entry?.alias) return entry.alias;
        const s = String(chanId);
        return s.length > 10 ? `…${s.slice(-8)}` : s;
    }, [chanAliasMap]);

    // Format helpers
    const fmtMsat = (msat) => {
        const num = Number(msat) || 0;
        return `${(num / 1000).toLocaleString()} sats`;
    };

    // Subscription
    useEffect(() => {
        if (!lnc?.lnd?.router) {
            setSubError("Router service not available. Ensure LNC permissions include router RPC.");
            return;
        }

        let isMounted = true;
        let sub = null;

        const startSubscription = async () => {
            try {
                if (!isMounted) return;

                setIsSubscribed(true);
                setSubError(null);

                // LNC streaming uses callbacks: (request, onData, onError)
                sub = lnc.lnd.router.subscribeHtlcEvents({}, (data) => {
                    const evt = data.htlcEvent || data;
                    // Filter out the initial handshake/subscription confirmed event
                    if (evt.subscribedEvent || (evt.eventType === 'UNKNOWN' && evt.timestampNs === '0')) return;

                    setEvents(prev => {
                        // Deduplicate events from LND/React StrictMode
                        const isDuplicate = prev.some(p =>
                            p.timestampNs === evt.timestampNs &&
                            p.incomingHtlcId === evt.incomingHtlcId &&
                            p.eventType === evt.eventType
                        );
                        if (isDuplicate) return prev;

                        const newEvents = [evt, ...prev];
                        // Keep last 1000 events for performance
                        return newEvents.slice(0, 1000);
                    });
                }, (err) => {
                    if (!isMounted) return;
                    console.error("HTLC subscription error:", err);
                    setSubError(`Streaming error: ${err.message || 'Connection lost'}`);
                    setIsSubscribed(false);
                });

            } catch (err) {
                if (!isMounted) return;
                console.error("Failed to subscribe to HTLC events:", err);
                setSubError(err.message || 'Failed to connect to HTLC stream.');
            }
        };

        startSubscription();

        return () => {
            isMounted = false;
            setIsSubscribed(false);
            // sub from lnc-web streaming usually has a cancel method or is a function to cancel
            if (sub) {
                try {
                    if (typeof sub.cancel === 'function') sub.cancel();
                    else if (typeof sub === 'function') sub();
                } catch (e) { /* ignore */ }
            }
        };
    }, [lnc]);
    // Enrich events: Fail/Settle events often lack amount/outChannel info. 
    // We correlate them with their initial FORWARD events.
    const enrichedEvents = useMemo(() => {
        const forwardInfoMap = new Map();

        // Pass 1: Collect amount and destination from FORWARD events
        // Traversing backwards ensures we process the oldest first (earliest forward)
        for (let i = events.length - 1; i >= 0; i--) {
            const e = events[i];
            if (e.forwardEvent) {
                const key = `${e.incomingChannelId}_${e.incomingHtlcId}`;
                forwardInfoMap.set(key, {
                    in: Number(e.forwardEvent.info?.incomingAmtMsat || 0),
                    out: Number(e.forwardEvent.info?.outgoingAmtMsat || 0),
                    outChan: String(e.outgoingChannelId || '0')
                });
            }
        }

        // Pass 2: Map over and enrich
        return events.map(e => {
            const key = `${e.incomingChannelId}_${e.incomingHtlcId}`;
            const info = forwardInfoMap.get(key);
            return {
                ...e,
                enrichedAmtInMsat: info?.in || Number(e.info?.incomingAmtMsat || 0),
                enrichedAmtOutMsat: info?.out || Number(e.info?.outgoingAmtMsat || 0),
                enrichedOutChan: (info?.outChan && info?.outChan !== '0') ? info.outChan : String(e.outgoingChannelId || '0')
            };
        });
    }, [events]);

    // Sankey Chart Data Processing
    const sankeyData = useMemo(() => {
        const linkMap = new Map();

        // Process ENRICHED events that have a corresponding SETTLE or FAIL
        enrichedEvents.forEach(e => {
            let status = null;
            if (e.settleEvent || (e.finalHtlcEvent && e.finalHtlcEvent.settled)) {
                status = 'settled';
            } else if (e.forwardFailEvent || e.linkFailEvent || (e.finalHtlcEvent && !e.finalHtlcEvent.settled)) {
                status = 'failed';
            }

            if (!status) return;

            const inIdRaw = String(e.incomingChannelId || '0');
            let outIdRaw = String(e.enrichedOutChan || '0');

            const amtMsat = e.enrichedAmtOutMsat;
            if (!amtMsat) return; // Cannot chart without amounts

            const amtSats = Math.floor(amtMsat / 1000);
            if (amtSats <= 0) return;

            const inId = `${inIdRaw}_in`;
            const outId = status === 'failed' ? `${outIdRaw}_out_failed` : `${outIdRaw}_out`;

            const key = `${inId}_${outId}_${status}`;
            if (!linkMap.has(key)) {
                linkMap.set(key, { inId, outId, status, value: 0 });
            }
            linkMap.get(key).value += amtSats;
        });

        // Build unique nodes
        const uniqueChanIds = new Set();
        linkMap.forEach(link => {
            uniqueChanIds.add(link.inId);
            uniqueChanIds.add(link.outId);
        });

        const nodes = Array.from(uniqueChanIds).map(id => {
            const isFailed = id.endsWith('_failed');
            const isOut = id.includes('_out');
            const realId = id.replace('_failed', '').replace('_in', '').replace('_out', '');
            return {
                name: isFailed ? `${chanLabel(realId)} (Failed)` : chanLabel(realId),
                id,
                isFailed,
                isOut
            };
        });

        // Node map
        const nodeMap = new Map();
        nodes.forEach((n, idx) => nodeMap.set(n.id, idx));

        const links = Array.from(linkMap.values()).map(link => ({
            source: nodeMap.get(link.inId),
            target: nodeMap.get(link.outId),
            value: link.value,
            status: link.status
        }));

        if (nodes.length === 0 || links.length === 0) return null;
        return { nodes, links };
    }, [events, chanLabel]);


    // Styles
    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };

    const thStyle = {
        padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        whiteSpace: 'nowrap',
    };
    const tdStyle = {
        padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', color: 'var(--text-primary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        whiteSpace: 'nowrap',
    };

    return (
        <div className="p-6 space-y-8" style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>HTLC Stream</h2>
                <div className="flex items-center gap-3">
                    {subError ? (
                        <span className="text-sm text-red-500 font-semibold px-3 py-1 bg-red-500/10 rounded-full">Error</span>
                    ) : isSubscribed ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-sm text-emerald-500 font-semibold">Listening (Live)</span>
                        </div>
                    ) : (
                        <span className="text-sm text-indigo-500 font-semibold px-3 py-1 bg-indigo-500/10 rounded-full">Connecting...</span>
                    )}
                </div>
            </div>

            {subError && (
                <div className="rounded-xl p-4 text-sm bg-red-500/10 text-red-500 border border-red-500/20">
                    {subError}
                </div>
            )}

            <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                {/* Tabs */}
                <div
                    className="flex items-center gap-4 px-4 pt-4 pb-0 border-b"
                    style={{ borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
                >
                    <button
                        onClick={() => setActiveTab('stream')}
                        className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'stream' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                    >
                        Live Stream
                    </button>
                    <button
                        onClick={() => setActiveTab('sankey')}
                        className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'sankey' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                    >
                        Sankey Visualization (Settled Forwards)
                    </button>
                </div>

                {/* Content */}
                <div className="p-0">
                    {activeTab === 'stream' ? (
                        <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Time</th>
                                        <th style={thStyle}>Type</th>
                                        <th style={thStyle}>Action</th>
                                        <th style={thStyle}>In Channel</th>
                                        <th style={thStyle}>Out Channel</th>
                                        <th style={thStyle}>Route Amount (sats)</th>
                                        <th style={thStyle}>Fee (sats)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrichedEvents.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                No HTLC events observed yet. Waiting for routing activity...
                                            </td>
                                        </tr>
                                    ) : (
                                        enrichedEvents.map((evt, i) => {
                                            const time = evt.timestampNs ? new Date(Number(evt.timestampNs) / 1000000).toLocaleTimeString() : '—';
                                            const type = evt.eventType || evt.event_type || 'UNKNOWN';

                                            // Determine action
                                            let action = 'Unknown';
                                            let actionColor = 'var(--text-secondary)';

                                            // Extract amounts
                                            let amtInMsat = 0;
                                            let amtOutMsat = 0;

                                            if (evt.forwardEvent) {
                                                action = 'Add / Forward';
                                                actionColor = '#3b82f6';
                                                amtInMsat = Number(evt.forwardEvent.info?.incomingAmtMsat || 0);
                                                amtOutMsat = Number(evt.forwardEvent.info?.outgoingAmtMsat || 0);
                                            }
                                            else if (evt.settleEvent) {
                                                action = 'Settle';
                                                actionColor = '#10b981';
                                            }
                                            else if (evt.forwardFailEvent) {
                                                action = 'Fwd Fail';
                                                actionColor = '#ef4444';
                                            }
                                            else if (evt.linkFailEvent) {
                                                action = 'Link Fail';
                                                actionColor = '#ef4444';
                                                amtInMsat = Number(evt.linkFailEvent.info?.incomingAmtMsat || 0);
                                                amtOutMsat = Number(evt.linkFailEvent.info?.outgoingAmtMsat || 0);
                                            }
                                            else if (evt.finalHtlcEvent) {
                                                action = evt.finalHtlcEvent.settled ? 'Final Settle' : 'Final Fail';
                                                actionColor = evt.finalHtlcEvent.settled ? '#10b981' : '#ef4444';
                                            }

                                            // Fallbacks if not caught by specific event payload type
                                            if (!amtInMsat) amtInMsat = evt.enrichedAmtInMsat || 0;
                                            if (!amtOutMsat) amtOutMsat = evt.enrichedAmtOutMsat || 0;

                                            const inChan = String(evt.incomingChannelId || evt.incoming_channel_id || '0');
                                            const outChan = evt.enrichedOutChan || '0';

                                            // Only compute fee on forward actions (where in != out)
                                            const feeMsat = amtInMsat > 0 && amtOutMsat > 0 ? amtInMsat - amtOutMsat : 0;

                                            return (
                                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                                                    <td style={{ ...tdStyle, fontSize: 12 }}>{time}</td>
                                                    <td style={{ ...tdStyle, fontSize: 12 }}>{type}</td>
                                                    <td style={{ ...tdStyle, color: actionColor, fontWeight: 'bold' }}>{action}</td>
                                                    <td style={{ ...tdStyle, color: '#6366f1' }} title={inChan}>{chanLabel(inChan)}</td>
                                                    <td style={{ ...tdStyle, color: '#10b981' }} title={outChan}>{chanLabel(outChan)}</td>
                                                    <td style={tdStyle}>{amtOutMsat > 0 ? fmtMsat(amtOutMsat) : (amtInMsat > 0 ? fmtMsat(amtInMsat) : '—')}</td>
                                                    <td style={{ ...tdStyle, color: '#f59e0b' }}>{feeMsat > 0 ? fmtMsat(feeMsat) : '—'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
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
                                        <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                                    </Sankey>
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Custom Tooltip for Sankey
const CustomTooltip = ({ active, payload, darkMode }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        // link tooltip
        if (data.source) {
            return (
                <div style={{
                    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                    padding: '10px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px', color: darkMode ? '#f3f4f6' : '#111827', fontSize: '13px'
                }}>
                    <div className="mb-1 font-semibold">{data.source.name} → {data.target.name}</div>
                    <div style={{ color: data.status === 'failed' ? '#ef4444' : '#10b981' }}>
                        {data.status === 'failed' ? 'Failed Volume: ' : 'Settled Volume: '}
                        {data.value.toLocaleString()} sats
                    </div>
                </div>
            );
        }
        // node tooltip
        return (
            <div style={{
                backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                padding: '10px', border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px', color: darkMode ? '#f3f4f6' : '#111827', fontSize: '13px'
            }}>
                <div className="font-semibold">{data.name}</div>
                <div>Total Routed: {data.value.toLocaleString()} sats</div>
            </div>
        );
    }
    return null;
};

// Custom Node for Sankey
const CustomNode = ({ x, y, width, height, index, payload, darkMode }) => {
    const isOut = payload.isOut;
    const isFailed = payload.isFailed || payload.name.includes('(Failed)');

    // Left (Inbound) = Green, Right (Outbound) = Blue
    let fill = isOut ? '#3b82f6' : '#10b981';
    if (isFailed) fill = '#ef4444'; // Red for failed routes

    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity="0.8" rx={2} />
            <text
                x={isOut ? x - 6 : x + width + 6}
                y={y + height / 2}
                textAnchor={isOut ? 'end' : 'start'}
                dominantBaseline="middle"
                fontSize="12"
                fill={darkMode ? '#f3f4f6' : '#111827'}
                fontWeight="600"
            >
                {payload.name}
            </text>
            <text
                x={isOut ? x - 6 : x + width + 6}
                y={y + height / 2 + 14}
                textAnchor={isOut ? 'end' : 'start'}
                fontSize="10"
                fill={darkMode ? '#9ca3af' : '#6b7280'}
            >
                {payload.value.toLocaleString()} sats
            </text>
        </g>
    );
};

export default HtlcsPage;
