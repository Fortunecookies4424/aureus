import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Package, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, Receipt, Gift, Megaphone, Settings, User, LogOut,
  ScrollText, Award, Percent, CreditCard,
  Menu, X, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/brand/Logo';
import { getInitials, cn } from '@/lib/utils';

interface AdminNavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

interface AdminNavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

const adminNav: AdminNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/packages', label: 'Investment Packages', icon: Package },
  { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { to: '/admin/investments', label: 'Investments', icon: TrendingUp },
  { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
  { to: '/admin/coupons', label: 'Coupons', icon: Gift },
  { to: '/admin/rewards', label: 'Rewards', icon: Award },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/balance-audit', label: 'Balance Audit', icon: ScrollText },
  { to: '/admin/withdrawal-fees', label: 'Withdrawal Fees', icon: Percent },
  { to: '/admin/payment-gateways', label: 'Payment Gateways', icon: CreditCard },
  { to: '/admin/promo-banners', label: 'Promo Banners', icon: Megaphone },
  { to: '/admin/settings', label: 'Website Settings', icon: Settings },
  { to: '/admin/profile', label: 'Profile', icon: User },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen bg-ink-900 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-ink-950 border-r border-white/5 flex-col fixed inset-y-0">
        <AdminSidebar profile={profile} navItems={adminNav} isActive={isActive} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="lg:hidden fixed inset-y-0 left-0 w-64 bg-ink-950 border-r border-white/5 z-50 flex flex-col"
            >
              <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-ink-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <AdminSidebar profile={profile} navItems={adminNav} isActive={isActive} onSignOut={handleSignOut} onNavigate={() => setSidebarOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 lg:ml-64 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 glass border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-white p-2">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Logo showText={false} size="sm" />
            <span className="text-xs text-gold-300 font-medium">Admin</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Admin badge bar */}
        <div className="hidden lg:flex items-center gap-2 px-8 py-2 bg-gold-400/5 border-b border-gold-400/10">
          <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
          <span className="text-xs text-gold-200">Admin Mode — You have elevated privileges</span>
        </div>

        <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminSidebar({
  profile, navItems, isActive, onSignOut, onNavigate,
}: {
  profile: ReturnType<typeof useAuth>['profile'];
  navItems: AdminNavItem[];
  isActive: (to: string, end?: boolean) => boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-6 border-b border-white/5">
        <Link to="/" onClick={onNavigate}>
          <Logo />
        </Link>
        <div className="mt-3 px-3 py-1.5 rounded-lg bg-gold-400/10 border border-gold-400/20 inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
          <span className="text-xs text-gold-200 font-medium">Admin Panel</span>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin py-4">
        {navItems.map((item) => {
          const active = isActive(item.to, item.end);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-gold-400/10 text-gold-200 border border-gold-400/20'
                  : 'text-ink-300 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <item.icon className={cn('w-5 h-5', active ? 'text-gold-300' : 'text-ink-400 group-hover:text-white')} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-4 h-4 text-gold-300" />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-ink-900 font-bold text-sm flex-shrink-0">
            {profile ? getInitials(profile.full_name || profile.username) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'Admin'}</p>
            <p className="text-xs text-ink-400 truncate">{profile?.email}</p>
          </div>
        </div>
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
