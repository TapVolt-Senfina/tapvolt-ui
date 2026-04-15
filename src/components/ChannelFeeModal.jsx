import React, { useState, useEffect, useMemo } from 'react';
import { fmtSats, shortChan, getFeeRatePpm, computeStats } from '../utils/channelUtils';

// ── Histogram helper ────────────────────────────────────────────────────────

const getNiceStep = (raw) => {
    if (!Number.isFinite(raw) || raw <= 0) return 10;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const scaled = raw / pow;
    const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return nice * pow;
};

const buildHistogram = (values, rangeParam) => {
    const clean = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    if (!clean.length) return { bins: [], maxCount: 0, total: 0 };
    const filtered = rangeParam
        ? clean.filter((v) => v >= rangeParam.min && v < rangeParam.max)
        : clean;
    if (!filtered.length)
        return { bins: [], maxCount: 0, total: clean.length, binSize: 0, range: rangeParam };
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

// ── Histogram chart (reusable inside the modal) ─────────────────────────────

const HistogramChart = ({ values, zoom, onZoom, onResetZoom, marker, label, accentColor, darkMode }) => {
    const hist = buildHistogram(values, zoom);
    const chartHeight = 200;

    const getTicks = (maxCount) => {
        const max = Math.max(maxCount, 1);
        const mid = Math.ceil(max / 2);
        return [max, mid, 0];
    };
    const labelEvery = (bins) => Math.max(1, Math.ceil(bins.length / 6));
    const getMarkerLeftPct = (markerVal, bins) => {
        if (!Number.isFinite(markerVal) || !bins.length) return null;
        const idx = bins.findIndex((b) => markerVal >= b.min && markerVal < b.max);
        if (idx === -1) return null;
        return ((idx + 0.5) / bins.length) * 100;
    };

    const gridLineColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const baselineColor = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

    return (
        <div className="rounded-xl p-4" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: accentColor }}>{label}</p>
                {zoom && (
                    <button
                        className="text-[10px] px-2 py-1 rounded-full"
                        style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}
                        onClick={onResetZoom}
                    >
                        Reset Zoom
                    </button>
                )}
            </div>
            {hist.total > 0 ? (
                <>
                    <div className="flex gap-3">
                        <div className="flex flex-col justify-between text-[10px] pr-2" style={{ color: 'var(--text-secondary)' }}>
                            {getTicks(hist.maxCount).map((t) => (
                                <div key={`tick-${t}`} className="h-0 leading-none">{t}</div>
                            ))}
                        </div>
                        <div className="relative flex-1">
                            <div className="absolute inset-0 pointer-events-none">
                                {getTicks(hist.maxCount).map((t) => (
                                    <div
                                        key={`line-${t}`}
                                        className="absolute left-0 right-0 h-px"
                                        style={{ top: `${(1 - t / Math.max(hist.maxCount, 1)) * 100}%`, backgroundColor: gridLineColor }}
                                    />
                                ))}
                            </div>
                            <div className="relative pb-2" style={{ height: chartHeight, overflowY: 'hidden' }}>
                                <div className="absolute left-0 right-0 bottom-0 h-px" style={{ backgroundColor: baselineColor }} />
                                <div className="relative flex items-end gap-1.5" style={{ height: chartHeight, width: '100%' }}>
                                    {hist.bins.map((b) => (
                                        <div
                                            key={`${b.min}-${b.max}`}
                                            className="relative group"
                                            style={{ flex: 1, minWidth: 0 }}
                                            onClick={() => onZoom({ min: b.min, max: b.max })}
                                            role="button"
                                            title={`Zoom to ${b.min}–${b.max} ppm`}
                                        >
                                            <div
                                                className="rounded-t border"
                                                style={{
                                                    height: `${(b.count / hist.maxCount) * chartHeight}px`,
                                                    backgroundColor: accentColor,
                                                    borderColor: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                                    minHeight: b.count ? 2 : 0,
                                                }}
                                            />
                                            <div
                                                className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded px-2 py-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                                style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', whiteSpace: 'nowrap', zIndex: 2 }}
                                            >
                                                {b.min}–{b.max} ppm · {b.count}
                                            </div>
                                        </div>
                                    ))}
                                    {(() => {
                                        const left = getMarkerLeftPct(marker, hist.bins);
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
                                                title={`Your fee: ${marker?.toFixed(0)} ppm`}
                                            />
                                        ) : null;
                                    })()}
                                </div>
                            </div>
                            <div className="flex items-start gap-1.5 pt-1" style={{ height: 18, overflowY: 'hidden' }}>
                                {hist.bins.map((b, i) => (
                                    <div key={`label-${b.min}`} className="text-[9px] text-center" style={{ flex: 1, minWidth: 0, color: 'var(--text-secondary)' }}>
                                        {i % labelEvery(hist.bins) === 0 ? b.min : ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
                        <span>
                            {hist.total} channels · Bin {hist.binSize || 0} ppm
                            {zoom ? ` · Zoom ${zoom.min}–${zoom.max}` : ''}
                        </span>
                        <span>Marker {Number.isFinite(marker) ? `${marker.toFixed(0)} ppm` : '—'}</span>
                    </div>
                </>
            ) : (
                <div className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>No distribution data available.</div>
            )}
        </div>
    );
};



// ── Peer Stats Card ─────────────────────────────────────────────────────────

const StatGrid = ({ stats, accentColor, label }) => (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}>
        <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: accentColor }}>{label}</p>
        {stats ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                    ['Corrected Avg', stats.correctedAvg, true],
                    ['Weighted Avg',  stats.weightedAvg, true],
                    ['Average',       stats.avg,         false],
                    ['Std Dev',       stats.std,         false],
                    ['Min',           stats.min,         false],
                    ['Max',           stats.max,         false],
                    ['Median',        stats.median,      false],
                ].map(([key, val, big]) => (
                    <div key={key}>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{key}</div>
                        <div className={`${big ? 'text-lg font-bold' : 'text-base font-semibold'}`} style={{ color: big ? accentColor : 'var(--text-primary)' }}>
                            {val?.toFixed(0) ?? '—'} ppm
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No data available.</div>
        )}
    </div>
);

// ── Main Component ──────────────────────────────────────────────────────────

const ChannelFeeModal = ({
    open,
    onClose,
    darkMode,
    selectedChannel,   // { chanId, alias, peerPubkey, myPolicy, peerPolicy }
    lnc,
    myPubkey = '',
    ourPeerPubkeys,    // Set<string>
}) => {
    const [peerFeeStats,       setPeerFeeStats]       = useState(null);
    const [peerOutFeeStats,    setPeerOutFeeStats]    = useState(null);
    const [peerFeeSeries,      setPeerFeeSeries]      = useState({ incoming: [], outgoing: [] });
    const [inboundZoom,        setInboundZoom]        = useState(null);
    const [outboundZoom,       setOutboundZoom]       = useState(null);
    const [peerFeeLoading,     setPeerFeeLoading]     = useState(false);
    const [peerFeeError,       setPeerFeeError]       = useState(null);
    const [peerChannels,       setPeerChannels]       = useState([]);
    const [peerChannelAliases, setPeerChannelAliases] = useState({});
    const [peerChanSort,       setPeerChanSort]       = useState({ col: 'capacity', dir: 'desc' });
    const [resolvedPeerAlias,  setResolvedPeerAlias]  = useState('');

    // Reset zoom when channel changes
    useEffect(() => {
        setInboundZoom(null);
        setOutboundZoom(null);
        setPeerFeeStats(null);
        setPeerOutFeeStats(null);
        setPeerFeeSeries({ incoming: [], outgoing: [] });
        setPeerChannels([]);
        setPeerChannelAliases({});
        setResolvedPeerAlias('');
    }, [selectedChannel?.chanId, selectedChannel?.peerPubkey]);

    const isNodeLookup = !selectedChannel?.chanId || selectedChannel.chanId === 'N/A';

    // Fetch peer node info when modal opens
    useEffect(() => {
        if (!open || !selectedChannel?.peerPubkey || !lnc?.lnd?.lightning) return;
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

                if (isMounted && info?.node?.alias) {
                    setResolvedPeerAlias(info.node.alias);
                }

                const channels = info?.channels || info?.node?.channels || [];
                const peerKey = selectedChannel.peerPubkey.toLowerCase();
                const incomingFees = [];
                const incomingWeights = [];
                const outgoingFees = [];
                const outgoingWeights = [];
                const annotatedChannels = [];

                channels.forEach((ch) => {
                    const n1 = String(ch.node1_pub || ch.node1Pub || '').toLowerCase();
                    const n2 = String(ch.node2_pub || ch.node2Pub || '').toLowerCase();
                    const n1pol = ch.node1_policy || ch.node1Policy;
                    const n2pol = ch.node2_policy || ch.node2Policy;
                    const cap = Number(ch.capacity || 0);
                    const isPeerNode1 = n1 === peerKey;
                    const otherPub = isPeerNode1
                        ? (ch.node2_pub || ch.node2Pub || '')
                        : (ch.node1_pub || ch.node1Pub || '');
                    const peerPolicy = isPeerNode1 ? n1pol : n2pol;
                    const otherPolicy = isPeerNode1 ? n2pol : n1pol;

                    annotatedChannels.push({
                        chanId: String(ch.chan_id || ch.chanId || ''),
                        capacity: cap,
                        otherPub: String(otherPub).toLowerCase(),
                        peerFeeRate: getFeeRatePpm(peerPolicy),
                        otherFeeRate: getFeeRatePpm(otherPolicy),
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

                const statsIn  = computeStats(incomingFees, incomingWeights);
                const statsOut = computeStats(outgoingFees, outgoingWeights);

                if (isMounted) {
                    setPeerFeeStats(statsIn);
                    setPeerOutFeeStats(statsOut);
                    setPeerFeeSeries({ incoming: incomingFees, outgoing: outgoingFees });
                    setPeerChannels(annotatedChannels);
                }

                // Resolve aliases for peer's other-end nodes
                const uniqueOtherPubs = [
                    ...new Set(annotatedChannels.map((c) => c.otherPub).filter(Boolean)),
                ];
                const aliasResults = await Promise.allSettled(
                    uniqueOtherPubs.map((pk) =>
                        lnc.lnd.lightning
                            .getNodeInfo({ pub_key: pk, include_channels: false })
                            .then((r) => ({ pk, alias: r?.node?.alias || '' }))
                            .catch(() => ({ pk, alias: '' }))
                    )
                );
                if (isMounted) {
                    const aliasMap = {};
                    aliasResults.forEach((r) => {
                        if (r.status === 'fulfilled') aliasMap[r.value.pk] = r.value.alias;
                    });
                    setPeerChannelAliases(aliasMap);
                }
            } catch (e) {
                if (isMounted) setPeerFeeError(e?.message || 'Failed to load peer network fee data.');
            } finally {
                if (isMounted) setPeerFeeLoading(false);
            }
        };

        fetchPeerFees();
        return () => { isMounted = false; };
    }, [open, selectedChannel, lnc]);

    // ── Peer channels table sort ─────────────────────────────────────────────
    const sortedPeerChannels = useMemo(() => {
        const { col, dir } = peerChanSort;
        return [...peerChannels].sort((a, b) => {
            let va, vb;
            if (col === 'alias') {
                va = (peerChannelAliases[a.otherPub] || a.otherPub || '').toLowerCase();
                vb = (peerChannelAliases[b.otherPub] || b.otherPub || '').toLowerCase();
                return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            }
            va = a[col] ?? -1;
            vb = b[col] ?? -1;
            return dir === 'asc' ? va - vb : vb - va;
        });
    }, [peerChannels, peerChanSort, peerChannelAliases]);

    if (!open || !selectedChannel) return null;

    const overlayBg = 'rgba(0,0,0,0.72)';
    const modalBg   = 'var(--bg-card)';
    const borderCol = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const subBg     = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';

    const thStyle = {
        padding: '10px 14px',
        textAlign: 'left',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'color 0.15s',
    };

    const myFeeRate   = getFeeRatePpm(selectedChannel.myPolicy);
    const peerFeeRate = getFeeRatePpm(selectedChannel.peerPolicy);

    // Comparison bars
    const outFee    = myFeeRate ?? 0;
    const inFee     = peerFeeRate ?? 0;
    const networkIn = peerFeeStats?.correctedAvg ?? 0;
    const networkOut= peerOutFeeStats?.correctedAvg ?? 0;
    const maxOut    = Math.max(outFee, networkIn, 1);
    const maxIn     = Math.max(inFee, networkOut, 1);

    const PEER_COLS = [
        { key: 'alias',        label: 'Other Peer',        tip: 'Remote node on the other side', sortable: true },
        { key: 'capacity',     label: 'Capacity',          tip: 'Total channel capacity (sats)', sortable: true },
        { key: 'peerFeeRate',  label: 'Peer Fee Rate ↗',   tip: 'Fee our peer charges outbound (ppm)', sortable: true },
        { key: 'otherFeeRate', label: 'Other Fee Rate ↗',  tip: 'Fee other node charges outbound (ppm)', sortable: true },
        { key: 'peerBaseFee',  label: 'Peer Base Fee',     tip: 'Base fee peer charges (msat)', sortable: true },
        { key: 'otherBaseFee', label: 'Other Base Fee',    tip: 'Base fee other node charges (msat)', sortable: true },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: overlayBg, backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl p-6 shadow-2xl"
                style={{ backgroundColor: modalBg, border: `1px solid ${borderCol}` }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-indigo-400">
                            {isNodeLookup ? 'Node Analysis' : 'Fee Report'}
                        </p>
                        <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                            {selectedChannel.alias || resolvedPeerAlias || 'Unknown Node'}
                        </h3>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {isNodeLookup ? `Node ID: ${selectedChannel.peerPubkey}` : `Channel ${shortChan(selectedChannel.chanId)} · Peer ${shortChan(selectedChannel.peerPubkey)}`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-3 py-2 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: 'var(--text-secondary)' }}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* ── Current Fees Snapshot ────────────────────────────────── */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                    <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Current Fees Snapshot</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Live channel policies</div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Peer fee stats */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: subBg }}>
                        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-3">Peer Fee To You</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {[
                                ['Corrected Avg', peerOutFeeStats?.correctedAvg, '#34d399', true],
                                ['Weighted Avg',  peerOutFeeStats?.weightedAvg,  '#34d399', true],
                                ['Average',       peerOutFeeStats?.avg,           null,      false],
                                ['Std Dev',       peerOutFeeStats?.std,           null,      false],
                                ['Min',           peerOutFeeStats?.min,           null,      false],
                                ['Max',           peerOutFeeStats?.max,           null,      false],
                                ['Median',        peerOutFeeStats?.median,        null,      false],
                                ...(!isNodeLookup ? [['Peer Fee To You', peerFeeRate, null, false]] : []),
                            ].map(([key, val, color, big]) => (
                                <div key={key}>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{key}</div>
                                    <div
                                        className={big ? 'text-lg font-bold' : 'text-base font-semibold'}
                                        style={{ color: color ?? 'var(--text-primary)' }}
                                    >
                                        {val !== null && val !== undefined ? `${Number(val).toFixed(0)} ppm` : '—'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fees other peers set to this peer */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: subBg }}>
                        <p className="text-xs uppercase tracking-widest text-fuchsia-400 mb-3">Fees Other Peers Set To It</p>
                        {peerFeeLoading ? (
                            <div className="text-sm animate-pulse text-indigo-400">Loading peer network fees…</div>
                        ) : peerFeeError ? (
                            <div className="text-sm" style={{ color: 'var(--error-text)' }}>{peerFeeError}</div>
                        ) : peerFeeStats ? (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {[
                                    ['Corrected Avg', peerFeeStats.correctedAvg, '#e879f9', true],
                                    ['Weighted Avg',  peerFeeStats.weightedAvg,  '#e879f9', true],
                                    ['Average',       peerFeeStats.avg,           null,      false],
                                    ['Std Dev',       peerFeeStats.std,           null,      false],
                                    ['Min',           peerFeeStats.min,           null,      false],
                                    ['Max',           peerFeeStats.max,           null,      false],
                                    ['Median',        peerFeeStats.median,        null,      false],
                                    ...(!isNodeLookup ? [['Your Fee To Peer', myFeeRate, null, false]] : []),
                                ].map(([key, val, color, big]) => (
                                    <div key={key}>
                                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{key}</div>
                                        <div
                                            className={big ? 'text-lg font-bold' : 'text-base font-semibold'}
                                            style={{ color: color ?? 'var(--text-primary)' }}
                                        >
                                            {val !== null && val !== undefined ? `${Number(val).toFixed(0)} ppm` : '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No peer network fee data available.</div>
                        )}
                    </div>
                </div>

                {/* ── Histograms ───────────────────────────────────────────── */}
                <div className="mt-6 grid grid-cols-1 gap-6">
                    <HistogramChart
                        values={peerFeeSeries.incoming}
                        zoom={inboundZoom}
                        onZoom={setInboundZoom}
                        onResetZoom={() => setInboundZoom(null)}
                        marker={myFeeRate}
                        label="Inbound Fees To Peer (other nodes → peer)"
                        accentColor="#34d399"
                        darkMode={darkMode}
                    />
                    <HistogramChart
                        values={peerFeeSeries.outgoing}
                        zoom={outboundZoom}
                        onZoom={setOutboundZoom}
                        onResetZoom={() => setOutboundZoom(null)}
                        marker={peerFeeRate}
                        label="Outbound Fees From Peer (peer → other nodes)"
                        accentColor="#f472b6"
                        darkMode={darkMode}
                    />
                </div>

                {/* ── Comparison Bars ──────────────────────────────────────── */}
                <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: subBg }}>
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <p className="text-xs uppercase tracking-widest text-indigo-400">Comparison</p>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            Out / In Ratio:{' '}
                            <span className="text-indigo-400">
                                {outFee && inFee ? (outFee / inFee).toFixed(2) : '—'}x
                            </span>
                        </div>
                    </div>
                    <div className="space-y-3 text-xs">
                        {[
                            ...(!isNodeLookup ? [
                                ['Your Fee (Outbound)',         outFee,    maxOut, '#10b981', 'text-emerald-400'],
                                ['Peer Fee To You (Incoming)',  inFee,     maxIn,  '#e879f9', 'text-fuchsia-400']
                            ] : []),
                            ['Network Avg Fees To Peer',   networkIn, maxOut, '#6366f1', 'text-indigo-400'],
                            ['Network Avg Fees From Peer', networkOut,maxIn,  '#f59e0b', 'text-amber-400'],
                        ].map(([label, val, max, color, textClass]) => (
                            <div key={label}>
                                <div className="flex justify-between mb-1">
                                    <span className={`font-semibold ${textClass}`}>{label}</span>
                                    <span className="font-mono">{val ? `${val.toFixed(0)} ppm` : '—'}</span>
                                </div>
                                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                                    <div style={{ width: `${max > 0 ? (val / max) * 100 : 0}%`, backgroundColor: color }} className="h-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* ── Peer Channels Table ──────────────────────────────────── */}
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Peer's Channels</p>
                        {peerChannels.length > 0 && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: darkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', color: '#6366f1' }}
                            >
                                {peerChannels.length} channel{peerChannels.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {peerFeeLoading ? (
                        <div className="text-sm animate-pulse text-indigo-400 py-4">Loading peer channels…</div>
                    ) : peerChannels.length === 0 ? (
                        <div className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>
                            No channel data available.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ backgroundColor: subBg }}>
                                        {PEER_COLS.map(({ key, label, tip }) => {
                                            const isActive = peerChanSort.col === key;
                                            return (
                                                <th
                                                    key={key}
                                                    title={tip}
                                                    onClick={() =>
                                                        setPeerChanSort((prev) =>
                                                            prev.col === key
                                                                ? { col: key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
                                                                : { col: key, dir: 'desc' }
                                                        )
                                                    }
                                                    style={{
                                                        ...thStyle,
                                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                                    {sortedPeerChannels.map((ch, i) => {
                                        const alias = peerChannelAliases[ch.otherPub];
                                        const shortPub = ch.otherPub.length > 10 ? `…${ch.otherPub.slice(-8)}` : ch.otherPub;
                                        const isOurNode = myPubkey && ch.otherPub === myPubkey;
                                        const isOurPeer = !isOurNode && ourPeerPubkeys?.has(ch.otherPub);
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
                                                        {isOurNode && (
                                                            <span className="ml-1 text-[10px]" style={{ color: '#6366f1', background: 'rgba(99,102,241,0.15)', borderRadius: 4, padding: '1px 5px' }}>you</span>
                                                        )}
                                                        {isOurPeer && (
                                                            <span className="ml-1 text-[10px]" style={{ color: '#10b981', background: 'rgba(16,185,129,0.15)', borderRadius: 4, padding: '1px 5px' }}>our peer</span>
                                                        )}
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChannelFeeModal;
