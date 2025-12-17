import React from 'react';

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
    if (!highlight.trim()) {
        return <span className={className}>{text}</span>;
    }

    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
        <span className={className}>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} className={highlightClassName}>{part}</span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};
