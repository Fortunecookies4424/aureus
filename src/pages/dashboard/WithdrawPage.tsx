import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpFromLine, Clock, Check, XCircle, Wallet, Building } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWallet, useMyWithdrawals, useRequestWithdrawal } from '@/hooks/useUserData';
import { useSettings } from '@/hooks/usePublicData';
import { useToast } from '@/context/ToastContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Badge, SkeletonCard, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Withdrawal } from '@/types/database';

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pending', icon: Clock },
  approved: { variant: 'info' as const, label: 'Approved', icon: Check },
  rejected: { variant: 'danger' as const, label: 'Rejected', icon: XCircle },
  paid: { variant: 'success' as const, label: 'Paid', icon: Check },
};

export default function WithdrawPage() {
  const { profile } = useAuth();
  const { data: wallet } = useWallet();
  const { data: withdrawals, isLoading } = useMyWithdrawals();
  const { data: settings } = useSettings();
  const requestWithdrawal = useRequestWithdrawal();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [accountName, setAccountName] = useState(profile?.bank_account_name || '');
  const [accountNumber, setAccountNumber] = useState(profile?.bank_account_number || '');
  const [submitting, setSubmitting] = useState(false);

  const s = settings!;
  const balance = wallet?.balance || 0;
  const minW = s?.min_withdrawal || 1000;
  const maxW = s?.max_withdrawal || 5000000;

  const amt = parseFloat(amount) || 0;
  const { data: feeInfo } = useQuery<{ fee: number; net: number; enabled: boolean }>({
    queryKey: ['withdrawal-fee', amt],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_withdrawal_fee', { p_amount: amt });
      if (error) throw error;
      return data as { fee: number; net: number; enabled: boolean };
    },
    enabled: amt > 0,
  });

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt < minW) { toast.error('Below minimum', `Minimum withdrawal is ${formatCurrency(minW)}`); return; }
    if (amt > maxW) { toast.error('Above maximum', `Maximum withdrawal is ${formatCurrency(maxW)}`); return; }
    if (amt > balance) { toast.error('Insufficient balance'); return; }
    if (!bankName || !accountName || !accountNumber) { toast.error('Bank details required', 'Please fill in all bank details.'); return; }

    setSubmitting(true);
    try {
      await requestWithdrawal.mutateAsync({
        amount: amt, bankName, bankAccountName: accountName, bankAccountNumber: accountNumber,
      });
      toast.success('Withdrawal requested!', 'Your request is being processed. You\'ll be notified on update.');
      setAmount('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to request withdrawal';
      toast.error('Withdrawal failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Withdraw" subtitle="Request a withdrawal to your bank account" icon={<ArrowUpFromLine className="w-5 h-5" />} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Available Balance" value={formatCurrency(balance)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Total Withdrawn" value={formatCurrency(wallet?.total_withdrawals || 0)} icon={<ArrowUpFromLine className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Withdrawal form */}
        <Card>
          <h3 className="text-lg font-semibold font-display mb-4">Request Withdrawal</h3>
          <div className="space-y-4">
            <Input
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${formatCurrency(minW)}`}
              icon={<span className="text-gold-300 font-semibold">₦</span>}
              hint={`Limits: ${formatCurrency(minW)} – ${formatCurrency(maxW)}`}
            />
            <div className="flex gap-2">
              <button onClick={() => setAmount(Math.min(balance, maxW).toString())}
                className="text-xs px-3 py-1.5 rounded-lg bg-ink-800 border border-white/10 text-ink-300 hover:text-gold-300 transition-colors flex-1">
                Withdraw Max
              </button>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-4">
              <p className="text-sm font-medium text-ink-100 flex items-center gap-2">
                <Building className="w-4 h-4 text-gold-300" /> Bank Details
              </p>
              <Input label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Access Bank" />
              <Input label="Account Name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="John Doe" />
              <Input label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" />
            </div>

            <Button fullWidth size="lg" onClick={handleSubmit} loading={submitting}>
              Request Withdrawal
            </Button>
            {feeInfo && feeInfo.enabled && amt > 0 && (
              <div className="p-3 rounded-xl bg-ink-800/50 border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">Withdrawal Amount</span>
                  <span className="text-white font-medium">{formatCurrency(amt)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-300">Withdrawal Fee</span>
                  <span className="text-warning-400 font-medium">-{formatCurrency(feeInfo.fee)}</span>
                </div>
                <div className="border-t border-white/5 pt-1.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Net Amount Received</span>
                  <span className="text-lg font-bold text-gold-300">{formatCurrency(feeInfo.net)}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Withdrawal history */}
        <Card>
          <h3 className="text-lg font-semibold font-display mb-4">Withdrawal History</h3>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : (withdrawals || []).length === 0 ? (
            <EmptyState icon={<ArrowUpFromLine className="w-6 h-6" />} title="No withdrawals yet" description="Your withdrawal requests will appear here." />
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
              {(withdrawals || []).map((w, i) => (
                <WithdrawalRow key={w.id} w={w} index={i} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function WithdrawalRow({ w, index }: { w: Withdrawal; index: number }) {
  const config = statusConfig[w.status];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-3 rounded-xl bg-ink-800/50 border border-white/5"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-white">{formatCurrency(w.amount)}</span>
        <Badge variant={config.variant}>
          <config.icon className="w-3 h-3" /> {config.label}
        </Badge>
      </div>
      <div className="text-xs text-ink-400 space-y-0.5">
        <p>{w.bank_name} · {w.bank_account_number}</p>
        <p>{formatDateTime(w.created_at)}</p>
        {w.admin_note && <p className="text-ink-500 italic">Note: {w.admin_note}</p>}
      </div>
    </motion.div>
  );
}
