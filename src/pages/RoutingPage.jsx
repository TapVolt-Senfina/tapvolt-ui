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

const fmtMsat = (n) => `${(Number(n) || 0).toLocaleString()} msat`;

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
    if (period === 'day') return `${d.getUTCHours().toString().padStart(2, '0')}:00`;
    if (period === 'week' || period === 'month') return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    if (period === 'year') return MONTHS[d.getUTCMonth()];
    return `${MONTHS[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)}`;
};

const prefillBuckets = (period, forwards) => {
    const map = new Map();
    const nowSec = Math.floor(Date.now() / 1000);
    const periodDef = PERIODS.find((p) => p.key === period);

    let startSec = nowSec - (periodDef?.seconds ?? 86400 * 7);
    if (periodDef?.seconds === null) {
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
        for (let h = 0; h < 24; h++) map.set(`${h.toString().padStart(2, '0')}:00`, 0);
    } else if (period === 'week' || period === 'month') {
        const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate()));
        while (cur <= endD) { map.set(`${cur.getUTCMonth() + 1}/${cur.getUTCDate()}`, 0); cur.setUTCDate(cur.getUTCDate() + 1); }
    } else if (period === 'year') {
        const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1));
        while (cur <= endD) { map.set(MONTHS[cur.getUTCMonth()], 0); cur.setUTCMonth(cur.getUTCMonth() + 1); }
    } else {
        const cur = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), 1));
        while (cur <= endD) {
            map.set(`${MONTHS[cur.getUTCMonth()]} '${String(cur.getUTCFullYear()).slice(-2)}`, 0);
            cur.setUTCMonth(cur.getUTCMonth() + 1);
        }
    }
    return map;
};

const buildBuckets = (forwards, period, valueKey) => {
    const map = prefillBuckets(period, forwards);
    forwards.forEach((f) => {
        const key = getBucketKey(Number(f.timestamp ?? 0), period);
        if (map.has(key)) map.set(key, map.get(key) + (Number(f[valueKey]) || 0));
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
};

const buildCountBuckets = (forwards, period) => {
    const map = prefillBuckets(period, forwards);
    forwards.forEach((f) => {
        const key = getBucketKey(Number(f.timestamp ?? 0), period);
        if (map.has(key)) map.set(key, map.get(key) + 1);
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
};

// ─── chart tabs component ────────────────────────────────────────────────────

const CHART_TABS = [
    { key: 'fees', label: '⚡ Fees Earned', color: '#f59e0b', type: 'area' },
    { key: 'volume', label: '📦 Volume', color: '#6366f1', type: 'bar' },
    { key: 'count', label: '🔁 Forwards', color: '#10b981', type: 'bar' },
];

const ChartPanel = ({ feeData, volData, countData, darkMode }) => {
    const [activeTab, setActiveTab] = useState('fees');

    const tabCfg = CHART_TABS.find((t) => t.key === activeTab);

    const dataMap = {
        fees: { data: feeData, label: 'Fees Earned (msat)', formatValue: (v) => `${Math.round(v).toLocaleString()} msat` },
        volume: { data: volData, label: 'Volume Routed (sats)', formatValue: (v) => fmtSats(v) },
        count: { data: countData, label: 'Total Forwards (count)', formatValue: (v) => `${Math.round(v)} forwards` },
    };

    const { data, label, formatValue } = dataMap[activeTab];

    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };

    return (
        <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
            {/* Tab bar */}
            <div
                className="flex items-center gap-1 px-4 pt-4 pb-0"
                style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}
            >
                {CHART_TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                padding: '8px 18px',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: 'none',
                                background: 'transparent',
                                color: isActive ? tab.color : 'var(--text-secondary)',
                                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                                marginBottom: -1,
                                transition: 'all 0.18s',
                                borderRadius: '4px 4px 0 0',
                            }}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            {/* Chart */}
            <div className="p-5">
                <SimpleChart
                    data={data}
                    height={240}
                    color={tabCfg.color}
                    label={label}
                    formatValue={formatValue}
                    darkMode={darkMode}
                    type={tabCfg.type}
                />
            </div>
        </div>
    );
};

// ─── stat card ───────────────────────────────────────────────────────────────

const StatCard = ({ title, value, sub, color = '#6366f1', darkMode, badge }) => (
    <div
        className="rounded-xl p-5 flex flex-col gap-1 transition-colors duration-300"
        style={{
            backgroundColor: 'var(--bg-card)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
        }}
    >
        <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                {title}
            </p>
            {badge && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: badge.bg, color: badge.text }}>
                    {badge.label}
                </span>
            )}
        </div>
        <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
);

// ─── P&L breakdown card ───────────────────────────────────────────────────────

const PnLCard = ({ earned, spentRebalance, spentOnchainOpen, spentOnchainClose, profit, darkMode }) => {
    const profitColor = profit >= 0 ? '#10b981' : '#ef4444';
    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };
    const divider = `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`;

    const Row = ({ label, value, color, indent, italic, note }) => (
        <div
            className="flex items-center justify-between py-2"
            style={{ borderBottom: divider, paddingLeft: indent ? 16 : 0 }}
        >
            <span className="text-sm" style={{ color: italic ? 'var(--text-secondary)' : indent ? 'var(--text-secondary)' : 'var(--text-primary)', fontStyle: italic ? 'italic' : 'normal', fontWeight: italic ? 400 : indent ? 400 : 600 }}>
                {indent ? '↳ ' : ''}{label}
                {note && <span className="ml-1 text-xs opacity-60">{note}</span>}
            </span>
            {value !== undefined && (
                <span className="text-sm font-mono font-bold" style={{ color }}>
                    {fmtSats(value)} sats
                </span>
            )}
        </div>
    );

    return (
        <div className="rounded-xl p-5 transition-colors duration-300" style={cardStyle}>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>P&amp;L Breakdown</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Node fees used to calculate Earned, Spent and Net Profit
                    </p>
                </div>
                <span className="text-sm px-3 py-1 rounded-full font-bold" style={{
                    background: profit >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: profitColor,
                }}>
                    Net {profit >= 0 ? '+' : ''}{fmtSats(profit)} sats
                </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Earned column */}
                <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: '#10b981' }}>
                        <span style={{ fontSize: 16 }}>▲</span> Earned
                    </p>
                    <Row label="Forwarding Fees" value={earned} color="#10b981" />
                    <div className="mt-3 flex items-center justify-between py-2 rounded-lg px-3" style={{ background: 'rgba(16,185,129,0.08)' }}>
                        <span className="text-sm font-bold" style={{ color: '#10b981' }}>Total Earned</span>
                        <span className="text-base font-extrabold font-mono" style={{ color: '#10b981' }}>+{fmtSats(earned)} sats</span>
                    </div>
                </div>

                {/* Spent column */}
                <div>
                    <p className="text-xs font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: '#ef4444' }}>
                        <span style={{ fontSize: 16 }}>▼</span> Spent
                    </p>
                    <Row label="Channel Opens" value={spentOnchainOpen} color="#ef4444" indent note="(on-chain fees)" />
                    <Row label="Channel Closes" value={spentOnchainClose} color="#ef4444" indent note="(on-chain fees)" />
                    <Row label="Off-chain Payments" value={spentRebalance} color="#ef4444" indent note="(payment fees)" />
                    <div className="mt-3 flex items-center justify-between py-2 rounded-lg px-3" style={{ background: 'rgba(239,68,68,0.08)' }}>
                        <span className="text-sm font-bold" style={{ color: '#ef4444' }}>Total Spent</span>
                        <span className="text-base font-extrabold font-mono" style={{ color: '#ef4444' }}>
                            -{fmtSats(spentRebalance + spentOnchainOpen + spentOnchainClose)} sats
                        </span>
                    </div>
                </div>
            </div>

            {/* Net profit bar */}
            <div className="mt-5 flex items-center justify-between p-4 rounded-xl" style={{
                background: profit >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${profit >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Net Profit (Earned − Spent)</span>
                <span className="text-2xl font-extrabold font-mono" style={{ color: profitColor }}>
                    {profit >= 0 ? '+' : ''}{fmtSats(profit)} sats
                </span>
            </div>
        </div>
    );
};

// ─── main page ────────────────────────────────────────────────────────────────

const ROWS_PER_PAGE = 20;

const RoutingPage = ({ lnc, darkMode, nodeChannels = [] }) => {
    const [chanAliasMap, setChanAliasMap] = useState({});
    const [period, setPeriod] = useState('week');
    const [forwards, setForwards] = useState([]);
    const [payments, setPayments] = useState([]);
    const [onchainTxs, setOnchainTxs] = useState({ opens: [], closes: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);

    // ── fetch ─────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async (periodKey) => {
        if (!lnc?.lnd?.lightning) { setError('Node not connected.'); return; }
        setIsLoading(true);
        setError(null);
        setForwards([]);
        setPayments([]);
        setOnchainTxs({ opens: [], closes: [] });
        setPage(0);

        const periodDef = PERIODS.find((p) => p.key === periodKey);
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = periodDef?.seconds === null ? 0 : endTime - (periodDef?.seconds || 86400 * 7);

        try {
            // 1. Forwarding history (earned fees)
            const fwdResp = await lnc.lnd.lightning.forwardingHistory({
                start_time: startTime.toString(),
                end_time: endTime.toString(),
                num_max_events: 5000,
            });
            const events = Array.isArray(fwdResp?.forwardingEvents) ? fwdResp.forwardingEvents : [];
            events.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
            setForwards(events);

            // 2. Payments (spent – off-chain rebalances)
            try {
                const pmtResp = await lnc.lnd.lightning.listPayments({
                    include_incomplete: false,
                    creation_date_start: startTime.toString(),
                    creation_date_end: endTime.toString(),
                    max_payments: 1000,
                });
                setPayments(Array.isArray(pmtResp?.payments) ? pmtResp.payments : []);
            } catch (_) { /* silently skip if not available */ }

            // 3. On-chain transactions for channel opens/closes
            //    LND: getTransactions — then cross-ref channel txids
            try {
                const txResp = await lnc.lnd.lightning.getTransactions({
                    start_height: 0,
                    end_height: -1,
                });
                const allTxs = Array.isArray(txResp?.transactions) ? txResp.transactions : [];

                // Build a txid→tx lookup for quick joining
                const txByHash = new Map();
                allTxs.forEach((tx) => {
                    const h = tx.txHash || tx.tx_hash || tx.txId || tx.txid || '';
                    if (h) txByHash.set(h, tx);
                });

                // Build set of open txids from active channels
                const openTxids = new Set(
                    nodeChannels
                        .map((ch) => (ch.channelPoint || ch.channel_point || '').split(':')[0])
                        .filter(Boolean)
                );

                // Filter within the selected time window
                const inWindow = (ts) => {
                    const t = Number(ts || 0);
                    return t >= startTime && t <= endTime;
                };

                // Opens: outgoing tx — LND totalFees is the miner fee (stored as negative amount)
                const opens = allTxs
                    .filter((tx) => openTxids.has(tx.txHash || tx.tx_hash || '') && inWindow(tx.timeStamp || tx.timestamp))
                    .map((tx) => ({ ...tx, _feeSats: Math.abs(Number(tx.totalFees || tx.total_fees || 0)) }));

                // 4. Closed channels
                //    For closes, LND reports the tx as INCOMING (settled balance arrives at wallet),
                //    so totalFees = 0 on the tx record. The real miner fee is:
                //      closeFee = localBalance - settledBalance
                //    We get this directly from closedChannels metadata.
                let closes = [];
                try {
                    let closedResp;
                    try { closedResp = await lnc.lnd.lightning.closedChannels(); }
                    catch (_) { closedResp = await lnc.lnd.lightning.closedChannels({}); }
                    const closedChans = Array.isArray(closedResp?.channels) ? closedResp.channels : [];

                    closes = closedChans
                        .map((ch) => {
                            const txid = ch.closingTxHash || ch.closing_tx_hash ||
                                ch.closingTxid || ch.closing_txid || '';
                            const tx = txByHash.get(txid) || {};
                            const ts = Number(tx.timeStamp || tx.timestamp || 0);

                            // fee = what we had locally minus what we received back
                            const localBal = Number(ch.localBalance || ch.local_balance || 0);
                            const settled = Number(ch.settledBalance || ch.settled_balance || 0);
                            const feeSats = Math.max(0, localBal - settled);

                            return {
                                ...tx,
                                // Carry closed-channel metadata for display
                                _txid: txid,
                                _feeSats: feeSats,
                                _localBal: localBal,
                                _settled: settled,
                                _closeType: ch.closeType || ch.close_type || '',
                                _blockHeight: ch.closeHeight || ch.close_height ||
                                    tx.blockHeight || tx.block_height || '',
                                txHash: txid,
                                timeStamp: ts || undefined,
                                amount: settled,
                            };
                        })
                        .filter((c) => {
                            if (!c._txid) return false;
                            const ts = Number(c.timeStamp || 0);
                            return ts === 0 || inWindow(ts);
                        });
                } catch (_) { /* closedChannels may not be available */ }

                setOnchainTxs({ opens, closes });
            } catch (_) { /* getTransactions may not be available */ }

        } catch (err) {
            console.error('forwardingHistory error:', err);
            setError(err.message || 'Failed to fetch forwarding history.');
        } finally {
            setIsLoading(false);
        }
    }, [lnc, nodeChannels]);

    // Build chanId → alias map
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

    useEffect(() => { fetchAll(period); }, [period, fetchAll]);

    // ── derived stats ─────────────────────────────────────────────────────────
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

    const normForwards = useMemo(() => forwards.map(norm), [forwards]); // eslint-disable-line react-hooks/exhaustive-deps


    const stats = useMemo(() => {
        const totalForwards = normForwards.length;
        const totalVolume = normForwards.reduce((s, f) => s + f.amtIn, 0);
        // Use feeMsat for accuracy — `fee` is a truncated integer sat value from LND
        const totalEarnedMsat = normForwards.reduce((s, f) => s + f.feeMsat, 0);
        const totalEarned = totalEarnedMsat / 1000;
        const avgPpm = totalVolume ? Math.round((totalEarned / totalVolume) * 1_000_000) : 0;

        // Spent: off-chain rebalance fees (fee field from listPayments is in sats)
        const spentRebalance = payments.reduce((s, p) => {
            const feeSats = Number(p.fee || p.feeSat || p.fee_sat || 0);
            const feeMsatVal = Number(p.feeMsat || p.fee_msat || 0);
            // prefer msat precision if available
            return s + (feeMsatVal ? feeMsatVal / 1000 : feeSats);
        }, 0);

        // On-chain: opens use totalFees; closes use pre-computed _feeSats
        const spentOnchainOpen = onchainTxs.opens.reduce((s, tx) => s + (Number(tx._feeSats || 0)), 0);
        const spentOnchainClose = onchainTxs.closes.reduce((s, tx) => s + (Number(tx._feeSats || 0)), 0);

        const totalSpent = spentRebalance + spentOnchainOpen + spentOnchainClose;
        const profit = totalEarned - totalSpent;

        return { totalForwards, totalVolume, totalEarned, totalEarnedMsat, spentRebalance, spentOnchainOpen, spentOnchainClose, totalSpent, profit, avgPpm };
    }, [normForwards, payments, onchainTxs]);

    // ── chart data ────────────────────────────────────────────────────────────
    const feeChartData = useMemo(
        () => buildBuckets(normForwards.map((f) => ({ timestamp: f.timestamp, fee_msat: f.feeMsat })), period, 'fee_msat'),
        [normForwards, period]
    );
    const volChartData = useMemo(
        () => buildBuckets(normForwards.map((f) => ({ timestamp: f.timestamp, amt_in: f.amtIn })), period, 'amt_in'),
        [normForwards, period]
    );
    const countChartData = useMemo(() => buildCountBuckets(normForwards, period), [normForwards, period]);

    // ── top routes ────────────────────────────────────────────────────────────
    const topRoutes = useMemo(() => {
        const map = new Map();
        normForwards.forEach((f) => {
            const key = `${f.chanIdIn}→${f.chanIdOut}`;
            if (!map.has(key)) map.set(key, { chanIdIn: f.chanIdIn, chanIdOut: f.chanIdOut, count: 0, volume: 0, fee: 0 });
            const r = map.get(key);
            r.count++; r.volume += f.amtIn; r.fee += f.fee;
        });
        return Array.from(map.values()).sort((a, b) => b.fee - a.fee).slice(0, 20);
    }, [normForwards]);

    const chanLabel = (chanId) => {
        const entry = chanAliasMap[String(chanId)];
        return entry?.alias || shortChan(chanId);
    };

    // ── pagination ────────────────────────────────────────────────────────────
    const totalPages = Math.ceil(normForwards.length / ROWS_PER_PAGE);
    const pageRows = normForwards.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

    // ── shared styles ─────────────────────────────────────────────────────────
    const cardStyle = {
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    };
    const thStyle = {
        padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
        whiteSpace: 'nowrap',
    };
    const tdStyle = {
        padding: '7px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        whiteSpace: 'nowrap',
    };
    const btnStyle = (active) => ({
        padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', border: 'none', transition: 'all 0.2s',
        background: active ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        color: active ? '#fff' : 'var(--text-secondary)',
        boxShadow: active ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
    });

    return (
        <div className="p-6 space-y-8" style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Routing Analytics</h2>
                <div className="flex items-center gap-2">
                    {PERIODS.map((p) => (
                        <button key={p.key} style={btnStyle(period === p.key)} onClick={() => setPeriod(p.key)}>
                            {p.label}
                        </button>
                    ))}
                    <button
                        onClick={() => fetchAll(period)}
                        disabled={isLoading}
                        style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                            background: 'transparent', color: 'var(--text-secondary)', opacity: isLoading ? 0.6 : 1,
                        }}
                    >
                        {isLoading ? '⏳' : '↻'} Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-text)' }}>
                    {error}
                </div>
            )}

            {isLoading && (
                <div className="flex items-center gap-3 py-6" style={{ color: 'var(--text-secondary)' }}>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading analytics…
                </div>
            )}

            {!isLoading && !error && (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard title="Total Forwards" value={stats.totalForwards.toLocaleString()} darkMode={darkMode} color="#6366f1" />
                        <StatCard title="Volume Routed" value={`${fmtSats(stats.totalVolume)} sats`} darkMode={darkMode} color="#10b981" />
                        <StatCard title="Avg Fee Rate" value={`${stats.avgPpm} ppm`} darkMode={darkMode} color="#ec4899" />
                        <StatCard
                            title="Fees Earned"
                            value={`${fmtSats(stats.totalEarned)} sats`}
                            darkMode={darkMode}
                            color="#10b981"
                            badge={{ label: '▲ Earned', bg: 'rgba(16,185,129,0.15)', text: '#10b981' }}
                            sub={stats.totalEarnedMsat ? `${stats.totalEarnedMsat.toLocaleString()} msat` : undefined}
                        />
                        <StatCard
                            title="Fees Spent"
                            value={`${fmtSats(stats.totalSpent)} sats`}
                            darkMode={darkMode}
                            color="#ef4444"
                            badge={{ label: '▼ Spent', bg: 'rgba(239,68,68,0.15)', text: '#ef4444' }}
                            sub={`Opens ${fmtSats(stats.spentOnchainOpen)} · Closes ${fmtSats(stats.spentOnchainClose)} · Offchain Payments ${fmtSats(stats.spentRebalance)}`}
                        />
                        <StatCard
                            title="Net Profit"
                            value={`${stats.profit >= 0 ? '+' : ''}${fmtSats(stats.profit)} sats`}
                            darkMode={darkMode}
                            color={stats.profit >= 0 ? '#10b981' : '#ef4444'}
                            badge={{
                                label: stats.profit >= 0 ? '▲ Profit' : '▼ Loss',
                                bg: stats.profit >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                text: stats.profit >= 0 ? '#10b981' : '#ef4444',
                            }}
                            sub="Earned − Spent"
                        />
                    </div>

                    {/* P&L Breakdown */}
                    <PnLCard
                        earned={stats.totalEarned}
                        spentRebalance={stats.spentRebalance}
                        spentOnchainOpen={stats.spentOnchainOpen}
                        spentOnchainClose={stats.spentOnchainClose}
                        profit={stats.profit}
                        darkMode={darkMode}
                    />

                    {/* Charts with tabs */}
                    <ChartPanel feeData={feeChartData} volData={volChartData} countData={countChartData} darkMode={darkMode} />

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
                                        <tr>{['In Channel', 'Out Channel', 'Forwards', 'Volume (sats)', 'Fee (sats)', 'Avg Fee ppm'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
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

                    {/* On-chain channel transactions detail */}
                    {(onchainTxs.opens.length > 0 || onchainTxs.closes.length > 0) && (
                        <div className="rounded-xl overflow-hidden transition-colors duration-300" style={cardStyle}>
                            <div className="p-4">
                                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>On-chain Channel Fees</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Channel open and close transactions in the selected period</p>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>{['Type', 'Txid', 'Block', 'Amount (sats)', 'Fees Paid (sats)', 'Time'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ...onchainTxs.opens.map((tx) => ({ ...tx, _type: 'Open' })),
                                            ...onchainTxs.closes.map((tx) => ({ ...tx, _type: 'Close' })),
                                        ]
                                            // Always newest first
                                            .sort((a, b) => Number(b.timeStamp || b.timestamp || 0) - Number(a.timeStamp || a.timestamp || 0))
                                            .map((tx, i) => {
                                                const txid = tx._txid || tx.txHash || tx.tx_hash || '—';
                                                // For opens: miner fee from totalFees (outgoing tx)
                                                // For closes: pre-computed from localBalance - settledBalance
                                                const fees = Number(tx._feeSats || 0);
                                                const amt = Number(tx.amount || 0);
                                                const ts = Number(tx.timeStamp || tx.timestamp || 0);
                                                const date = ts ? new Date(ts * 1000).toLocaleString() : '—';
                                                const block = tx._blockHeight || tx.blockHeight || tx.block_height || '—';
                                                const isOpen = tx._type === 'Open';
                                                return (
                                                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                                                        <td style={{ ...tdStyle, fontFamily: 'inherit' }}>
                                                            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                                                                background: isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                                color: isOpen ? '#10b981' : '#ef4444',
                                                            }}>{tx._type}</span>
                                                            {tx._closeType ? (
                                                                <span className="ml-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                    {String(tx._closeType).replace(/_/g, ' ').toLowerCase()}
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                        <td style={{ ...tdStyle, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                            title={txid}>{txid && txid !== '—' ? `${txid.slice(0, 8)}…${txid.slice(-6)}` : '—'}</td>
                                                        <td style={tdStyle}>{block}</td>
                                                        <td style={tdStyle}>{fmtSats(amt)}</td>
                                                        <td style={{ ...tdStyle, color: fees > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: fees > 0 ? 700 : 400 }}>
                                                            {fees > 0 ? fmtSats(fees) : '—'}
                                                        </td>
                                                        <td style={{ ...tdStyle, fontFamily: 'inherit', fontSize: 11 }}>{date}</td>
                                                    </tr>
                                                );
                                            })}
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
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{normForwards.length} events</span>
                                {totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                                            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`, background: 'transparent', color: 'var(--text-secondary)', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>‹</button>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{page + 1}/{totalPages}</span>
                                        <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                                            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`, background: 'transparent', color: 'var(--text-secondary)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>›</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {normForwards.length === 0 ? (
                            <p className="px-4 pb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No forwarding events found in the selected period.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>{['Time', 'In Channel', 'Out Channel', 'Amt In (sats)', 'Amt Out (sats)', 'Amt In (msat)', 'Fee (sats)', 'Fee (msat)'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((f, i) => {
                                            const date = f.timestamp ? new Date(f.timestamp * 1000).toLocaleString() : '—';
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
