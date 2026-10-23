import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Award, Users, Gift } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, PageHeader, EmptyState, StatCard, Pagination } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Transaction } from '@/types/database';

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  deposit: { icon: ArrowDownToLine, color: 'text-success-400', label: 'Deposit' },
  withdrawal: { icon: ArrowUpFromLine, color: 'text-warning-400', label: 'Withdrawal' },
  investment: { icon: TrendingUp, color: 'text-blue-400', label: 'Investment' },
  profit: { icon: Award, color: 'text-gold-300', label: 'Profit' },
  referral: { icon: Users, color: 'text-purple-400', label: 'Referral' },
  bonus: { icon: Gift, color: 'text-gold-300', label: 'Bonus' },
};

export default function AdminTransactions() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, user:profiles!transactions_user_id_fkey(id, email, full_name, username)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const totalVolume = (transactions || []).reduce((s, t) => s + Number(t.amount), 0);

  const allTxns = transactions || [];
  const totalRecords = allTxns.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedTxns = allTxns.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Complete transaction ledger" icon={<Receipt className="w-5 h-5" />} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Transactions" value={allTxns.length} icon={<Receipt className="w-5 h-5" />} />
        <StatCard label="Total Volume" value={formatCurrency(totalVolume)} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Completed" value={allTxns.filter((t) => t.status === 'completed').length} icon={<Award className="w-5 h-5" />} />
      </div>

      <Card>
        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : allTxns.length === 0 ? (
          <EmptyState icon={<Receipt className="w-6 h-6" />} title="No transactions" description="Platform transactions will appear here." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedTxns.map((txn) => {
                    const user = txn.user as { username?: string; full_name?: string } | null;
                    const config = typeConfig[txn.type] || typeConfig.bonus;
                    const isPositive = ['deposit', 'profit', 'referral', 'bonus'].includes(txn.type);
                    return (
                      <tr key={txn.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3">
                          <Link to={`/admin/users/${txn.user_id}`} className="group">
                            <p className="font-medium text-white group-hover:text-gold-300 transition-colors">{user?.full_name || user?.username || 'User'}</p>
                          </Link>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <config.icon className={`w-4 h-4 ${config.color}`} />
                            <span className="text-ink-200">{config.label}</span>
                          </div>
                        </td>
                        <td className={`py-3 font-medium ${isPositive ? 'text-success-400' : 'text-white'}`}>
                          {isPositive ? '+' : '-'}{formatCurrency(txn.amount)}
                        </td>
                        <td className="py-3 text-ink-300 text-xs max-w-[200px] truncate">{txn.description}</td>
                        <td className="py-3">
                          <Badge variant={txn.status === 'completed' ? 'success' : txn.status === 'pending' ? 'warning' : 'danger'}>
                            {txn.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-ink-300 text-xs">{formatDateTime(txn.created_at)}</td>
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
