/**
 * Shared pure utility helpers for channel management.
 * Extracted from ChannelsPage so ChannelFeeModal can consume them too.
 */

/** Format satoshi amounts with K / M suffixes */
export const fmtSats = (n) => {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toLocaleString();
};

/** Shorten a channel-id or pubkey for display */
export const shortChan = (id) => {
    if (!id) return '—';
    const s = String(id);
    return s.length > 10 ? `…${s.slice(-8)}` : s;
};

/**
 * Read fee-rate-milli-msat from a channel policy object,
 * handling both camelCase (LNC) and snake_case variants.
 * Returns null when the field is missing / non-finite.
 */
export const getFeeRatePpm = (pol) => {
    if (!pol) return null;
    const raw =
        pol.feeRateMilliMsat !== undefined ? pol.feeRateMilliMsat :
            pol.fee_rate_milli_msat !== undefined ? pol.fee_rate_milli_msat :
                null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
};

/**
 * Compute descriptive statistics for an array of values,
 * optionally weighted by a parallel array.
 *
 * Returns { avg, std, min, max, median, correctedAvg, weightedAvg }
 * or null when there is no data.
 */
export const computeStats = (values, weights = []) => {
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
