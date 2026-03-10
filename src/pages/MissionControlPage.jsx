import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Buffer } from 'buffer';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const shortHex = (s, n = 10) => {
  if (!s) return '—';
  const v = String(s);
  if (v.length <= n) return v;
  return `${v.slice(0, Math.max(4, Math.floor(n / 2)))}…${v.slice(-Math.max(4, Math.floor(n / 2)))}`;
};

const toNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return 0;
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const fmtMsat = (n) => {
  const num = toNum(n);
  if (!num) return '0';
  if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return Math.round(num).toLocaleString();
};

const ageLabel = (seconds) => {
  if (!seconds || seconds < 0) return '—';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
};

const StatCard = ({ title, value, sub, color, darkMode }) => (
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
    <p className="text-2xl font-bold" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
    {sub && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
  </div>
);

const ChartCard = ({ title, subtitle, darkMode, children, right }) => (
  <div
    className="rounded-xl overflow-hidden transition-colors duration-300"
    style={{
      backgroundColor: 'var(--bg-card)',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
      boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
    }}
  >
    <div
      className="p-4 border-b flex items-start justify-between gap-3"
      style={{ borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}
    >
      <div>
        <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const makeDownload = (filename, obj) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const MissionControlPage = ({ lnc, darkMode }) => {
  const [mc, setMc] = useState(null);
  const [localPub, setLocalPub] = useState('');
  const [aliasMap, setAliasMap] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [peerMode, setPeerMode] = useState('local_out');
  const [pairQuery, setPairQuery] = useState('');
  const [pairSort, setPairSort] = useState('score');

  const bytesToHex = useCallback((value) => {
    if (!value) return '';
    try {
      if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
      if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (/^[0-9a-f]+$/.test(v)) return v;
        return Buffer.from(value, 'base64').toString('hex');
      }
    } catch (err) {
      console.error('bytesToHex failed:', err);
    }
    return '';
  }, []);

  useEffect(() => {
    let active = true;
    const fetchInfo = async () => {
      if (!lnc?.lnd?.lightning?.getInfo) return;
      try {
        const info = await lnc.lnd.lightning.getInfo({});
        if (active) setLocalPub(String(info?.identityPubkey || info?.identity_pubkey || '').toLowerCase());
      } catch (err) {
        console.warn('getInfo failed:', err);
      }
    };
    fetchInfo();
    return () => {
      active = false;
    };
  }, [lnc]);

  const fetchMissionControl = useCallback(async () => {
    if (!lnc?.lnd?.router?.queryMissionControl) {
      setError('routerrpc QueryMissionControl is not available. Check LNC permissions and router service.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await lnc.lnd.router.queryMissionControl({});
      setMc(resp || { pairs: [] });
    } catch (err) {
      console.error('queryMissionControl failed:', err);
      setError(err?.message || 'Failed to query mission control.');
      setMc(null);
    } finally {
      setIsLoading(false);
    }
  }, [lnc]);

  const normalizedPairs = useMemo(() => {
    const pairs = Array.isArray(mc?.pairs) ? mc.pairs : [];
    const now = Date.now() / 1000;
    return pairs.map((p) => {
      const from = bytesToHex(p.node_from || p.nodeFrom);
      const to = bytesToHex(p.node_to || p.nodeTo);
      const h = p.history || p.pairHistory || {};
      const failTime = toNum(h.fail_time ?? h.failTime);
      const successTime = toNum(h.success_time ?? h.successTime);
      const failAmtSat = toNum(h.fail_amt_sat ?? h.failAmtSat);
      const successAmtSat = toNum(h.success_amt_sat ?? h.successAmtSat);
      const failAmtMsat = toNum(h.fail_amt_msat ?? h.failAmtMsat) || (failAmtSat ? failAmtSat * 1000 : 0);
      const successAmtMsat = toNum(h.success_amt_msat ?? h.successAmtMsat) || (successAmtSat ? successAmtSat * 1000 : 0);
      const successAge = successTime ? Math.max(0, now - successTime) : 0;
      const failAge = failTime ? Math.max(0, now - failTime) : 0;
      const successWeight = successAmtMsat ? Math.log10(successAmtMsat + 1) : 0;
      const failWeight = failAmtMsat ? Math.log10(failAmtMsat + 1) : 0;
      const successScore = successTime ? (1 / (1 + successAge / 86400)) * successWeight : 0;
      const failPenalty = failTime ? (1 / (1 + failAge / 86400)) * failWeight : 0;
      const score = successScore - failPenalty * 0.6;
      return {
        from,
        to,
        failTime,
        successTime,
        failAmtSat,
        successAmtSat,
        failAmtMsat,
        successAmtMsat,
        successAge,
        failAge,
        score,
      };
    });
  }, [mc, bytesToHex]);

  const kpis = useMemo(() => {
    const total = normalizedPairs.length;
    const withSuccess = normalizedPairs.filter((p) => p.successTime > 0).length;
    const withFail = normalizedPairs.filter((p) => p.failTime > 0).length;
    const recentSuccess = normalizedPairs.filter((p) => p.successAge && p.successAge <= 7 * 86400).length;
    const recentFail = normalizedPairs.filter((p) => p.failAge && p.failAge <= 7 * 86400).length;
    return { total, withSuccess, withFail, recentSuccess, recentFail };
  }, [normalizedPairs]);

  const recencyBuckets = useMemo(() => {
    const buckets = [
      { label: '≤1h', max: 3600 },
      { label: '≤24h', max: 86400 },
      { label: '≤7d', max: 7 * 86400 },
      { label: '≤30d', max: 30 * 86400 },
      { label: '>30d', max: Number.POSITIVE_INFINITY },
    ];
    const data = buckets.map((b) => ({ label: b.label, success: 0, fail: 0 }));
    normalizedPairs.forEach((p) => {
      if (p.successAge) {
        const i = buckets.findIndex((b) => p.successAge <= b.max);
        if (i >= 0) data[i].success += 1;
      }
      if (p.failAge) {
        const i = buckets.findIndex((b) => p.failAge <= b.max);
        if (i >= 0) data[i].fail += 1;
      }
    });
    return data;
  }, [normalizedPairs]);

  const statusPie = useMemo(() => {
    let successOnly = 0;
    let failOnly = 0;
    let both = 0;
    let none = 0;
    normalizedPairs.forEach((p) => {
      const s = p.successTime > 0;
      const f = p.failTime > 0;
      if (s && f) both += 1;
      else if (s) successOnly += 1;
      else if (f) failOnly += 1;
      else none += 1;
    });
    return [
      { name: 'Success only', value: successOnly, color: '#10b981' },
      { name: 'Fail only', value: failOnly, color: '#f59e0b' },
      { name: 'Both', value: both, color: '#6366f1' },
      { name: 'No data', value: none, color: '#94a3b8' },
    ];
  }, [normalizedPairs]);

  const scatterData = useMemo(() => {
    const sample = [];
    const step = Math.max(1, Math.floor(normalizedPairs.length / 500));
    for (let i = 0; i < normalizedPairs.length; i += step) {
      const p = normalizedPairs[i];
      sample.push({
        success: Math.round(p.successAmtMsat / 1000),
        fail: Math.round(p.failAmtMsat / 1000),
      });
    }
    return sample;
  }, [normalizedPairs]);

  const peerCandidates = useMemo(() => {
    const byPeer = new Map();
    const focusMode = peerMode;
    const filtered = normalizedPairs.filter((p) => {
      if (!localPub) return true;
      if (focusMode === 'local_out') return p.from === localPub;
      if (focusMode === 'local_in') return p.to === localPub;
      return true;
    });
    filtered.forEach((p) => {
      const key = focusMode === 'local_in' ? p.from : p.to;
      if (!key) return;
      if (!byPeer.has(key)) {
        byPeer.set(key, {
          peer: key,
          successAmt: 0,
          failAmt: 0,
          lastSuccess: 0,
          lastFail: 0,
          successes: 0,
          fails: 0,
          score: 0,
        });
      }
      const row = byPeer.get(key);
      row.successAmt += p.successAmtMsat;
      row.failAmt += p.failAmtMsat;
      if (p.successTime) {
        row.successes += 1;
        row.lastSuccess = Math.max(row.lastSuccess, p.successTime);
      }
      if (p.failTime) {
        row.fails += 1;
        row.lastFail = Math.max(row.lastFail, p.failTime);
      }
    });
    const now = Date.now() / 1000;
    byPeer.forEach((row) => {
      const successAge = row.lastSuccess ? Math.max(0, now - row.lastSuccess) : 0;
      const failAge = row.lastFail ? Math.max(0, now - row.lastFail) : 0;
      const successScore = row.successAmt ? Math.log10(row.successAmt + 1) * (1 / (1 + successAge / 86400)) : 0;
      const failPenalty = row.failAmt ? Math.log10(row.failAmt + 1) * (1 / (1 + failAge / 86400)) : 0;
      row.score = successScore - 0.6 * failPenalty;
      row.successAge = successAge;
      row.failAge = failAge;
    });
    return Array.from(byPeer.values()).sort((a, b) => b.score - a.score).slice(0, 20);
  }, [normalizedPairs, localPub, peerMode]);

  const aliasLookup = useCallback((pub) => {
    if (!pub) return '';
    return aliasMap.get(pub) || '';
  }, [aliasMap]);

  useEffect(() => {
    if (!lnc?.lnd?.lightning?.getNodeInfo) return;
    if (!mc) return;
    const pubs = new Set();
    const takeFromPairs = normalizedPairs.slice(0, 200);
    takeFromPairs.forEach((p) => {
      if (p.from) pubs.add(p.from);
      if (p.to) pubs.add(p.to);
    });
    peerCandidates.forEach((p) => {
      if (p.peer) pubs.add(p.peer);
    });
    if (localPub) pubs.delete(localPub);

    const toResolve = Array.from(pubs).filter((pub) => !aliasMap.has(pub));
    if (!toResolve.length) return;

    let cancelled = false;
    const concurrency = 6;
    let idx = 0;

    const run = async () => {
      while (!cancelled && idx < toResolve.length) {
        const pub = toResolve[idx++];
        try {
          const info = await lnc.lnd.lightning.getNodeInfo({
            pub_key: pub,
            include_channels: false,
          });
          const alias = info?.node?.alias || '';
          if (alias) {
            setAliasMap((prev) => {
              if (prev.has(pub)) return prev;
              const next = new Map(prev);
              next.set(pub, alias);
              return next;
            });
          }
        } catch (_) {
          // ignore lookup failures
        }
      }
    };

    const runners = Array.from({ length: Math.min(concurrency, toResolve.length) }, () => run());
    Promise.all(runners).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lnc, mc, normalizedPairs, peerCandidates, localPub, aliasMap]);

  const filteredPairs = useMemo(() => {
    const q = pairQuery.trim().toLowerCase();
    const list = q
      ? normalizedPairs.filter((p) => p.from.includes(q) || p.to.includes(q))
      : normalizedPairs;
    const sorted = [...list].sort((a, b) => {
      if (pairSort === 'success') return b.successAmtMsat - a.successAmtMsat;
      if (pairSort === 'fail') return b.failAmtMsat - a.failAmtMsat;
      if (pairSort === 'recent') return (a.successAge || Number.MAX_SAFE_INTEGER) - (b.successAge || Number.MAX_SAFE_INTEGER);
      return b.score - a.score;
    });
    return sorted.slice(0, 200);
  }, [normalizedPairs, pairQuery, pairSort]);

  const chartTheme = useMemo(() => {
    const axis = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
    const grid = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const tooltipBg = darkMode ? '#0b1220' : '#ffffff';
    const tooltipBorder = darkMode ? '#334155' : '#e5e7eb';
    return { axis, grid, tooltipBg, tooltipBorder };
  }, [darkMode]);

  return (
    <div className="p-6 space-y-8" style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Mission Control</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Explore route performance heuristics via <span className="font-mono">QueryMissionControl</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchMissionControl}
            disabled={isLoading}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              border: 'none',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              color: '#fff',
              boxShadow: darkMode ? '0 4px 14px rgba(14,165,233,0.35)' : '0 4px 14px rgba(99,102,241,0.20)',
              opacity: isLoading ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {isLoading ? 'Loading…' : 'Query Mission Control'}
          </button>
          <button
            onClick={() => mc && makeDownload(`mission-control-${new Date().toISOString()}.json`, mc)}
            disabled={!mc}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: mc ? 'pointer' : 'not-allowed',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
              background: 'transparent',
              color: 'var(--text-secondary)',
              opacity: mc ? 1 : 0.5,
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-text)' }}>
          {error}
        </div>
      )}

      {!mc && !isLoading && !error && (
        <div className="rounded-xl p-8 text-sm text-center" style={{ backgroundColor: 'var(--form-bg)', color: 'var(--text-secondary)' }}>
          <div className="text-4xl mb-3">🧭</div>
          <p>Query Mission Control to pull routing intelligence and benchmark peer reliability.</p>
        </div>
      )}

      {mc && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Pairs tracked" value={kpis.total.toLocaleString()} color="#0ea5e9" darkMode={darkMode} />
            <StatCard title="Pairs with success" value={kpis.withSuccess.toLocaleString()} color="#10b981" darkMode={darkMode} sub={`${kpis.recentSuccess} in last 7d`} />
            <StatCard title="Pairs with failure" value={kpis.withFail.toLocaleString()} color="#f59e0b" darkMode={darkMode} sub={`${kpis.recentFail} in last 7d`} />
            <StatCard title="Local pubkey" value={localPub ? shortHex(localPub, 14) : '—'} color="#6366f1" darkMode={darkMode} sub={localPub ? 'Detected from getInfo' : 'Not available'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Recency distribution"
              subtitle="How fresh are success and failure signals?"
              darkMode={darkMode}
            >
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recencyBuckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                    <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 10 }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                    <Bar dataKey="success" fill="#10b981" radius={[6, 6, 0, 0]} name="Success" />
                    <Bar dataKey="fail" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Failure" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Signal coverage"
              subtitle="What share of pairs have success/failure history?"
              darkMode={darkMode}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                        {statusPie.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 text-sm">
                  {statusPie.map((row) => (
                    <div key={row.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                        {row.name}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{row.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-xs mt-4" style={{ color: 'var(--text-secondary)' }}>
                    Use this view to gauge how rich your mission control history is before making peer decisions.
                  </p>
                </div>
              </div>
            </ChartCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <ChartCard
              title="Success vs failure amounts"
              subtitle="Each dot = one pair history (k sats)"
              darkMode={darkMode}
            >
              {scatterData.length === 0 ? (
                <div className="text-sm h-64 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>No data.</div>
              ) : (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="success" name="Success (k sats)" type="number" tick={{ fill: chartTheme.axis, fontSize: 10 }} />
                      <YAxis dataKey="fail" name="Fail (k sats)" type="number" tick={{ fill: chartTheme.axis, fontSize: 10 }} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 10 }}
                        formatter={(v, name) => [`${v.toLocaleString()} k sats`, name]}
                      />
                      <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.6} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Candidate peers"
              subtitle="Weighted by recent successes vs failures"
              darkMode={darkMode}
              right={
                <select
                  value={peerMode}
                  onChange={(e) => setPeerMode(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="local_out">Local → Remote</option>
                  <option value="local_in">Remote → Local</option>
                  <option value="global">Global view</option>
                </select>
              }
            >
              {peerCandidates.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No candidate peers yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                  {!localPub && (
                    <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Local pubkey not detected. Showing global view.
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>Peer</th>
                        <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Score</th>
                        <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Success</th>
                        <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Fail</th>
                        <th style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Last success</th>
                      </tr>
                    </thead>
                    <tbody>
                      {peerCandidates.map((row, idx) => (
                        <tr key={row.peer} style={{ backgroundColor: idx % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                          <td style={{ padding: '8px 6px' }}>
                            <div className="font-semibold" style={{ color: '#0ea5e9' }}>
                              {aliasLookup(row.peer) || '—'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {shortHex(row.peer, 18)}
                            </div>
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{row.score.toFixed(2)}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtMsat(row.successAmt)} msat</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#f59e0b' }}>{fmtMsat(row.failAmt)} msat</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ageLabel(row.successAge)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          <div
            className="rounded-xl overflow-hidden transition-colors duration-300"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
              boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div className="flex items-center gap-3 px-4 pt-4 pb-0 border-b flex-wrap"
              style={{ borderColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }}>
              <div className="pb-3 font-semibold text-sm">Pairs (top 200)</div>
              <div className="ml-auto flex items-center gap-2 pb-3 flex-wrap">
                <select
                  value={pairSort}
                  onChange={(e) => setPairSort(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="score">Sort: Score</option>
                  <option value="success">Sort: Success amt</option>
                  <option value="fail">Sort: Fail amt</option>
                  <option value="recent">Sort: Recent success</option>
                </select>
                <input
                  value={pairQuery}
                  onChange={(e) => setPairQuery(e.target.value)}
                  placeholder="Search pubkey…"
                  className="px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{
                    minWidth: 220,
                    backgroundColor: 'var(--input-bg)',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>From</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)' }}>To</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Success amt</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Fail amt</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Last success</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Last fail</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPairs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>No matches.</td>
                    </tr>
                  ) : filteredPairs.map((p, i) => (
                    <tr key={`${p.from}-${p.to}-${i}`} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div className="font-semibold" style={{ color: '#0ea5e9' }}>
                          {aliasLookup(p.from) || '—'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {shortHex(p.from, 16)}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div className="font-semibold" style={{ color: '#6366f1' }}>
                          {aliasLookup(p.to) || '—'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {shortHex(p.to, 16)}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtMsat(p.successAmtMsat)} msat</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#f59e0b' }}>{fmtMsat(p.failAmtMsat)} msat</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ageLabel(p.successAge)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{ageLabel(p.failAge)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: p.score >= 0 ? '#10b981' : '#ef4444' }}>{p.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MissionControlPage;
