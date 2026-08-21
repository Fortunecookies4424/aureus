import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { ScrollText, Search, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Input, Badge, PageHeader, EmptyState, Pagination, Button } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { BalanceAuditLog } from '@/types/database';

type DateFilter = 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year';

function getDateRange(filter: DateFilter): { start: Date; end: Date } | null {
  if (filter === 'all') return null;
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (filter) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      break;
    case 'this_week': {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'last_week': {
      const day = start.getDay();
      start.setDate(start.getDate() - day - 7);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - day - 1);
      break;
    }
    case 'this_month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last_month':
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      break;
    case 'this_year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

export function exportToCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { type DateFilter, getDateRange };

export default function AdminBalanceAudit() {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [adjType, setAdjType] = useState('all');
  const [adminFilter, setAdminFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: logs, isLoading } = useQuery<BalanceAuditLog[]>({
    queryKey: ['balance-audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('balance_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as BalanceAuditLog[];
    },
  });

  const { data: admins } = useQuery<{ admin_id: string; admin_name: string }[]>({
    queryKey: ['audit-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('balance_audit_log')
        .select('admin_id, admin_name')
        .order('admin_name');
      if (error) throw error;
      const unique = new Map<string, string>();
      (data || []).forEach((r: { admin_id: string; admin_name: string }) => {
        if (!unique.has(r.admin_id)) unique.set(r.admin_id, r.admin_name);
      });
      return Array.from(unique, ([admin_id, admin_name]) => ({ admin_id, admin_name }));
    },
  });

  const filtered = useMemo(() => {
    let result = logs || [];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.user_name.toLowerCase().includes(q) ||
        l.user_phone?.toLowerCase().includes(q) ||
        l.reference_id.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
      );
    }
    if (adjType !== 'all') result = result.filter((l) => l.adjustment_type === adjType);
    if (adminFilter !== 'all') result = result.filter((l) => l.admin_id === adminFilter);
    const range = getDateRange(dateFilter);
    if (range) {
      result = result.filter((l) => {
        const d = new Date(l.created_at);
        return d >= range.start && d <= range.end;
      });
    }
    return result;
  }, [logs, search, adjType, adminFilter, dateFilter]);

  const totalRecords = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedLogs = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleExport = () => {
    exportToCSV('balance-audit-log.csv', filtered.map((l) => ({
      Reference: l.reference_id,
      User: l.user_name,
      Phone: l.user_phone || '',
      'Previous Balance': l.previous_balance,
      'New Balance': l.new_balance,
      'Amount Changed': l.amount_changed,
      Type: l.adjustment_type,
      Reason: l.reason,
      Admin: l.admin_name,
      DateTime: formatDateTime(l.created_at),
    })));
  };

  return (
    <div>
      <PageHeader
        title="Balance Adjustment History"
        subtitle="Immutable audit log of all manual balance changes"
        icon={<ScrollText className="w-5 h-5" />}
        action={<Button variant="secondary" onClick={handleExport} disabled={filtered.length === 0}><Download className="w-4 h-4" /> Export CSV</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="card-elevated rounded-2xl p-4">
          <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Total Adjustments</p>
          <p className="text-2xl font-bold text-white">{totalRecords}</p>
        </div>
        <div className="card-elevated rounded-2xl p-4">
          <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Total Credited</p>
          <p className="text-2xl font-bold text-success-400">{formatCurrency(filtered.filter((l) => l.adjustment_type === 'credit').reduce((s, l) => s + l.amount_changed, 0))}</p>
        </div>
        <div className="card-elevated rounded-2xl p-4">
          <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Total Debited</p>
          <p className="text-2xl font-bold text-danger-400">{formatCurrency(Math.abs(filtered.filter((l) => l.adjustment_type === 'debit').reduce((s, l) => s + l.amount_changed, 0)))}</p>
        </div>
        <div className="card-elevated rounded-2xl p-4">
          <p className="text-xs text-ink-400 uppercase tracking-wider mb-1">Net Change</p>
          <p className="text-2xl font-bold text-gold-300">{formatCurrency(filtered.reduce((s, l) => s + l.amount_changed, 0))}</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, phone, reference..." className="pl-11" />
          </div>
          <select value={adjType} onChange={(e) => { setAdjType(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl bg-ink-800 border border-white/10 text-sm text-white outline-none focus:border-gold-400/30">
            <option value="all">All Types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
          <select value={adminFilter} onChange={(e) => { setAdminFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl bg-ink-800 border border-white/10 text-sm text-white outline-none focus:border-gold-400/30">
            <option value="all">All Admins</option>
            {(admins || []).map((a) => (
              <option key={a.admin_id} value={a.admin_id}>{a.admin_name}</option>
            ))}
          </select>
          <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value as DateFilter); setPage(1); }}
            className="px-4 py-2.5 rounded-xl bg-ink-800 border border-white/10 text-sm text-white outline-none focus:border-gold-400/30">
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

        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : pagedLogs.length === 0 ? (
          <EmptyState icon={<ScrollText className="w-6 h-6" />} title="No audit records" description="Balance adjustment logs will appear here." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 font-medium">Reference</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Previous</th>
                    <th className="pb-3 font-medium">New</th>
                    <th className="pb-3 font-medium">Change</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Reason</th>
                    <th className="pb-3 font-medium">Admin</th>
                    <th className="pb-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-mono text-xs text-gold-300">{l.reference_id}</td>
                      <td className="py-3">
                        <p className="font-medium text-white">{l.user_name}</p>
                        <p className="text-xs text-ink-400">{l.user_phone || '—'}</p>
                      </td>
                      <td className="py-3 text-ink-300">{formatCurrency(l.previous_balance)}</td>
                      <td className="py-3 text-white font-medium">{formatCurrency(l.new_balance)}</td>
                      <td className={`py-3 font-medium ${l.amount_changed >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                        {l.amount_changed >= 0 ? '+' : ''}{formatCurrency(l.amount_changed)}
                      </td>
                      <td className="py-3">
                        <Badge variant={l.adjustment_type === 'credit' ? 'success' : 'danger'}>
                          {l.adjustment_type}
                        </Badge>
                      </td>
                      <td className="py-3 text-ink-300 text-xs max-w-[180px] truncate">{l.reason}</td>
                      <td className="py-3 text-ink-300 text-xs">{l.admin_name}</td>
                      <td className="py-3 text-ink-400 text-xs">{formatDateTime(l.created_at)}</td>
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
    </div>
  );
}
