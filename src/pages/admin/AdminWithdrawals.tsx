import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpFromLine, Check, X, Clock, Building, Download, CheckSquare, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Badge, PageHeader, Modal, EmptyState, StatCard, Textarea, Pagination } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { exportToCSV, type DateFilter, getDateRange } from './AdminBalanceAudit';
import type { Withdrawal } from '@/types/database';

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pending' },
  approved: { variant: 'info' as const, label: 'Approved' },
  rejected: { variant: 'danger' as const, label: 'Rejected' },
  paid: { variant: 'success' as const, label: 'Paid' },
};

export default function AdminWithdrawals() {
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState('');

  const { data: withdrawals, isLoading } = useQuery<Withdrawal[]>({
    queryKey: ['admin-withdrawals', filter],
    queryFn: async () => {
      let query = supabase.from('withdrawals').select('*, user:profiles!withdrawals_user_id_fkey(id, email, full_name, username)').order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as Withdrawal[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_withdrawal', { p_withdrawal_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success('Withdrawal approved!');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to approve';
      toast.error('Approval failed', msg);
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_withdrawal_paid', { p_withdrawal_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success('Marked as paid!', 'User has been notified.');
    },
    onError: () => toast.error('Failed to mark as paid'),
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reject_withdrawal', { p_withdrawal_id: rejectTarget!.id, p_note: rejectNote });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success('Withdrawal rejected', 'Amount refunded to user wallet.');
      setRejectTarget(null);
      setRejectNote('');
    },
    onError: () => toast.error('Failed to reject withdrawal'),
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('bulk_approve_withdrawals', { p_withdrawal_ids: ids });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success(`Approved ${selectedIds.size} withdrawals!`);
      setSelectedIds(new Set());
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Bulk approve failed';
      toast.error('Bulk approve failed', msg);
    },
  });

  const bulkReject = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc('bulk_reject_withdrawals', { p_withdrawal_ids: ids, p_note: bulkRejectNote });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success(`Rejected ${selectedIds.size} withdrawals`);
      setSelectedIds(new Set());
      setBulkRejectOpen(false);
      setBulkRejectNote('');
    },
    onError: () => toast.error('Bulk reject failed'),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingIds = pagedWithdrawals.filter((w) => w.status === 'pending').map((w) => w.id);
    if (pendingIds.every((id) => selectedIds.has(id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pendingIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...pendingIds]));
    }
  };

  const filtered = useMemo(() => {
    let result = withdrawals || [];
    const range = getDateRange(dateFilter);
    if (range) {
      result = result.filter((w) => {
        const dt = new Date(w.created_at);
        return dt >= range.start && dt <= range.end;
      });
    }
    return result;
  }, [withdrawals, dateFilter]);

  const todayTotal = filtered.filter((w) => {
    const dt = new Date(w.created_at); const t = new Date(); return dt.toDateString() === t.toDateString() && w.status === 'paid';
  }).reduce((s, w) => s + Number(w.amount), 0);
  const weekTotal = filtered.filter((w) => {
    const dt = new Date(w.created_at); const t = new Date(); const weekAgo = new Date(t); weekAgo.setDate(weekAgo.getDate() - 7); return dt >= weekAgo && w.status === 'paid';
  }).reduce((s, w) => s + Number(w.amount), 0);
  const monthTotal = filtered.filter((w) => {
    const dt = new Date(w.created_at); const t = new Date(); const monthAgo = new Date(t); monthAgo.setMonth(monthAgo.getMonth() - 1); return dt >= monthAgo && w.status === 'paid';
  }).reduce((s, w) => s + Number(w.amount), 0);
  const overallTotal = filtered.filter((w) => w.status === 'paid').reduce((s, w) => s + Number(w.amount), 0);

  const allWithdrawals = filtered;
  const totalRecords = allWithdrawals.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedWithdrawals = allWithdrawals.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = () => {
    exportToCSV('withdrawals.csv', allWithdrawals.map((w) => ({
      User: (w.user as { full_name?: string })?.full_name || '',
      Amount: w.amount,
      Fee: w.fee_amount || 0,
      Bank: w.bank_name,
      Account: w.bank_account_number,
      Status: w.status,
      Date: formatDateTime(w.created_at),
    })));
  };

  return (
    <div>
      <PageHeader title="Withdrawal Management" subtitle="Review and process withdrawal requests"
        icon={<ArrowUpFromLine className="w-5 h-5" />}
        action={<Button variant="secondary" onClick={handleExport} disabled={allWithdrawals.length === 0}><Download className="w-4 h-4" /> Export CSV</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <StatCard label="Today" value={formatCurrency(todayTotal)} icon={<ArrowUpFromLine className="w-5 h-5" />} />
        <StatCard label="This Week" value={formatCurrency(weekTotal)} icon={<Clock className="w-5 h-5" />} />
        <StatCard label="This Month" value={formatCurrency(monthTotal)} icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Overall" value={formatCurrency(overallTotal)} icon={<Check className="w-5 h-5" />} />
        <StatCard label="Transactions" value={totalRecords} icon={<ArrowUpFromLine className="w-5 h-5" />} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {['pending', 'approved', 'paid', 'rejected', 'all'].map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? 'bg-gold-400/10 border border-gold-400/30 text-gold-200' : 'bg-ink-800 border border-white/10 text-ink-300 hover:text-white'}`}>
            {f}
          </button>
        ))}
        <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value as DateFilter); setPage(1); }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-ink-800 border border-white/10 text-white outline-none focus:border-gold-400/30">
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This Week</option>
          <option value="last_week">Last Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      <Card>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-gold-400/5 border border-gold-400/20">
            <span className="text-sm text-gold-200 font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="primary" onClick={() => bulkApprove.mutate([...selectedIds])} loading={bulkApprove.isPending}>
              <Check className="w-3.5 h-3.5" /> Approve All
            </Button>
            <Button size="sm" variant="danger" onClick={() => setBulkRejectOpen(true)}>
              <X className="w-3.5 h-3.5" /> Reject All
            </Button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-ink-400 hover:text-white ml-auto">Clear</button>
          </div>
        )}
        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : allWithdrawals.length === 0 ? (
          <EmptyState icon={<ArrowUpFromLine className="w-6 h-6" />} title="No withdrawals" description={`No ${filter} withdrawals to show.`} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 font-medium w-10">
                      <button onClick={toggleSelectAll} className="text-ink-400 hover:text-gold-300">
                        {pagedWithdrawals.filter((w) => w.status === 'pending').every((w) => selectedIds.has(w.id)) && pagedWithdrawals.some((w) => w.status === 'pending')
                          ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Fee</th>
                    <th className="pb-3 font-medium">Bank Details</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedWithdrawals.map((w) => {
                    const user = w.user as { username?: string; email?: string; full_name?: string } | null;
                    return (
                      <tr key={w.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3">
                          {w.status === 'pending' && (
                            <button onClick={() => toggleSelect(w.id)} className="text-ink-400 hover:text-gold-300">
                              {selectedIds.has(w.id) ? <CheckSquare className="w-4 h-4 text-gold-300" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="py-3">
                          <Link to={`/admin/users/${w.user_id}`} className="group">
                            <p className="font-medium text-white group-hover:text-gold-300 transition-colors">{user?.full_name || user?.username || 'User'}</p>
                            <p className="text-xs text-ink-400">{user?.email}</p>
                          </Link>
                        </td>
                        <td className="py-3 text-white font-medium">{formatCurrency(w.amount)}</td>
                        <td className="py-3 text-ink-300 text-xs">{w.fee_amount > 0 ? formatCurrency(w.fee_amount) : '—'}</td>
                        <td className="py-3 text-xs text-ink-300">
                          <p className="flex items-center gap-1"><Building className="w-3 h-3" /> {w.bank_name}</p>
                          <p>{w.bank_account_name}</p>
                          <p className="text-ink-400">{w.bank_account_number}</p>
                        </td>
                        <td className="py-3"><Badge variant={statusConfig[w.status].variant}>{statusConfig[w.status].label}</Badge></td>
                        <td className="py-3 text-ink-300 text-xs">{formatDateTime(w.created_at)}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {w.status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => approve.mutate(w.id)} loading={approve.isPending}><Check className="w-3.5 h-3.5" /> Approve</Button>
                                <Button size="sm" variant="danger" onClick={() => setRejectTarget(w)}><X className="w-3.5 h-3.5" /></Button>
                              </>
                            )}
                            {w.status === 'approved' && (
                              <Button size="sm" onClick={() => markPaid.mutate(w.id)} loading={markPaid.isPending}><Check className="w-3.5 h-3.5" /> Mark Paid</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize}
              onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </>
        )}
      </Card>

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Withdrawal" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">Reject withdrawal of {rejectTarget && formatCurrency(rejectTarget.amount)}? The amount will be refunded to the user's wallet.</p>
          <Textarea label="Reason (optional)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Why is this withdrawal being rejected?" />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={() => reject.mutate()} loading={reject.isPending}>Reject & Refund</Button>
          </div>
        </div>
      </Modal>

      <Modal open={bulkRejectOpen} onClose={() => setBulkRejectOpen(false)} title={`Reject ${selectedIds.size} Withdrawals`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">Are you sure you want to reject {selectedIds.size} withdrawals? Amounts will be refunded to user wallets.</p>
          <Textarea label="Reason (optional)" value={bulkRejectNote} onChange={(e) => setBulkRejectNote(e.target.value)} placeholder="Why are these withdrawals being rejected?" />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setBulkRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={() => bulkReject.mutate([...selectedIds])} loading={bulkReject.isPending}>Reject All</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
