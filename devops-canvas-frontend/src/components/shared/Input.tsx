import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helpText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, helpText, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-1.5">
                        {label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        'flex h-10 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-shadow',
                        'dark:bg-slate-900 dark:border-slate-800 dark:text-white dark:focus:ring-blue-500',
                        error && 'border-red-500 focus:ring-red-500',
                        className
                    )}
                    {...props}
                />
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                {helpText && !error && <p className="mt-1 text-xs text-slate-600">{helpText}</p>}
            </div>
        );
    }
);
