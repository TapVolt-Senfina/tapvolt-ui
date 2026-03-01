import React, { useState, useCallback, useMemo, useEffect } from 'react';
import SimpleChart from '../components/SimpleChart';

// ─── helpers ────────────────────────────────────────────────────────────────

const PERIODS = [
    { key: 'day', label: 'Day', seconds: 86400 },
    { key: 'week', label: 'Week', seconds: 86400 * 7 },
    { key: 'month', label: 'Month', seconds: 86400 * 30 },
    { key: 'year', label: 'Year', seconds: 86400 * 365 },
    { key: 'all', label: 'All', seconds: null },
];

const fmtSats = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString();
};

const fmtMsat = (n) => {
    const num = Number(n) || 0;
    return `${num.toLocaleString()} msat`;
};

const fmtPpm = (feeSats, amtSats) => {
    const fee = Number(feeSats) || 0;
    const amt = Number(amtSats) || 0;
    if (!amt) return '—';
    return `${Math.round((fee / amt) * 1_000_000)} ppm`;
};

const shortChan = (id) => {
    if (!id) return '—';
    const s = String(id);
    return s.length > 10 ? `…${s.slice(-8)}` : s;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getBucketKey = (tsSec, period) => {
    const d = new Date(tsSec * 1000);
    if (period === 'day') return `${d.getUTCHours().toString().padStart(2, '00')}:00`;
    if (period === 'week' || period === 'month') return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    if (period === 'year') return MONTHS[d.getUTCMonth()];
    // all — month + short year so multi-year data stays readable
    return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)}`;
};

const buildBuckets = (forwards, period, valueKey) => {
    // Pre-fill buckets in strict chronological order so chart always goes L→R
    const map = new Map();
    const nowSec = Math.floor(Date.now() / 1000);
    const periodDef = PERIODS.find((p) => p.key === period);

    let startSec = nowSec - (periodDef?.seconds ?? 86400 * 7);
    if (periodDef?.seconds === null) {
        // "all" — find oldest forward, go 1 day before it
        let oldest = nowSec;
        for (const f of forwards) {
            const ts = Number(f.timestamp ?? 0);
            if (ts > 0 && ts < oldest) oldest = ts;
        }
        startSec = oldest - 86400;
    }

    const startD = new Date(startSec * 1000);
    const endD = new Date(nowSec * 1000);

    if (period === 'day') {
        for (let h = 0; h < 24; h++) {
            map.set(`${h.toString().padStart(2, '0')}:00`, 0);
        }
    } else if (period === 'week' || period === 'month') {
        // One bucket per calendar day, oldest → newest
        const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate()));
        while (cur <= endD) {
            map.set(`${cur.getUTCMonth() + 1}/${cur.getUTCDate()}`, 0);
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
    } else if (period === 'year') {
        // one bucket per calendar month, oldest → newest
        const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1));
        while (cur <= endD) {
            map.set(MONTHS[cur.getUTCMonth()], 0);
            cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
    } else {
        // all — one bucket per month with year suffix, oldest → newest
        const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1));
        while (cur <= endD) {
            map.set(`${MONTHS[cur.getUTCMonth()]} '${String(cur.getUTCFullYear()).slice(-2)}`, 0);
            cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
    }

    // Accumulate values into pre-ordered buckets
    forwards.forEach((f) => {
        const ts = Number(f.timestamp ?? 0);
        const key = getBucketKey(ts, period);
        if (map.has(key)) map.set(key, map.get(key) + (Number(f[valueKey]) || 0));
    });

    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
};

// ─── stat card ──────────────────────────────────────────────────────────────

const StatCard = ({ title, value, sub, color = '#6366f1', darkMode }) => (
    <div
        className="rounded-xl p-5 flex flex-col gap-1 transition-colors duration-300"
        style={{
            backgroundColor: 'var(--bg-card)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
        }}
    >
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            {title}
        </p>
        <p className="text-2xl font-bold" style={{ color }}>
            {value}
        </p>
        {sub && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
);

// ─── main page ──────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 20;

const RoutingPage = ({ lnc, darkMode, nodeChannels = [] }) => {
    // chanId (string) → { remotePubkey, alias }
    const [chanAliasMap, setChanAliasMap] = useState({});
    const [period, setPeriod] = useState('week');
    const [forwards, setForwards] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);

    // ── fetch ──────────────────────────────────────────────────────────────────
    const fetchForwards = useCallback(async (periodKey) => {
        if (!lnc?.lnd?.lightning) {
            setError('Node not connected.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setForwards([]);
        setPage(0);

        try {
            const periodDef = PERIODS.find((p) => p.key === periodKey);
            const endTime = Math.floor(Date.now() / 1000);
            const startTime = periodDef?.seconds === null ? 0 : endTime - (periodDef?.seconds || 86400 * 7);

            const response = await lnc.lnd.lightning.forwardingHistory({
                start_time: startTime.toString(),
                end_time: endTime.toString(),
                num_max_events: 5000,
            });

            const events = Array.isArray(response?.forwardingEvents)
                ? response.forwardingEvents
                : [];

            // Sort newest first
            events.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
            setForwards(events);
        } catch (err) {
            console.error('forwardingHistory error:', err);
            setError(err.message || 'Failed to fetch forwarding history.');
        } finally {
            setIsLoading(false);
        }
    }, [lnc]);

    // Build chanId → remotePubkey map from known channels, then fetch aliases
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
            // Merge alias back into chanMap
            Object.values(chanMap).forEach((entry) => {
                entry.alias = pubkeyAlias[entry.remotePubkey] || '';
            });
            setChanAliasMap({ ...chanMap });
        });
    }, [lnc, nodeChannels]);

    useEffect(() => {
        fetchForwards(period);
    }, [period, fetchForwards]);

    // ── derived stats ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const totalForwards = forwards.length;
        const totalVolume = forwards.reduce((s, f) => s + (Number(f.amt_in || f.amtIn) || 0), 0);
        const totalFee = forwards.reduce((s, f) => s + (Number(f.fee || f.feeMsat ? Number(f.fee_msat || f.feeMsat || 0) / 1000 : 0) || Number(f.fee) || 0), 0);
        const avgPpm = totalVolume ? Math.round((totalFee / totalVolume) * 1_000_000) : 0;
        return { totalForwards, totalVolume, totalFee, avgPpm };
    }, [forwards]);

    // normalise field names (lnc may return camelCase)
    const norm = (f) => ({
        timestamp: Number(f.timestamp || f.timestampNs?.slice?.(0, 10) || 0),
        chanIdIn: f.chan_id_in || f.chanIdIn || '',
        chanIdOut: f.chan_id_out || f.chanIdOut || '',
        amtIn: Number(f.amt_in || f.amtIn || 0),
        amtOut: Number(f.amt_out || f.amtOut || 0),
        amtInMsat: Number(f.amt_in_msat || f.amtInMsat || 0),
        amtOutMsat: Number(f.amt_out_msat || f.amtOutMsat || 0),
        fee: Number(f.fee || 0),
        feeMsat: Number(f.fee_msat || f.feeMsat || 0),
    });

    const normForwards = useMemo(() => forwards.map(norm), [forwards]);  // eslint-disable-line react-hooks/exhaustive-deps

    // ── chart data ─────────────────────────────────────────────────────────────
    const feeChartData = useMemo(
        () => buildBuckets(normForwards.map((f) => ({ ...f, timestamp: f.timestamp, fee_msat: f.feeMsat })), period, 'fee_msat'),
        [normForwards, period]
    );

    const volChartData = useMemo(
        () => buildBuckets(normForwards.map((f) => ({ ...f, timestamp: f.timestamp, amt_in: f.amtIn })), period, 'amt_in'),
        [normForwards, period]
    );

    // ── top routes ─────────────────────────────────────────────────────────────
    const topRoutes = useMemo(() => {
        const map = new Map();
        normForwards.forEach((f) => {
            const key = `${f.chanIdIn}→${f.chanIdOut}`;
            if (!map.has(key)) map.set(key, { chanIdIn: f.chanIdIn, chanIdOut: f.chanIdOut, count: 0, volume: 0, fee: 0 });
            const r = map.get(key);
            r.count++;
            r.volume += f.amtIn;
            r.fee += f.fee;
        });
        return Array.from(map.values()).sort((a, b) => b.fee - a.fee).slice(0, 20);
    }, [normForwards]);

    // ── alias lookup helper ────────────────────────────────────────────────────
    // Returns "Alias" if known, otherwise falls back to "…XXXXXXXX"
    const chanLabel = (chanId) => {
        const entry = chanAliasMap[String(chanId)];
        if (entry?.alias) return entry.alias;
        return shortChan(chanId);
    };

    // ── pagination ─────────────────────────────────────────────────────────────
    const totalPages = Math.ceil(normForwards.length / ROWS_PER_PAGE);
    const pageRows = normForwards.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

    // ── shared styles ──────────────────────────────────────────────────────────
    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };

    const thStyle = {
        padding: '8px 12px',
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
        padding: '7px 12px',
        fontSize: 12,
        fontFamily: 'monospace',
        color: 'var(--text-primary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        whiteSpace: 'nowrap',
    };

    const btnStyle = (active) => ({
        padding: '6px 18px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        transition: 'all 0.2s',
        background: active ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        color: active ? '#fff' : 'var(--text-secondary)',
        boxShadow: active ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
    });

    return (
        <div className="p-6 space-y-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Period selector + refresh */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Routing Analytics
                </h2>
                <div className="flex items-center gap-2">
                    {PERIODS.map((p) => (
                        <button key={p.key} style={btnStyle(period === p.key)} onClick={() => { setPeriod(p.key); }}>
                            {p.label}
                        </button>
                    ))}
                    <button
                        onClick={() => fetchForwards(period)}
                        disabled={isLoading}
                        style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: isLoading ? 'not-allowed' : 'pointer', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                            background: 'transparent', color: 'var(--text-secondary)', opacity: isLoading ? 0.6 : 1,
                        }}
                    >
                        {isLoading ? '⏳' : '↻'} Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-text)' }}>
                    {error}
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className="flex items-center gap-3 py-6" style={{ color: 'var(--text-secondary)' }}>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading forwarding history…
                </div>
            )}

            {!isLoading && !error && (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title="Total Forwards" value={stats.totalForwards.toLocaleString()} darkMode={darkMode} color="#6366f1" />
                        <StatCard title="Volume (sats)" value={fmtSats(stats.totalVolume)} darkMode={darkMode} color="#10b981" />
                        <StatCard title="Fees Earned" value={`${fmtSats(stats.totalFee)} sats`} darkMode={darkMode} color="#f59e0b"
                            sub={stats.totalFee ? `≈ ${(stats.totalFee * 1000).toLocaleString()} msat` : undefined} />
                        <StatCard title="Avg Fee Rate" value={`${stats.avgPpm} ppm`} darkMode={darkMode} color="#ec4899" />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-xl p-5 transition-colors duration-300" style={cardStyle}>
                            <SimpleChart
                                data={feeChartData}
                                height={260}
                                color="#f59e0b"
                                label="Fees Earned (msat)"
                                formatValue={(v) => `${Math.round(v).toLocaleString()} msat`}
                                darkMode={darkMode}
                                type="area"
                            />
                        </div>
                        <div className="rounded-xl p-5 transition-colors duration-300" style={cardStyle}>
                            <SimpleChart
                                data={volChartData}
                                height={260}
                                color="#6366f1"
                                label="Volume Routed (sats)"
                                formatValue={(v) => fmtSats(v)}
                                darkMode={darkMode}
                                type="bar"
                            />
                        </div>
                    </div>

                    {/* Top Routes */}
                    {topRoutes.length > 0 && (
                        <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                            <div className="p-4 flex items-center justify-between">
                                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Top Routes by Fee Earned</h3>
                                <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: darkMode ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                                    {topRoutes.length} route{topRoutes.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            {['In Channel', 'Out Channel', 'Forwards', 'Volume (sats)', 'Fee (sats)', 'Avg Fee ppm'].map((h) => (
                                                <th key={h} style={thStyle}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topRoutes.map((r, i) => (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                                                <td style={{ ...tdStyle, color: '#6366f1' }} title={r.chanIdIn}>{chanLabel(r.chanIdIn)}</td>
                                                <td style={{ ...tdStyle, color: '#10b981' }} title={r.chanIdOut}>{chanLabel(r.chanIdOut)}</td>
                                                <td style={tdStyle}>{r.count.toLocaleString()}</td>
                                                <td style={tdStyle}>{fmtSats(r.volume)}</td>
                                                <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 700 }}>{fmtSats(r.fee)}</td>
                                                <td style={tdStyle}>{fmtPpm(r.fee, r.volume)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* All Forwards Table */}
                    <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                        <div className="p-4 flex items-center justify-between flex-wrap gap-2">
                            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>All Forwards</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {normForwards.length} events
                                </span>
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`, background: 'transparent', color: 'var(--text-secondary)', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
                                        >‹</button>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{page + 1}/{totalPages}</span>
                                        <button
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`, background: 'transparent', color: 'var(--text-secondary)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                                        >›</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {normForwards.length === 0 ? (
                            <p className="px-4 pb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                No forwarding events found in the selected period.
                            </p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            {['Time', 'In Channel', 'Out Channel', 'Amt In (sats)', 'Amt Out (sats)', 'Amt In (msat)', 'Fee (sats)', 'Fee (msat)'].map((h) => (
                                                <th key={h} style={thStyle}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((f, i) => {
                                            const date = f.timestamp
                                                ? new Date(f.timestamp * 1000).toLocaleString()
                                                : '—';
                                            return (
                                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                                                    <td style={{ ...tdStyle, fontFamily: 'inherit', fontSize: 11 }}>{date}</td>
                                                    <td style={{ ...tdStyle, color: '#6366f1' }} title={f.chanIdIn}>{chanLabel(f.chanIdIn)}</td>
                                                    <td style={{ ...tdStyle, color: '#10b981' }} title={f.chanIdOut}>{chanLabel(f.chanIdOut)}</td>
                                                    <td style={tdStyle}>{f.amtIn.toLocaleString()}</td>
                                                    <td style={tdStyle}>{f.amtOut.toLocaleString()}</td>
                                                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{fmtMsat(f.amtInMsat)}</td>
                                                    <td style={{ ...tdStyle, color: '#f59e0b', fontWeight: 700 }}>{f.fee.toLocaleString()}</td>
                                                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{f.feeMsat.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default RoutingPage;
