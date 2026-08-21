import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const baseField =
  'w-full bg-ink-800/60 border border-white/10 rounded-xl px-4 text-white placeholder:text-ink-400 transition-all duration-200 focus:outline-none focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/20 disabled:opacity-50 disabled:cursor-not-allowed';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-ink-100">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(baseField, 'h-11', icon && 'pl-11', error && 'border-danger-500/50 focus:border-danger-500/50 focus:ring-danger-500/20', className)}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-danger-400">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-400">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-ink-100">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(baseField, 'h-11 appearance-none cursor-pointer bg-ink-800', error && 'border-danger-500/50', className)}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-ink-800 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || props.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-ink-100">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(baseField, 'py-3 min-h-[100px] resize-y', error && 'border-danger-500/50', className)}
          {...props}
        />
        {error && <p className="text-xs text-danger-400">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
