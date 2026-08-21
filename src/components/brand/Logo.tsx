import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizes = {
    sm: { box: 'w-8 h-8', text: 'text-lg', glyph: 16 },
    md: { box: 'w-10 h-10', text: 'text-xl', glyph: 20 },
    lg: { box: 'w-14 h-14', text: 'text-2xl', glyph: 28 },
  };
  const s = sizes[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn('relative flex-shrink-0', s.box)}>
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <defs>
            <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e6c558" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#b8941f" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill="#0F0F0F" />
          <path
            d="M20 7 L31 13.5 L31 26.5 L20 33 L9 26.5 L9 13.5 Z"
            fill="none"
            stroke="url(#logoGold)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M20 11 L27.5 15.25 L27.5 24.75 L20 29 L12.5 24.75 L12.5 15.25 Z" fill="url(#logoGold)" />
          <text
            x="20"
            y="24"
            textAnchor="middle"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontSize={s.glyph}
            fontWeight="800"
            fill="#0F0F0F"
          >
            A
          </text>
        </svg>
      </div>
      {showText && (
        <span className={cn('font-display font-extrabold text-white tracking-tight', s.text)}>
          Aureus
        </span>
      )}
    </div>
  );
}
