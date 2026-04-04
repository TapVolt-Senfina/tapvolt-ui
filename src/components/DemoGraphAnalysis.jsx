import React, { useState, useMemo } from 'react';

const FlowTopologyGraph = ({ circuits, darkMode }) => {
    const [hoveredPeer, setHoveredPeer] = useState(null);

    if (!circuits || circuits.length === 0) {
        return <div className="h-full flex items-center justify-center text-slate-500 italic">No forwarding circuits to visualize</div>;
    }

    const width = 800;
    const height = 450;
    const center = { x: width / 2, y: height / 2 };
    const radius = 160;

    const peerNames = [...new Set([
        ...circuits.map(c => c.src),
        ...circuits.map(c => c.dst)
    ])];
    
    const peerPositions = new Map();
    peerNames.forEach((name, i) => {
        const angle = (i / peerNames.length) * 2 * Math.PI - Math.PI / 2;
        peerPositions.set(name, {
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
            name
        });
    });

    const getArcPath = (start, end, bend = 25) => {
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        const nx = -dy / len;
        const ny = dx / len;
        const cpX = midX + nx * bend;
        const cpY = midY + ny * bend;
        return `M ${start.x} ${start.y} Q ${cpX} ${cpY} ${end.x} ${end.y}`;
    };

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ minHeight: '400px' }}>
            <defs>
                <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-dark" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="inboundGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="outboundGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#f87171" stopOpacity="0.8" />
                </linearGradient>
            </defs>

            {circuits.map((circ, i) => {
                const srcPos = peerPositions.get(circ.src);
                const dstPos = peerPositions.get(circ.dst);
                if (!srcPos || !dstPos) return null;

                const isHighlighted = hoveredPeer === circ.src || hoveredPeer === circ.dst;
                const strokeWidth = Math.max(2, Math.min(10, Math.log10(circ.val + 1) * 2));
                const opacity = hoveredPeer ? (isHighlighted ? 0.95 : 0.05) : 0.4;
                
                const colorIn = "#3b82f6";
                const colorOut = "#ef4444";

                const pathIn = getArcPath(srcPos, center, 35);
                const pathOut = getArcPath(center, dstPos, -35);
                
                const glowFilter = darkMode ? "url(#glow-dark)" : "url(#glow-light)";

                return (
                    <g key={`circ-${i}`} style={{ transition: 'opacity 0.3s ease-in-out' }} opacity={opacity}>
                        <path d={pathIn} stroke="url(#inboundGrad)" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
                        <path d={pathOut} stroke="url(#outboundGrad)" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
                        
                        <circle r={strokeWidth/2 + 2} fill={colorIn} filter={glowFilter}>
                            <animateMotion
                                dur={`${Math.max(1.0, 5 - Math.log10(circ.val + 1))}s`}
                                repeatCount="indefinite"
                                path={pathIn}
                            />
                        </circle>
                        <circle r={strokeWidth/2 + 2} fill={colorOut} filter={glowFilter}>
                            <animateMotion
                                dur={`${Math.max(1.0, 5 - Math.log10(circ.val + 1))}s`}
                                repeatCount="indefinite"
                                path={pathOut}
                                begin="0.3s"
                            />
                        </circle>
                    </g>
                );
            })}

            {[...peerPositions.values()].map((peer, i) => {
                const isHovered = hoveredPeer === peer.name;
                const nodeColor = darkMode ? "#334155" : "#e2e8f0";
                const strokeColor = darkMode ? "#94a3b8" : "#64748b";
                const glowFilter = darkMode ? "url(#glow-dark)" : "url(#glow-light)";

                return (
                    <g 
                        key={`peer-${i}`} 
                        onMouseEnter={() => setHoveredPeer(peer.name)} 
                        onMouseLeave={() => setHoveredPeer(null)}
                        className="cursor-pointer"
                    >
                        <circle 
                            cx={peer.x} cy={peer.y} r={isHovered ? 16 : 12} 
                            fill={nodeColor} 
                            stroke={strokeColor} 
                            strokeWidth="2" 
                            style={{ transition: 'all 0.3s ease-in-out' }}
                            filter={isHovered ? glowFilter : ""}
                        />
                        <text 
                            x={peer.x} y={peer.y + (peer.y > center.y ? 28 : -22)} 
                            textAnchor="middle" 
                            fontSize={isHovered ? "12" : "10"} 
                            fontWeight={isHovered ? "700" : "600"}
                            fill={darkMode ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.9)"}
                            style={{ transition: 'all 0.3s', textShadow: darkMode ? '0 1px 4px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)' }}
                        >
                            {peer.name}
                        </text>
                    </g>
                );
            })}

            <circle cx={center.x} cy={center.y} r="22" fill="var(--bg-app)" stroke="var(--accent-1)" strokeWidth="4" filter={darkMode ? "url(#glow-dark)" : "url(#glow-light)"} />
            <text x={center.x} y={center.y + 7} textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--accent-1)" pointerEvents="none" style={{ textShadow: darkMode ? '0 1px 4px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)' }}>YOU</text>
        </svg>
    );
};

const DemoGraphAnalysis = ({ darkMode, forwards = [], chanLabel = (id) => id }) => {
    const p2pCircuits = useMemo(() => {
        if (!forwards || forwards.length === 0) return [];
        const p2pCount = new Map();
        
        for (const ev of forwards) {
            const cidIn  = String(ev.chanIdIn || ev.chan_id_in || '').trim();
            const cidOut = String(ev.chanIdOut || ev.chan_id_out || '').trim();
            if (!cidIn || !cidOut) continue;

            const pIn  = chanLabel(cidIn) || cidIn;
            const pOut = chanLabel(cidOut) || cidOut;
            if (!pIn || !pOut) continue;

            const key = `${pIn}:::${pOut}`;
            const amt = Number(ev.amtOut ?? ev.amt_out ?? 0);
            p2pCount.set(key, (p2pCount.get(key) || 0) + amt);
        }

        const circuits = [];
        [...p2pCount.entries()]
            .sort((a,b) => b[1] - a[1])
            .slice(0, 15)
            .forEach(([key, val]) => {
                const [src, dst] = key.split(':::');
                circuits.push({ src, dst, val });
            });
            
        return circuits;
    }, [forwards, chanLabel]);

    return (
        <div className="w-full flex justify-center py-6">
            <div className="w-full max-w-4xl rounded-2xl p-6" style={{
                backgroundColor: 'var(--bg-card)',
                border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
                boxShadow: 'var(--card-shadow)',
            }}>
                <div className="flex flex-col mb-4">
                    <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        Satoshi Forwarding Circuits
                    </h3>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Top Peer-to-Peer flow paths through your node. <span style={{ color: '#3b82f6', fontWeight: 700 }}>Blue = Inbound</span>, <span style={{ color: '#ef4444', fontWeight: 700 }}>Red = Outbound</span>.
                    </p>
                </div>
                <div className="h-[450px] w-full flex items-center justify-center relative bg-slate-50 dark:bg-slate-900/40 rounded-xl" style={{ border: `1px solid ${darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                    <FlowTopologyGraph circuits={p2pCircuits} darkMode={darkMode} />
                </div>
            </div>
        </div>
    );
};

export default DemoGraphAnalysis;
