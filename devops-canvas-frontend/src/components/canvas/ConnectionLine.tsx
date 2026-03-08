import React from 'react';
import { getBezierPath, EdgeLabelRenderer, Position, type EdgeProps } from '@xyflow/react';
import { useCanvasStore } from '../../store/canvasStore';

export function ConnectionLine({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    data,
    markerEnd,
}: EdgeProps) {
    const [isHovered, setIsHovered] = React.useState(false);
    const removeConnection = useCanvasStore(s => s.removeConnection);

    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition: sourcePosition ?? Position.Right,
        targetX,
        targetY,
        targetPosition: targetPosition ?? Position.Left,
        curvature: 0.2,
    });

    const isRunning = data?.status === 'running';
    const animated = data?.animated || isRunning;

    let strokeColor = '#64748b';
    if (isHovered) strokeColor = '#f87171';
    else if (isRunning) strokeColor = '#22c55e';

    return (
        <>
            {/* Wide invisible hit area */}
            <path
                d={edgePath}
                fill="none"
                strokeWidth={14}
                stroke="transparent"
                className="react-flow__edge-interaction"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            />
            {/* Visible edge with arrow at target */}
            <path
                d={edgePath}
                fill="none"
                strokeWidth={1.5}
                stroke={strokeColor}
                strokeDasharray={animated ? '5,5' : 'none'}
                markerEnd={markerEnd}
                className={animated ? 'animate-[dash_1s_linear_infinite]' : ''}
                style={style}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            />

            {/* Delete button at midpoint */}
            {isHovered && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        <button
                            className="w-5 h-5 rounded-full bg-red-500 border-2 border-white dark:border-gray-900 flex items-center justify-center cursor-pointer shadow-md hover:bg-red-600 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeConnection(id);
                            }}
                        >
                            <svg width="8" height="8" viewBox="0 0 10 10">
                                <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
