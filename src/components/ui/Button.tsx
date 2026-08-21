import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold-outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'gold-gradient text-ink-900 font-semibold hover:shadow-gold-lg hover:brightness-110 active:brightness-95',
  secondary: 'bg-ink-800 text-white border border-white/10 hover:bg-ink-700 hover:border-white/20',
  outline: 'border border-gold-400/40 text-gold-300 hover:bg-gold-400/10 hover:border-gold-400/60',
  'gold-outline': 'border-2 border-gold-400 text-gold-300 hover:bg-gold-400 hover:text-ink-900 font-semibold',
  ghost: 'text-ink-200 hover:text-white hover:bg-white/5',
  danger: 'bg-danger-500/10 text-danger-400 border border-danger-500/30 hover:bg-danger-500/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-6 text-sm rounded-xl gap-2',
  lg: 'h-13 px-8 text-base rounded-xl gap-2.5 py-3.5',
  icon: 'h-10 w-10 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-400/50 focus:ring-offset-2 focus:ring-offset-ink-900 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
