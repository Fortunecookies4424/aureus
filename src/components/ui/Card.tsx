import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card-elevated rounded-2xl p-6 transition-all duration-300',
        hover && 'hover:shadow-card-hover hover:border-gold-400/20 cursor-pointer hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon, trend, trendUp, className }: StatCardProps) {
  return (
    <div className={cn('card-elevated rounded-2xl p-5 relative overflow-hidden group', className)}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gold-400/5 group-hover:bg-gold-400/10 transition-colors" />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-medium text-ink-300 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-2 font-display">{value}</p>
          {trend && (
            <p className={cn('text-xs mt-2 font-medium', trendUp ? 'text-success-400' : 'text-danger-400')}>
              {trend}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gold' | 'info';
  className?: string;
}

const badgeVariants = {
  default: 'bg-ink-700 text-ink-200 border-white/10',
  success: 'bg-success-500/10 text-success-400 border-success-500/30',
  warning: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
  danger: 'bg-danger-500/10 text-danger-400 border-danger-500/30',
  gold: 'bg-gold-400/10 text-gold-300 border-gold-400/30',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
