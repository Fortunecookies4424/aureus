import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute, AdminPublicRoute } from '@/components/guards/RouteGuards';

const AuthPage = lazy(() => import('@/pages/auth/AuthPage'));
const SuspendedPage = lazy(() => import('@/pages/auth/SuspendedPage'));
const AdminLoginPage = lazy(() => import('@/pages/auth/AdminLoginPage'));

const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout'));
const DashboardHome = lazy(() => import('@/pages/dashboard/DashboardHome'));
const InvestPage = lazy(() => import('@/pages/dashboard/InvestPage'));
const MyInvestmentsPage = lazy(() => import('@/pages/dashboard/MyInvestmentsPage'));
const DepositPage = lazy(() => import('@/pages/dashboard/DepositPage'));
const WithdrawPage = lazy(() => import('@/pages/dashboard/WithdrawPage'));
const ReferralPage = lazy(() => import('@/pages/dashboard/ReferralPage'));
const ProfilePage = lazy(() => import('@/pages/dashboard/ProfilePage'));
const NotificationsPage = lazy(() => import('@/pages/dashboard/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage'));

const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('@/pages/admin/AdminUserDetail'));
const AdminPackages = lazy(() => import('@/pages/admin/AdminPackages'));
const AdminDeposits = lazy(() => import('@/pages/admin/AdminDeposits'));
const AdminWithdrawals = lazy(() => import('@/pages/admin/AdminWithdrawals'));
const AdminInvestments = lazy(() => import('@/pages/admin/AdminInvestments'));
const AdminTransactions = lazy(() => import('@/pages/admin/AdminTransactions'));
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'));
const AdminAnnouncements = lazy(() => import('@/pages/admin/AdminAnnouncements'));
const AdminBalanceAudit = lazy(() => import('@/pages/admin/AdminBalanceAudit'));
const AdminRewards = lazy(() => import('@/pages/admin/AdminRewards'));
const AdminWithdrawalFees = lazy(() => import('@/pages/admin/AdminWithdrawalFees'));
const AdminPaymentGateways = lazy(() => import('@/pages/admin/AdminPaymentGateways'));
const AdminPromoBanners = lazy(() => import('@/pages/admin/AdminPromoBanners'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminProfile = lazy(() => import('@/pages/admin/AdminProfile'));

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Auth — the first screen visitors see */}
        <Route path="/" element={<PublicOnlyRoute><AuthPage /></PublicOnlyRoute>} />
        <Route path="/login" element={<PublicOnlyRoute><AuthPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><AuthPage /></PublicOnlyRoute>} />

        {/* Suspended users */}
        <Route path="/suspended" element={<SuspendedPage />} />

        {/* Admin login — separate from user auth */}
        <Route path="/admin/login" element={<AdminPublicRoute><AdminLoginPage /></AdminPublicRoute>} />

        {/* User dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="invest" element={<InvestPage />} />
          <Route path="investments" element={<MyInvestmentsPage />} />
          <Route path="deposit" element={<DepositPage />} />
          <Route path="withdraw" element={<WithdrawPage />} />
          <Route path="referral" element={<ReferralPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Admin dashboard */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="packages" element={<AdminPackages />} />
          <Route path="deposits" element={<AdminDeposits />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="investments" element={<AdminInvestments />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="balance-audit" element={<AdminBalanceAudit />} />
          <Route path="rewards" element={<AdminRewards />} />
          <Route path="withdrawal-fees" element={<AdminWithdrawalFees />} />
          <Route path="payment-gateways" element={<AdminPaymentGateways />} />
          <Route path="promo-banners" element={<AdminPromoBanners />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
