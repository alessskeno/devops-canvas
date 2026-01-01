import React from 'react';

interface ConnectionLineProps {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    animated?: boolean;
    isDraft?: boolean;
    status?: 'default' | 'running'; // New Prop

    onRemove?: () => void;
}



export function ConnectionLine({ x1, y1, x2, y2, animated, isDraft, status = 'default', onRemove }: ConnectionLineProps) {
    const [isHovered, setIsHovered] = React.useState(false);

    // Beizer Curve Calculation
    // We want the line to go horizontally out of source and horizontally into target
    const curvature = 0.5;
    const dist = Math.abs(x2 - x1);
    const controlPoint1X = x1 + dist * curvature;
    const controlPoint1Y = y1;
    const controlPoint2X = x2 - dist * curvature;
    const controlPoint2Y = y2;

    // Midpoint Calculation for Interaction Button (t=0.5)
    // Formula: (P0 + 3P1 + 3P2 + P3) / 8
    const midX = (x1 + 3 * controlPoint1X + 3 * controlPoint2X + x2) / 8;
    const midY = (y1 + 3 * controlPoint1Y + 3 * controlPoint2Y + y2) / 8;


    const pathData = `M ${x1} ${y1} C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${x2} ${y2}`;

    // Color Logic
    let strokeClass = 'stroke-gray-400 dark:stroke-gray-500';
    if (isDraft) strokeClass = 'stroke-blue-400 dark:stroke-blue-500';
    else if (status === 'running') strokeClass = 'stroke-green-500 dark:stroke-green-400';

    return (
        <g
            className={isDraft ? "opacity-60 pointer-events-none" : "pointer-events-auto"}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Shadow/Border for visibility (Hit area) */}
            <path
                d={pathData}
                fill="none"
                strokeWidth="12"
                className="stroke-transparent hover:stroke-gray-100 dark:hover:stroke-gray-800/30 transition-colors cursor-pointer"
            />
            {/* Main Line */}
            <path
                d={pathData}
                fill="none"
                strokeWidth="2" // Maybe thicker for running?
                className={`
                    ${strokeClass} 
                    ${isHovered && !isDraft ? 'stroke-red-400 dark:stroke-red-500' : ''}
                    ${animated ? 'animate-[dash_1s_linear_infinite]' : ''}
                `}
                strokeDasharray={animated ? "5,5" : "none"}
            />

            {/* Arrow Head */}
            <circle cx={x2} cy={y2} r="3" className={`transition-colors ${isHovered && !isDraft ? 'fill-red-400 dark:fill-red-500' : 'fill-blue-500'}`} />
            <circle cx={x1} cy={y1} r="3" className={isDraft ? "fill-blue-500" : "fill-gray-400"} />

            {/* Delete Button (Midpoint) */}
            {!isDraft && onRemove && isHovered && (
                <g
                    className="cursor-pointer"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove();
                    }}
                >
                    <circle cx={midX} cy={midY} r="12" className="fill-red-500 stroke-white dark:stroke-gray-900 stroke-2" />
                    {/* Simple X icon via path for crispness */}
                    <path
                        d={`M ${midX - 5} ${midY - 5} L ${midX + 5} ${midY + 5} M ${midX + 5} ${midY - 5} L ${midX - 5} ${midY + 5}`}
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </g>
            )}
        </g>
    );
}
