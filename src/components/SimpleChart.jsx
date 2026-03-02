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
    const wrapRef = useRef(null);

    // tooltip: { svgX, svgY, label, value, domX, domY }
    const [tooltip, setTooltip] = useState(null);

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

    // Given an SVG-space X, find the closest data point index
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
        const wrap = wrapRef.current;
        if (!svg || !wrap || !points.length) return;

        // Accurate SVG coordinate via getScreenCTM — handles CSS scaling perfectly
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());

        const nearest = findNearest(svgPt.x);
        if (!nearest) return;

        // DOM position of the nearest point for the HTML tooltip
        // Convert the SVG-space point back to DOM pixels
        const ptBack = svg.createSVGPoint();
        ptBack.x = nearest.x;
        ptBack.y = nearest.y;
        const domPt = ptBack.matrixTransform(svg.getScreenCTM());

        // Position relative to the wrapper div
        const wrapRect = wrap.getBoundingClientRect();
        const domX = domPt.x - wrapRect.left;
        const domY = domPt.y - wrapRect.top;

        setTooltip({
            svgX: nearest.x,
            svgY: nearest.y,
            label: nearest.label,
            value: nearest.value,
            domX,
            domY,
            wrapW: wrapRect.width,
        });
    }, [points, findNearest]);

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

    // — tooltip placement: flip left if near right edge, flip up if near bottom —
    const TT_W = 160; // rough tooltip width estimate in px
    const ttLeft = tooltip
        ? tooltip.domX + TT_W / 2 > tooltip.wrapW
            ? tooltip.domX - TT_W       // right-flip
            : tooltip.domX - TT_W / 2   // centred
        : 0;
    const ttTop = tooltip ? tooltip.domY - 44 : 0; // always above the dot

    return (
        <div style={{ width: '100%', position: 'relative' }} ref={wrapRef}>
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

                    {/* Hover crosshair + highlighted dot */}
                    {tooltip && (
                        <>
                            <line
                                x1={tooltip.svgX} x2={tooltip.svgX}
                                y1={PAD_TOP} y2={PAD_TOP + chartH}
                                stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"
                            />
                            <circle
                                cx={tooltip.svgX} cy={tooltip.svgY}
                                r="6" fill={color} stroke="white" strokeWidth="2.5"
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

                {/* Floating tooltip — positioned in DOM pixels relative to wrapper */}
                {tooltip && (
                    <div
                        style={{
                            position: 'absolute',
                            top: ttTop,
                            left: ttLeft,
                            pointerEvents: 'none',
                            zIndex: 20,
                            padding: '6px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            backgroundColor: darkMode ? 'rgba(20,20,30,0.96)' : 'rgba(255,255,255,0.97)',
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
