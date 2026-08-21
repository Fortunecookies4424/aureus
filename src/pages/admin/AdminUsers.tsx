import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Search, Ban, CheckCircle2, Edit3, Eye, X, Save,
  KeyRound, UserCircle, Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Input, Badge, PageHeader, Modal, EmptyState, StatCard, Pagination } from '@/components/ui';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import type { Profile, Wallet } from '@/types/database';

export default function AdminUsers() {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editBalance, setEditBalance] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: users, isLoading } = useQuery<Profile[]>({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (search) {
        query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: userWallet } = useQuery<Wallet>({
    queryKey: ['admin-user-wallet', selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*').eq('user_id', selected!.id).maybeSingle();
      if (error) throw error;
      return data as Wallet;
    },
    enabled: !!selected,
  });

  const setStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const { error } = await supabase.rpc('admin_set_user_status', { p_user_id: userId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
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
        p_user_id: selected!.id,
        p_new_balance: parseFloat(newBalance),
        p_reason: balanceReason || 'Manual adjustment',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-user-wallet'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
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
        p_user_id: resetTarget!.id,
        p_new_password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Password reset!', 'User can now log in with the new password.');
      setResetTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to reset password';
      toast.error('Reset failed', msg);
    },
  });

  const impersonate = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('start_impersonation', { p_user_id: userId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Store impersonation info in localStorage for the banner
      localStorage.setItem('impersonating', JSON.stringify({
        logId: data.id,
        userId: data.user_id,
        userName: data.user_name,
        adminId: session?.user?.id,
      }));
      // Navigate to user dashboard
      navigate('/dashboard');
      toast.success('Viewing as user', `You are now viewing as ${data.user_name}.`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to impersonate';
      toast.error('Impersonation failed', msg);
    },
  });

  const allUsers = users || [];
  const totalRecords = allUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedUsers = allUsers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader title="User Management" subtitle="View and manage platform users" icon={<Users className="w-5 h-5" />} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Users" value={users?.length || 0} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Active" value={allUsers.filter((u) => u.status === 'active').length} icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Suspended" value={allUsers.filter((u) => u.status === 'suspended').length} icon={<Ban className="w-5 h-5" />} />
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, or username..." className="pl-11" />
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : allUsers.length === 0 ? (
          <EmptyState icon={<Users className="w-6 h-6" />} title="No users found" description="Users will appear here once they register." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Joined</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-ink-900 text-xs font-bold flex-shrink-0">
                            {getInitials(u.full_name || u.username)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{u.full_name || u.username}</p>
                            <p className="text-xs text-ink-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge variant={u.role === 'admin' ? 'gold' : 'default'}>{u.role}</Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={u.status === 'active' ? 'success' : 'danger'}>{u.status}</Badge>
                      </td>
                      <td className="py-3 text-ink-300">{formatDate(u.created_at)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelected(u)} className="p-2 rounded-lg text-ink-400 hover:text-gold-300 hover:bg-white/5 transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          {u.role !== 'admin' && (
                            <>
                              <button onClick={() => setResetTarget(u)} className="p-2 rounded-lg text-ink-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Reset Password">
                                <KeyRound className="w-4 h-4" />
                              </button>
                              <button onClick={() => impersonate.mutate(u.id)} className="p-2 rounded-lg text-ink-400 hover:text-gold-300 hover:bg-gold-400/10 transition-colors" title="View as User" disabled={impersonate.isPending}>
                                <UserCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setStatus.mutate({ userId: u.id, status: u.status === 'active' ? 'suspended' : 'active' })}
                                className={`p-2 rounded-lg transition-colors ${u.status === 'active' ? 'text-ink-400 hover:text-danger-400 hover:bg-danger-500/10' : 'text-ink-400 hover:text-success-400 hover:bg-success-500/10'}`}
                                title={u.status === 'active' ? 'Suspend' : 'Activate'}
                              >
                                {u.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </>
        )}
      </Card>

      {/* User detail modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setEditBalance(false); }} title="User Details" size="md">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center text-ink-900 font-bold text-xl">
                {getInitials(selected.full_name || selected.username)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{selected.full_name || selected.username}</h3>
                <p className="text-sm text-ink-400">{selected.email}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant={selected.role === 'admin' ? 'gold' : 'default'}>{selected.role}</Badge>
                  <Badge variant={selected.status === 'active' ? 'success' : 'danger'}>{selected.status}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoBox label="Username" value={selected.username} />
              <InfoBox label="Phone" value={selected.phone || '—'} />
              <InfoBox label="Referral Code" value={selected.referral_code} />
              <InfoBox label="Referred By" value={selected.referred_by || 'None'} />
            </div>

            <div className="card-elevated rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">Wallet</p>
                <button onClick={() => { setEditBalance(true); setNewBalance((userWallet?.balance || 0).toString()); }}
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
                <div className="grid grid-cols-2 gap-3">
                  <InfoBox label="Balance" value={formatCurrency(userWallet?.balance || 0)} />
                  <InfoBox label="Bonus Balance" value={formatCurrency(userWallet?.bonus_balance || 0)} />
                  <InfoBox label="Total Deposits" value={formatCurrency(userWallet?.total_deposits || 0)} />
                  <InfoBox label="Total Withdrawals" value={formatCurrency(userWallet?.total_withdrawals || 0)} />
                  <InfoBox label="Total Profit" value={formatCurrency(userWallet?.total_profit || 0)} />
                  <InfoBox label="Referral Earnings" value={formatCurrency(userWallet?.referral_earnings || 0)} />
                </div>
              )}
            </div>

            {selected.role !== 'admin' && (
              <div className="flex gap-2">
                <Button variant="secondary" fullWidth onClick={() => setResetTarget(selected)}>
                  <KeyRound className="w-4 h-4" /> Reset Password
                </Button>
                <Button fullWidth onClick={() => { setSelected(null); impersonate.mutate(selected.id); }} loading={impersonate.isPending}>
                  <UserCircle className="w-4 h-4" /> View as User
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetTarget} onClose={() => { setResetTarget(null); setNewPassword(''); setConfirmPassword(''); }} title="Reset User Password" size="sm">
        {resetTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-ink-800/50 border border-white/5">
              <p className="text-sm text-ink-300">Resetting password for:</p>
              <p className="text-sm font-semibold text-white">{resetTarget.full_name || resetTarget.username}</p>
              <p className="text-xs text-ink-400">{resetTarget.email}</p>
            </div>
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 4 characters" icon={<Lock className="w-4 h-4 text-ink-400" />} />
            <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" icon={<Lock className="w-4 h-4 text-ink-400" />} />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-danger-400">Passwords do not match</p>
            )}
            {newPassword && newPassword.length < 4 && (
              <p className="text-xs text-danger-400">Password must be at least 4 characters</p>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => { setResetTarget(null); setNewPassword(''); setConfirmPassword(''); }}>Cancel</Button>
              <Button fullWidth onClick={() => resetPassword.mutate()} loading={resetPassword.isPending}
                disabled={!newPassword || newPassword !== confirmPassword || newPassword.length < 4}>
                Reset Password
              </Button>
            </div>
            <p className="text-xs text-ink-400">The password will be securely hashed. This action will be logged in the admin activity log.</p>
          </div>
        )}
      </Modal>
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
