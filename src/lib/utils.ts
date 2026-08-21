import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency = '₦'): string {
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `${currency}${formatted}`;
}

export function formatCompactCurrency(amount: number, currency = '₦'): string {
  if (amount >= 1_000_000) return `${currency}${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${currency}${(amount / 1_000).toFixed(1)}K`;
  return `${currency}${(amount || 0).toFixed(2)}`;
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function generateReferralCode(username: string): string {
  const base = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5);
  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${base}${suffix}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length > 10) {
    digits = '0' + digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 11) {
    // already correct
  } else if (!digits.startsWith('0') && digits.length === 10) {
    digits = '0' + digits;
  }
  return digits;
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 14;
}

export function phoneToFakeEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `user${digits}@aureus.phone`;
}

export function padPassword(password: string): string {
  if (password.length >= 6) return password;
  return password.padEnd(6, '0');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
