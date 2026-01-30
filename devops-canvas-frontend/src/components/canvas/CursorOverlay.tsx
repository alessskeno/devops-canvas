import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CursorProps {
    x: number;
    y: number;
    name: string;
    scale: number;
    pan: { x: number, y: number };
}

// Generate color from string hash
const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const Cursor = ({ x, y, name, scale, pan }: CursorProps) => {
    const color = stringToColor(name);
    // Calculated screen position: (canvas_pos * scale) + pan
    const screenX = x * scale + pan.x;
    const screenY = y * scale + pan.y;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, x: screenX, y: screenY }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="absolute top-0 left-0 pointer-events-none z-50 flex flex-col items-start"
            style={{
                x: screenX,
                y: screenY,
            }}
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-sm"
            >
                <path
                    d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19138L19.9117 11.0092L10.0754 12.3673H5.65376Z"
                    fill={color}
                    stroke="white"
                    strokeWidth="1"
                />
            </svg>
            <div
                className="px-2 py-0.5 rounded-br-lg rounded-bl-lg rounded-tr-lg text-[10px] font-bold text-white shadow-sm mt-1 ml-2 whitespace-nowrap"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </motion.div>
    );
};

export interface CursorOverlayProps {
    cursors: { [key: string]: { x: number, y: number, name: string } };
    scale: number;
    pan: { x: number, y: number };
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors, scale, pan }) => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
            <AnimatePresence>
                {Object.entries(cursors).map(([id, cursor]) => (
                    <Cursor
                        key={id}
                        x={cursor.x}
                        y={cursor.y}
                        name={cursor.name}
                        scale={scale}
                        pan={pan}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};
