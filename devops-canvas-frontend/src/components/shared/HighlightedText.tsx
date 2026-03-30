import React from 'react';
import { randomUUID } from '../../utils/uuid';

interface HighlightedTextProps {
    text: string;
    highlight: string;
    className?: string;
    highlightClassName?: string;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
    text,
    highlight,
    className = "",
    highlightClassName = "bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 font-medium rounded-sm px-0.5"
}) => {
    const parts = React.useMemo(() => {
        if (!highlight.trim()) {
            return [{ id: 'full', text: text, isHighlight: false }];
        }
        const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.split(regex).map(part => ({
            id: randomUUID(),
            text: part,
            isHighlight: regex.test(part)
        }));
    }, [text, highlight]);

    if (!highlight.trim()) {
        return <span className={className}>{text}</span>;
    }

    return (
        <span className={className}>
            {parts.map((part) =>
                part.isHighlight ? (
                    <span key={part.id} className={highlightClassName}>{part.text}</span>
                ) : (
                    <span key={part.id}>{part.text}</span>
                )
            )}
        </span>
    );
};
