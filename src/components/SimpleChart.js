import React, { useMemo, useState, useCallback, useRef } from 'react';

/**
 * SimpleChart — SVG area/bar chart with hover tooltip.
 * Props:
 *   data        : Array<{ label: string, value: number }>
 *   height      : number (default 220)
 *   color       : string (default '#6366f1')
 *   formatValue : (number) => string
 *   darkMode    : boolean
 *   type        : 'bar' | 'area' (default 'area')
 *   label       : string
 */
const SimpleChart = ({
    data = [],
    height = 220,
    color = '#6366f1',
    formatValue = (v) => v.toLocaleString(),
    darkMode = false,
    type = 'area',
    label = '',
}) => {
    const WIDTH = 800;
    const PAD_LEFT = 0;
    const PAD_RIGHT = 0;
    const PAD_TOP = 16;
    const PAD_BOT = 32;
    const chartW = WIDTH - PAD_LEFT - PAD_RIGHT;
    const chartH = height - PAD_TOP - PAD_BOT;

    const svgRef = useRef(null);
    const [tooltip, setTooltip] = useState(null); // { x, y, label, value }

    const { points, maxVal } = useMemo(() => {
        if (!data.length) return { points: [], maxVal: 0 };
        const maxVal = Math.max(...data.map((d) => d.value), 1);
        const points = data.map((d, i) => ({
            ...d,
            x: PAD_LEFT + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
            y: PAD_TOP + chartH - (d.value / maxVal) * chartH,
        }));
        return { points, maxVal };
    }, [data, chartW, chartH]);

    // Given a mouse SVG-space X, find the closest data point
    const findNearest = useCallback((svgX) => {
        if (!points.length) return null;
        let best = points[0];
        let bestDist = Math.abs(points[0].x - svgX);
        for (const p of points) {
            const d = Math.abs(p.x - svgX);
            if (d < bestDist) { bestDist = d; best = p; }
        }
        return best;
    }, [points]);

    const handleMouseMove = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg || !points.length) return;
        const rect = svg.getBoundingClientRect();
        // Map client X to SVG coordinate space
        const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
        const p = findNearest(svgX);
        if (!p) return;
        // Tooltip anchor in % of rendered element
        const pctX = (p.x / WIDTH) * 100;
        const pctY = ((p.y - PAD_TOP) / chartH) * 100;
        setTooltip({ pctX, pctY, label: p.label, value: p.value, svgY: p.y, svgX: p.x });
    }, [points, findNearest, chartH]);

    const handleMouseLeave = useCallback(() => setTooltip(null), []);

    if (!data.length) {
        return (
            <div
                className="flex items-center justify-center rounded-xl"
                style={{ height, color: 'var(--text-secondary)', fontSize: 13, backgroundColor: 'var(--form-bg)' }}
            >
                No data
            </div>
        );
    }

    const barWidth = Math.max(2, chartW / data.length - 2);
    const gradId = `grad-${color.replace(/[^a-z0-9]/gi, '')}`;

    const areaPath = points.length
        ? [
            `M${points[0].x},${PAD_TOP + chartH}`,
            `L${points[0].x},${points[0].y}`,
            ...points.slice(1).map((p) => `L${p.x},${p.y}`),
            `L${points[points.length - 1].x},${PAD_TOP + chartH}`,
            'Z',
        ].join(' ')
        : '';

    const linePath = points.length
        ? [`M${points[0].x},${points[0].y}`, ...points.slice(1).map((p) => `L${p.x},${p.y}`)].join(' ')
        : '';

    const gridLines = 4;
    const textColor = darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
    const gridColor = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const labelStep = Math.ceil(data.length / 10);

    // Tooltip box — flip left if near right edge
    const ttLeft = tooltip ? (tooltip.pctX > 70 ? 'auto' : `${tooltip.pctX}%`) : 0;
    const ttRight = tooltip ? (tooltip.pctX > 70 ? `${100 - tooltip.pctX}%` : 'auto') : 'auto';
    const ttTop = tooltip ? (tooltip.pctY > 60 ? 'auto' : `${Math.max(0, tooltip.pctY - 10)}%`) : 0;
    const ttBottom = tooltip ? (tooltip.pctY > 60 ? `${100 - tooltip.pctY + 10}%` : 'auto') : 'auto';

    return (
        <div style={{ width: '100%', position: 'relative' }}>
            {label && (
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </p>
            )}

            {/* SVG chart */}
            <div style={{ position: 'relative' }}>
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${WIDTH} ${height}`}
                    width="100%"
                    height={height}
                    style={{ overflow: 'visible', display: 'block', cursor: 'crosshair' }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
                        </linearGradient>
                    </defs>

                    {/* Grid */}
                    {Array.from({ length: gridLines + 1 }).map((_, i) => {
                        const y = PAD_TOP + (i / gridLines) * chartH;
                        const val = maxVal * (1 - i / gridLines);
                        return (
                            <g key={i}>
                                <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke={gridColor} strokeWidth="1" />
                                {i % 2 === 0 && (
                                    <text x={PAD_LEFT + 2} y={y - 4} fontSize="10" fill={textColor}>
                                        {formatValue(val)}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Area / Bar data */}
                    {type === 'area' && (
                        <>
                            <path d={areaPath} fill={`url(#${gradId})`} />
                            <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
                            {points.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} opacity="0.8" />
                            ))}
                        </>
                    )}

                    {type === 'bar' && points.map((p, i) => (
                        <rect
                            key={i}
                            x={p.x - barWidth / 2}
                            y={p.y}
                            width={barWidth}
                            height={PAD_TOP + chartH - p.y}
                            fill={color}
                            rx="3"
                            opacity={tooltip?.label === p.label ? 1 : 0.75}
                        />
                    ))}

                    {/* Hover crosshair */}
                    {tooltip && (
                        <>
                            <line
                                x1={tooltip.svgX} x2={tooltip.svgX}
                                y1={PAD_TOP} y2={PAD_TOP + chartH}
                                stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"
                            />
                            <circle
                                cx={tooltip.svgX} cy={tooltip.svgY}
                                r="5" fill={color} stroke="white" strokeWidth="2"
                            />
                        </>
                    )}

                    {/* X-axis labels */}
                    {points.map((p, i) =>
                        i % labelStep === 0 ? (
                            <text key={i} x={p.x} y={height - 6} fontSize="10" fill={textColor} textAnchor="middle">
                                {p.label}
                            </text>
                        ) : null
                    )}
                </svg>

                {/* Floating tooltip */}
                {tooltip && (
                    <div
                        style={{
                            position: 'absolute',
                            top: ttTop,
                            bottom: ttBottom,
                            left: ttLeft,
                            right: ttRight,
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                            zIndex: 10,
                            padding: '6px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            backgroundColor: darkMode ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.97)',
                            color: 'var(--text-primary)',
                            boxShadow: darkMode
                                ? `0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px ${color}55`
                                : `0 4px 16px rgba(0,0,0,0.15), 0 0 0 1px ${color}44`,
                            border: `1px solid ${color}55`,
                        }}
                    >
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{tooltip.label}:&nbsp;</span>
                        <span style={{ color }}>{formatValue(tooltip.value)}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimpleChart;
