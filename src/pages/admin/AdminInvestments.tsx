import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, PageHeader, EmptyState, StatCard, Pagination } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Investment } from '@/types/database';

const statusConfig = {
  active: { variant: 'gold' as const, label: 'Active' },
  completed: { variant: 'success' as const, label: 'Completed' },
  cancelled: { variant: 'danger' as const, label: 'Cancelled' },
};

function getProgress(start: string, maturity: string): number {
  const startMs = new Date(start).getTime();
  const maturityMs = new Date(maturity).getTime();
  const now = Date.now();
  if (now >= maturityMs) return 100;
  if (now <= startMs) return 0;
  return Math.round(((now - startMs) / (maturityMs - startMs)) * 100);
}

export default function AdminInvestments() {
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: investments, isLoading } = useQuery<Investment[]>({
    queryKey: ['admin-investments', filter],
    queryFn: async () => {
      let query = supabase.from('investments').select('*, user:profiles!investments_user_id_fkey(id, email, full_name, username)').order('created_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Investment[];
    },
  });

  const totalActive = (investments || []).filter((i) => i.status === 'active').reduce((s, i) => s + Number(i.amount), 0);
  const totalProfit = (investments || []).filter((i) => i.status === 'completed').reduce((s, i) => s + Number(i.expected_profit), 0);

  const allInvestments = investments || [];
  const totalRecords = allInvestments.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedInvestments = allInvestments.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader title="Investments" subtitle="Monitor all platform investments" icon={<TrendingUp className="w-5 h-5" />} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Investments" value={allInvestments.length} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Active Volume" value={formatCurrency(totalActive)} icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Profit Paid" value={formatCurrency(totalProfit)} icon={<CheckCircle2 className="w-5 h-5" />} />
      </div>

      <div className="flex gap-2 mb-4">
        {['all', 'active', 'completed', 'cancelled'].map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${filter === f ? 'bg-gold-400/10 border border-gold-400/30 text-gold-200' : 'bg-ink-800 border border-white/10 text-ink-300 hover:text-white'}`}>
            {f}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : allInvestments.length === 0 ? (
          <EmptyState icon={<TrendingUp className="w-6 h-6" />} title="No investments" description={`No ${filter} investments to show.`} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Package</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Expected Profit</th>
                    <th className="pb-3 font-medium">Progress</th>
                    <th className="pb-3 font-medium">Maturity</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedInvestments.map((inv) => {
                    const user = inv.user as { username?: string; full_name?: string } | null;
                    const progress = inv.status === 'completed' ? 100 : getProgress(inv.start_date, inv.maturity_date);
                    return (
                      <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3">
                          <Link to={`/admin/users/${inv.user_id}`} className="group">
                            <p className="font-medium text-white group-hover:text-gold-300 transition-colors">{user?.full_name || user?.username || 'User'}</p>
                          </Link>
                        </td>
                        <td className="py-3 text-ink-300">{inv.package_name}</td>
                        <td className="py-3 text-white font-medium">{formatCurrency(inv.amount)}</td>
                        <td className="py-3 text-success-400">{formatCurrency(inv.expected_profit)}</td>
                        <td className="py-3">
                          <div className="w-24">
                            <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                              <div className="h-full gold-gradient rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-xs text-ink-400 mt-1">{progress}%</p>
                          </div>
                        </td>
                        <td className="py-3 text-ink-300 text-xs">{formatDate(inv.maturity_date)}</td>
                        <td className="py-3"><Badge variant={statusConfig[inv.status].variant}>{statusConfig[inv.status].label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </>
        )}
      </Card>
    </div>
  );
}
