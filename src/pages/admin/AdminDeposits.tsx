import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ArrowDownToLine, Check, X, Clock, Search, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Badge, PageHeader, Modal, EmptyState, StatCard, Input, Textarea, Pagination } from '@/components/ui';
import { formatCurrency, formatDateTime, getInitials } from '@/lib/utils';
import { exportToCSV, type DateFilter, getDateRange } from './AdminBalanceAudit';
import type { Deposit } from '@/types/database';

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pending' },
  approved: { variant: 'success' as const, label: 'Approved' },
  rejected: { variant: 'danger' as const, label: 'Rejected' },
};

export default function AdminDeposits() {
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [rejectTarget, setRejectTarget] = useState<Deposit | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: deposits, isLoading } = useQuery<Deposit[]>({
    queryKey: ['admin-deposits', filter],
    queryFn: async () => {
      let query = supabase.from('deposits').select('*, user:profiles!deposits_user_id_fkey(id, email, full_name, username)').order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as Deposit[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('approve_deposit', { p_deposit_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-deposits'] });
      toast.success('Deposit approved!', 'Wallet credited and user notified.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to approve';
      toast.error('Approval failed', msg);
    },
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reject_deposit', { p_deposit_id: rejectTarget!.id, p_note: rejectNote });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-deposits'] });
      toast.success('Deposit rejected');
      setRejectTarget(null);
      setRejectNote('');
    },
    onError: () => toast.error('Failed to reject deposit'),
  });

  const filtered = useMemo(() => {
    let result = deposits || [];
    const range = getDateRange(dateFilter);
    if (range) {
      result = result.filter((d) => {
        const dt = new Date(d.created_at);
        return dt >= range.start && dt <= range.end;
      });
    }
    return result;
  }, [deposits, dateFilter]);

  const todayTotal = filtered.filter((d) => {
    const dt = new Date(d.created_at); const t = new Date(); return dt.toDateString() === t.toDateString() && d.status === 'approved';
  }).reduce((s, d) => s + Number(d.amount), 0);
  const weekTotal = filtered.filter((d) => {
    const dt = new Date(d.created_at); const t = new Date(); const weekAgo = new Date(t); weekAgo.setDate(weekAgo.getDate() - 7); return dt >= weekAgo && d.status === 'approved';
  }).reduce((s, d) => s + Number(d.amount), 0);
  const monthTotal = filtered.filter((d) => {
    const dt = new Date(d.created_at); const t = new Date(); const monthAgo = new Date(t); monthAgo.setMonth(monthAgo.getMonth() - 1); return dt >= monthAgo && d.status === 'approved';
  }).reduce((s, d) => s + Number(d.amount), 0);
  const overallTotal = filtered.filter((d) => d.status === 'approved').reduce((s, d) => s + Number(d.amount), 0);

  const allDeposits = filtered;
  const totalRecords = allDeposits.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedDeposits = allDeposits.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = () => {
    exportToCSV('deposits.csv', allDeposits.map((d) => ({
      User: (d.user as { full_name?: string })?.full_name || '',
      Amount: d.amount,
      Method: d.method,
      Status: d.status,
      Date: formatDateTime(d.created_at),
    })));
  };

  return (
    <div>
      <PageHeader title="Deposit Management" subtitle="Review and process user deposits"
        icon={<ArrowDownToLine className="w-5 h-5" />}
        action={<Button variant="secondary" onClick={handleExport} disabled={allDeposits.length === 0}><Download className="w-4 h-4" /> Export CSV</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <StatCard label="Today" value={formatCurrency(todayTotal)} icon={<ArrowDownToLine className="w-5 h-5" />} />
        <StatCard label="This Week" value={formatCurrency(weekTotal)} icon={<Clock className="w-5 h-5" />} />
        <StatCard label="This Month" value={formatCurrency(monthTotal)} icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Overall" value={formatCurrency(overallTotal)} icon={<Check className="w-5 h-5" />} />
        <StatCard label="Transactions" value={totalRecords} icon={<ArrowDownToLine className="w-5 h-5" />} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
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
        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : allDeposits.length === 0 ? (
          <EmptyState icon={<ArrowDownToLine className="w-6 h-6" />} title="No deposits" description={`No ${filter} deposits to show.`} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Method</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedDeposits.map((dep) => {
                    const user = dep.user as { username?: string; email?: string; full_name?: string } | null;
                    return (
                      <tr key={dep.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3">
                          <p className="font-medium text-white">{user?.full_name || user?.username || 'User'}</p>
                          <p className="text-xs text-ink-400">{user?.email}</p>
                        </td>
                        <td className="py-3 text-white font-medium">{formatCurrency(dep.amount)}</td>
                        <td className="py-3 text-ink-300 capitalize">{dep.method.replace('_', ' ')}</td>
                        <td className="py-3"><Badge variant={statusConfig[dep.status].variant}>{statusConfig[dep.status].label}</Badge></td>
                        <td className="py-3 text-ink-300 text-xs">{formatDateTime(dep.created_at)}</td>
                        <td className="py-3 text-right">
                          {dep.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="primary" onClick={() => approve.mutate(dep.id)} loading={approve.isPending}><Check className="w-3.5 h-3.5" /> Approve</Button>
                              <Button size="sm" variant="danger" onClick={() => setRejectTarget(dep)}><X className="w-3.5 h-3.5" /> Reject</Button>
                            </div>
                          )}
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

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Deposit" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">Are you sure you want to reject this deposit of {rejectTarget && formatCurrency(rejectTarget.amount)}?</p>
          <Textarea label="Reason (optional)" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Why is this deposit being rejected?" />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={() => reject.mutate()} loading={reject.isPending}>Reject Deposit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
