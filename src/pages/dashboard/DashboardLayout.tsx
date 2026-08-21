import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, TrendingUp, Wallet, User,
  Bell, ChevronRight, LogOut, ShieldAlert, ArrowLeft,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/brand/Logo';
import { WelcomeToast } from '@/components/WelcomeToast';
import { getInitials, cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

const desktopNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/invest', label: 'Invest', icon: TrendingUp },
  { to: '/dashboard/investments', label: 'My Investments', icon: Wallet },
  { to: '/dashboard/referral', label: 'Referral', icon: User },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
];

export default function DashboardLayout() {
  const { profile, signOut } = useAuth();
  const { data: notifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [impersonation, setImpersonation] = useState<{ logId: string; userName: string; adminId: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('impersonating');
    if (stored) {
      try { setImpersonation(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const endImpersonation = async () => {
    if (impersonation) {
      await supabase.rpc('end_impersonation', { p_log_id: impersonation.logId });
    }
    localStorage.removeItem('impersonating');
    setImpersonation(null);
    navigate('/admin');
  };

  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-ink-900">
      {/* ===== Desktop sidebar (lg+) ===== */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-ink-950 border-r border-white/5 flex-col fixed inset-y-0">
        <DesktopSidebar
          profile={profile}
          unreadCount={unreadCount}
          navItems={desktopNav}
          isActive={isActive}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ===== Main content ===== */}
      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Mobile top header — logo + notification bell */}
        <div className="lg:hidden sticky top-0 z-30 glass border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <Logo showText={false} size="sm" />
          <Link to="/dashboard/notifications" className="relative p-2 text-ink-300">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-gold-400" />
            )}
          </Link>
        </div>

        {/* Impersonation banner */}
        {impersonation && (
          <div className="sticky top-0 z-40 bg-warning-500/10 border-b border-warning-500/20 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-warning-400 text-sm">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Administrator View</span>
              <span className="text-warning-400/70 hidden sm:inline">— You are impersonating {impersonation.userName}</span>
            </div>
            <button onClick={endImpersonation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-400 text-ink-900 text-xs font-bold hover:bg-gold-300 transition-colors flex-shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Admin
            </button>
          </div>
        )}

        <main className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto pb-28 lg:pb-8">
          <Outlet />
        </main>

        <WelcomeToast />
      </div>

      {/* ===== Mobile footer nav (below lg) ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="glass border-t border-white/8 px-2 pb-safe">
          <div className="flex items-end justify-around max-w-md mx-auto h-[68px]">
            <FooterButton to="/dashboard" label="Home" icon={LayoutDashboard} active={isActive('/dashboard', true)} />
            <FooterButton to="/dashboard/invest" label="Invest" icon={TrendingUp} active={isActive('/dashboard/invest')} />
            <WalletButton to="/dashboard/deposit" active={isActive('/dashboard/deposit') || isActive('/dashboard/withdraw')} />
            <FooterButton to="/dashboard/investments" label="Plans" icon={Wallet} active={isActive('/dashboard/investments')} />
            <FooterButton to="/dashboard/profile" label="Profile" icon={User} active={isActive('/dashboard/profile')} />
          </div>
        </div>
      </nav>
    </div>
  );
}

/* ========== Desktop sidebar ========== */
function DesktopSidebar({
  profile, unreadCount, navItems, isActive, onSignOut,
}: {
  profile: ReturnType<typeof useAuth>['profile'];
  unreadCount: number;
  navItems: NavItem[];
  isActive: (to: string, end?: boolean) => boolean;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="p-6 border-b border-white/5">
        <Link to="/"><Logo /></Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const active = isActive(item.to, item.end);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-gold-400/10 text-gold-200 border border-gold-400/20'
                  : 'text-ink-300 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <item.icon className={cn('w-5 h-5', active ? 'text-gold-300' : 'text-ink-400 group-hover:text-white')} />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Notifications' && unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-gold-400 text-ink-900 text-xs font-bold">
                  {unreadCount}
                </span>
              )}
              {active && <ChevronRight className="w-4 h-4 text-gold-300" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5">
        <Link to="/dashboard/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
          <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-ink-900 font-bold text-sm flex-shrink-0">
            {profile ? getInitials(profile.full_name || profile.username) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name || profile?.username}</p>
            <p className="text-xs text-ink-400 truncate">{profile?.phone || profile?.email}</p>
          </div>
        </Link>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-300 hover:text-danger-400 hover:bg-danger-500/10 transition-all mt-1"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </>
  );
}

/* ========== Individual footer button ========== */
function FooterButton({
  to, label, icon: Icon, active,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1 pt-2 pb-2 flex-1 relative">
      <div className={cn(
        'w-6 h-6 flex items-center justify-center transition-colors',
        active ? 'text-gold-300' : 'text-ink-400'
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={cn(
        'text-[10px] font-medium transition-colors',
        active ? 'text-gold-300' : 'text-ink-400'
      )}>
        {label}
      </span>
      {active && (
        <motion.span
          layoutId="footer-active"
          className="absolute -top-px h-0.5 w-8 rounded-full gold-gradient"
        />
      )}
    </Link>
  );
}

/* ========== Wallet button — raised center, no balance text ========== */
function WalletButton({ to, active }: { to: string; active: boolean }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-0.5 flex-1 relative">
      <div className="relative -mt-6">
        <motion.div
          whileTap={{ scale: 0.92 }}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg',
            active
              ? 'gold-gradient gold-glow-strong ring-2 ring-gold-400/40'
              : 'gold-gradient gold-glow ring-4 ring-ink-900'
          )}
        >
          <Wallet className="w-6 h-6 text-ink-900" strokeWidth={2.5} />
        </motion.div>
      </div>
      <p className={cn(
        'text-[10px] font-medium mt-1 transition-colors',
        active ? 'text-gold-300' : 'text-ink-400'
      )}>
        Wallet
      </p>
    </Link>
  );
}
