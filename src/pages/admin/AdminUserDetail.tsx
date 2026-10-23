import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Wallet, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Ban, CheckCircle2, Edit3, Save, KeyRound, UserCircle, Lock,
  Users, Receipt, Building,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Input, Badge, PageHeader, EmptyState, StatCard } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime, getInitials } from '@/lib/utils';
import type { Profile, Wallet, Investment, Deposit, Withdrawal, Transaction, Referral } from '@/types/database';

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { session } = useAuth();
  const [editBalance, setEditBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['admin-user-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!id,
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ['admin-user-wallet', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*').eq('user_id', id!).maybeSingle();
      if (error) throw error;
      return data as Wallet;
    },
    enabled: !!id,
  });

  const { data: investments } = useQuery<Investment[]>({
    queryKey: ['admin-user-investments', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('investments').select('*').eq('user_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Investment[];
    },
    enabled: !!id,
  });

  const { data: deposits } = useQuery<Deposit[]>({
    queryKey: ['admin-user-deposits', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('deposits').select('*').eq('user_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deposit[];
    },
    enabled: !!id,
  });

  const { data: withdrawals } = useQuery<Withdrawal[]>({
    queryKey: ['admin-user-withdrawals', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('withdrawals').select('*').eq('user_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Withdrawal[];
    },
    enabled: !!id,
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['admin-user-transactions', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*').eq('user_id', id!).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!id,
  });

  const { data: referrals } = useQuery<Referral[]>({
    queryKey: ['admin-user-referrals', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('referrals').select('*, referred:referred_id(id, username, email, created_at)').eq('referrer_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Referral[];
    },
    enabled: !!id,
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.rpc('admin_set_user_status', { p_user_id: id!, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User status updated');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      toast.error('Update failed', msg);
    },
  });

  const updateBalance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_update_balance_v2', {
        p_user_id: id!,
        p_new_balance: parseFloat(newBalance),
        p_reason: balanceReason || 'Manual adjustment',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-wallet', id] });
      qc.invalidateQueries({ queryKey: ['balance-audit-log'] });
      toast.success('Balance updated!', 'Adjustment logged in audit history.');
      setEditBalance(false);
      setNewBalance('');
      setBalanceReason('');
    },
    onError: () => toast.error('Failed to update balance'),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('admin_reset_password', {
        p_user_id: id!,
        p_new_password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Password reset!', 'User can now log in with the new password.');
      setResetOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      toast.error('Reset failed', msg);
    },
  });

  const impersonate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('start_impersonation', { p_user_id: id! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem('impersonating', JSON.stringify({
        logId: data.id,
        userId: data.user_id,
        userName: data.user_name,
        adminId: session?.user?.id,
      }));
      navigate('/dashboard');
      toast.success('Viewing as user', `You are now viewing as ${data.user_name}.`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to impersonate';
      toast.error('Impersonation failed', msg);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-gold-400/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm text-gold-300 hover:text-gold-200 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </Link>
        <Card><EmptyState icon={<Users className="w-6 h-6" />} title="User not found" description="This user may have been deleted." /></Card>
      </div>
    );
  }

  const activeInvestments = (investments || []).filter((i) => i.status === 'active');

  return (
    <div>
      <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm text-gold-300 hover:text-gold-200 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </Link>

      <PageHeader title="User Details" subtitle={profile.email} icon={<Users className="w-5 h-5" />} />

      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Card>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center text-ink-900 font-bold text-xl flex-shrink-0">
              {getInitials(profile.full_name || profile.username)}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">{profile.full_name || profile.username}</h3>
              <p className="text-sm text-ink-400">{profile.email}</p>
              <div className="flex gap-2 mt-1.5">
                <Badge variant={profile.role === 'admin' ? 'gold' : 'default'}>{profile.role}</Badge>
                <Badge variant={profile.status === 'active' ? 'success' : 'danger'}>{profile.status}</Badge>
              </div>
            </div>
            {profile.role !== 'admin' && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setResetOpen(true)}>
                  <KeyRound className="w-4 h-4" /> Reset Password
                </Button>
                <Button size="sm" onClick={() => impersonate.mutate()} loading={impersonate.isPending}>
                  <UserCircle className="w-4 h-4" /> View as User
                </Button>
                <Button
                  size="sm"
                  variant={profile.status === 'active' ? 'danger' : 'primary'}
                  onClick={() => setStatus.mutate(profile.status === 'active' ? 'suspended' : 'active')}
                  loading={setStatus.isPending}
                >
                  {profile.status === 'active' ? <><Ban className="w-4 h-4" /> Suspend</> : <><CheckCircle2 className="w-4 h-4" /> Activate</>}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <InfoBox label="Username" value={profile.username} />
            <InfoBox label="Phone" value={profile.phone || '—'} />
            <InfoBox label="Referral Code" value={profile.referral_code} />
            <InfoBox label="Joined" value={formatDate(profile.created_at)} />
          </div>

          {profile.bank_name && (
            <div className="mt-3 p-3 rounded-xl bg-ink-800/50 border border-white/5">
              <p className="text-xs text-ink-400 flex items-center gap-1.5 mb-1"><Building className="w-3 h-3" /> Bank Details</p>
              <p className="text-sm text-white">{profile.bank_name} · {profile.bank_account_name} · {profile.bank_account_number}</p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Wallet stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Balance" value={formatCurrency(wallet?.balance || 0)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Bonus" value={formatCurrency(wallet?.bonus_balance || 0)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Deposits" value={formatCurrency(wallet?.total_deposits || 0)} icon={<ArrowDownToLine className="w-5 h-5" />} />
        <StatCard label="Withdrawals" value={formatCurrency(wallet?.total_withdrawals || 0)} icon={<ArrowUpFromLine className="w-5 h-5" />} />
        <StatCard label="Profit" value={formatCurrency(wallet?.total_profit || 0)} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Referrals" value={formatCurrency(wallet?.referral_earnings || 0)} icon={<Users className="w-5 h-5" />} />
      </div>

      {/* Edit balance */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Wallet Balance</p>
          <button onClick={() => { setEditBalance(true); setNewBalance((wallet?.balance || 0).toString()); }}
            className="text-xs text-gold-300 hover:text-gold-200 flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Edit Balance
          </button>
        </div>
        {editBalance ? (
          <div className="space-y-3">
            <Input label="New Balance" type="number" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} icon={<span className="text-gold-300">₦</span>} />
            <Input label="Reason (required)" value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} placeholder="Reason for adjustment" />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" fullWidth onClick={() => setEditBalance(false)}>Cancel</Button>
              <Button size="sm" fullWidth onClick={() => updateBalance.mutate()} loading={updateBalance.isPending} disabled={!balanceReason}>
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-2xl font-bold text-gold-300 font-display">{formatCurrency(wallet?.balance || 0)}</p>
        )}
      </Card>

      {/* Active investments */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold font-display mb-4">Active Investments ({activeInvestments.length})</h3>
        {activeInvestments.length === 0 ? (
          <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="No active investments" />
        ) : (
          <div className="space-y-3">
            {activeInvestments.map((inv) => {
              const progress = inv.status === 'completed' ? 100 : Math.round(((Date.now() - new Date(inv.start_date).getTime()) / (new Date(inv.maturity_date).getTime() - new Date(inv.start_date).getTime())) * 100);
              return (
                <div key={inv.id} className="p-3 rounded-xl bg-ink-800/50 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{inv.package_name}</span>
                    <span className="text-xs text-gold-300">{formatCurrency(inv.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                    <div className="h-full gold-gradient rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-ink-400">
                    <span>{Math.min(100, Math.max(0, progress))}% complete</span>
                    <span>Matures {formatDate(inv.maturity_date)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent transactions */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold font-display mb-4">Recent Transactions</h3>
        {(transactions || []).length === 0 ? (
          <EmptyState icon={<Receipt className="w-6 h-6" />} title="No transactions" />
        ) : (
          <div className="space-y-2">
            {(transactions || []).map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white capitalize">{txn.type.replace('_', ' ')}</p>
                  <p className="text-xs text-ink-400">{txn.description || formatDateTime(txn.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{formatCurrency(txn.amount)}</p>
                  <p className="text-xs text-ink-400">{formatDateTime(txn.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Deposits & Withdrawals side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="text-lg font-semibold font-display mb-4">Deposits ({(deposits || []).length})</h3>
          {(deposits || []).length === 0 ? (
            <EmptyState icon={<ArrowDownToLine className="w-6 h-6" />} title="No deposits" />
          ) : (
            <div className="space-y-2">
              {(deposits || []).slice(0, 10).map((dep) => (
                <div key={dep.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{formatCurrency(dep.amount)}</p>
                    <p className="text-xs text-ink-400 capitalize">{dep.method.replace('_', ' ')} · {formatDate(dep.created_at)}</p>
                  </div>
                  <Badge variant={dep.status === 'approved' ? 'success' : dep.status === 'pending' ? 'warning' : 'danger'}>{dep.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold font-display mb-4">Withdrawals ({(withdrawals || []).length})</h3>
          {(withdrawals || []).length === 0 ? (
            <EmptyState icon={<ArrowUpFromLine className="w-6 h-6" />} title="No withdrawals" />
          ) : (
            <div className="space-y-2">
              {(withdrawals || []).slice(0, 10).map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{formatCurrency(w.amount)}</p>
                    <p className="text-xs text-ink-400">{w.bank_name} · {formatDate(w.created_at)}</p>
                  </div>
                  <Badge variant={w.status === 'paid' ? 'success' : w.status === 'approved' ? 'info' : w.status === 'pending' ? 'warning' : 'danger'}>{w.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Referrals */}
      <Card className="mb-6">
        <h3 className="text-lg font-semibold font-display mb-4">Referrals ({(referrals || []).length})</h3>
        {(referrals || []).length === 0 ? (
          <EmptyState icon={<Users className="w-6 h-6" />} title="No referrals" />
        ) : (
          <div className="space-y-2">
            {(referrals || []).map((ref) => {
              const referred = ref.referred as { username?: string; email?: string; created_at?: string } | null;
              return (
                <div key={ref.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm text-white">{referred?.username || 'Unknown'}</p>
                    <p className="text-xs text-ink-400">{referred?.email} · {referred?.created_at ? formatDate(referred.created_at) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ref.bonus_amount > 0 && <span className="text-xs text-gold-300">{formatCurrency(ref.bonus_amount)}</span>}
                    <Badge variant={ref.status === 'paid' ? 'success' : 'warning'}>{ref.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Reset password modal */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setResetOpen(false)}>
          <div className="w-full max-w-md card-elevated rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Reset Password</h3>
            <div className="space-y-4">
              <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 4 characters" icon={<Lock className="w-4 h-4 text-ink-400" />} />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" icon={<Lock className="w-4 h-4 text-ink-400" />} />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-danger-400">Passwords do not match</p>
              )}
              {newPassword && newPassword.length < 4 && (
                <p className="text-xs text-danger-400">Password must be at least 4 characters</p>
              )}
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => { setResetOpen(false); setNewPassword(''); setConfirmPassword(''); }}>Cancel</Button>
                <Button fullWidth onClick={() => resetPassword.mutate()} loading={resetPassword.isPending}
                  disabled={!newPassword || newPassword !== confirmPassword || newPassword.length < 4}>
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-ink-800/50">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-sm font-medium text-white mt-0.5 truncate">{value}</p>
    </div>
  );
}
