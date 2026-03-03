import React, { Fragment } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full' | 'auto';
    padding?: string;
    className?: string; // Allow custom classes on panel
    resizable?: boolean;
    style?: React.CSSProperties;
}

const DEFAULT_STYLE = {};

export function Modal({ isOpen, onClose, title, children, size = 'md', padding = 'p-6', className = '', resizable = false, style = DEFAULT_STYLE }: ModalProps) {
    if (!isOpen) return null;

    const maxWidths = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '4xl': 'max-w-4xl',
        '6xl': 'max-w-6xl',
        'full': 'max-w-[95vw] h-[90vh]',
        'auto': 'w-auto max-w-[95vw]',
    };

    // If resizable, we typically want w-auto so it fits content/resize handle, 
    // unless user overrides. And we must apply 'resize' class.
    // Also remove 'w-full' if resizable to allow it to shrink/grow freely?
    // Actually w-full on a fixed/absolute positioned flex item might be tricky.
    // Standard modal is centered flex item.

    const widthClass = resizable ? 'w-auto' : 'w-full';
    const resizeClass = resizable ? 'resize overflow-hidden' : 'transform overflow-hidden';

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`relative flex flex-col ${widthClass} ${maxWidths[size]} ${resizeClass} rounded-xl bg-white dark:bg-slate-900 ${padding} shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 ${className}`}
                style={style}
                role="dialog"
                aria-modal="true"
            >
                <div className={`flex items-center justify-between ${padding === 'p-0' ? 'p-4 bg-slate-100 dark:bg-slate-800' : 'mb-5'}`}>
                    <h3 className="text-lg font-semibold leading-6 text-slate-950 dark:text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className={padding === 'p-0' ? 'flex-1 h-full min-h-0' : 'mt-2'}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
