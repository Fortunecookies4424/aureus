import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, Check, Clock, XCircle, Gift, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useWallet, useMyDeposits, useCreateDeposit } from '@/hooks/useUserData';
import { useRedeemCoupon } from '@/hooks/useCoupons';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Badge, SkeletonCard, EmptyState, PageHeader, StatCard, Modal } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Deposit, PaymentGateway } from '@/types/database';

const statusConfig = {
  pending: { variant: 'warning' as const, label: 'Pending', icon: Clock },
  approved: { variant: 'success' as const, label: 'Approved', icon: Check },
  rejected: { variant: 'danger' as const, label: 'Rejected', icon: XCircle },
};

export default function DepositPage() {
  const { data: wallet } = useWallet();
  const { data: deposits, isLoading } = useMyDeposits();
  const createDeposit = useCreateDeposit();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const { data: gateways } = useQuery<PaymentGateway[]>({
    queryKey: ['enabled-payment-gateways'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_gateways').select('*').eq('enabled', true).order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PaymentGateway[];
    },
  });

  const enabledGateways = (gateways || []).filter((g) => g.enabled);
  const defaultGateway = enabledGateways.find((g) => g.is_default) || enabledGateways[0];

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!selectedGateway && !defaultGateway) { toast.error('No payment gateway available'); return; }
    const gatewaySlug = selectedGateway || defaultGateway?.slug || 'online';
    setSubmitting(true);
    try {
      await createDeposit.mutateAsync({
        amount: amt,
        method: gatewaySlug as 'bank_transfer',
        reference: `DEP-${Date.now().toString(36).toUpperCase()}`,
      });
      toast.success('Deposit initiated!', `Your deposit via ${gatewaySlug} is being processed.`);
      setModalOpen(false);
      setAmount('');
      setSelectedGateway('');
    } catch {
      toast.error('Failed to submit', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Deposit"
        subtitle="Add funds to your wallet via online payment"
        icon={<ArrowDownToLine className="w-5 h-5" />}
        action={enabledGateways.length > 0 ? <Button onClick={() => { setSelectedGateway(defaultGateway?.slug || ''); setModalOpen(true); }}>New Deposit</Button> : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Wallet Balance" value={formatCurrency(wallet?.balance || 0)} icon={<ArrowDownToLine className="w-5 h-5" />} />
        <StatCard label="Total Deposits" value={formatCurrency(wallet?.total_deposits || 0)} icon={<Check className="w-5 h-5" />} />
      </div>

      {/* Available payment gateways */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Available Payment Methods</h3>
        {enabledGateways.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CreditCard className="w-6 h-6" />}
              title="No payment gateways available"
              description="The administrator hasn't enabled any online payment gateways yet. Please check back later."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enabledGateways.map((gw) => (
              <Card key={gw.id} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 mx-auto mb-3">
                  <CreditCard className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-white">{gw.name}</p>
                <p className="text-xs text-ink-400 mt-1 capitalize">{gw.environment}</p>
                {gw.is_default && <Badge variant="gold" >Default</Badge>}
                {gw.supported_methods.length > 0 && (
                  <p className="text-xs text-ink-500 mt-2">{gw.supported_methods.map((m) => m.replace('_', ' ')).join(', ')}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Gift Code */}
      <RedeemCouponSection />

      {/* Deposit history */}
      <Card>
        <h3 className="text-lg font-semibold font-display mb-4">Deposit History</h3>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (deposits || []).length === 0 ? (
          <EmptyState icon={<ArrowDownToLine className="w-6 h-6" />} title="No deposits yet" description="Click 'New Deposit' to add funds to your wallet." />
        ) : (
          <div className="space-y-3">
            {(deposits || []).map((dep, i) => (
              <DepositRow key={dep.id} dep={dep} index={i} />
            ))}
          </div>
        )}
      </Card>

      {/* New deposit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Deposit" size="md">
        <div className="space-y-5">
          {/* Gateway selection */}
          <div>
            <label className="block text-sm font-medium text-ink-100 mb-2">Select Payment Gateway</label>
            <div className="grid grid-cols-2 gap-2">
              {enabledGateways.map((gw) => (
                <button
                  key={gw.id}
                  onClick={() => setSelectedGateway(gw.slug)}
                  className={`p-3 rounded-xl border text-center transition-all ${selectedGateway === gw.slug ? 'border-gold-400/50 bg-gold-400/10' : 'border-white/10 bg-ink-800/50 hover:border-white/20'}`}
                >
                  <CreditCard className={`w-5 h-5 mx-auto mb-1.5 ${selectedGateway === gw.slug ? 'text-gold-300' : 'text-ink-400'}`} />
                  <span className={`text-xs ${selectedGateway === gw.slug ? 'text-gold-200' : 'text-ink-300'}`}>{gw.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card-elevated rounded-xl p-4">
            <p className="text-xs text-gold-200 font-medium mb-1">Online Payment</p>
            <p className="text-xs text-ink-300">You'll be redirected to the payment gateway to complete your deposit securely. Your wallet will be credited automatically upon successful payment.</p>
          </div>

          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" icon={<span className="text-gold-300 font-semibold">₦</span>} />

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={handleSubmit} loading={submitting} disabled={!amount || !selectedGateway}>Proceed to Payment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DepositRow({ dep, index }: { dep: Deposit; index: number }) {
  const config = statusConfig[dep.status];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between p-3 rounded-xl bg-ink-800/50 border border-white/5 hover:border-white/10 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-ink-800 border border-white/5 flex items-center justify-center text-gold-300">
          <ArrowDownToLine className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{formatCurrency(dep.amount)}</p>
          <p className="text-xs text-ink-400 capitalize">{dep.method.replace('_', ' ')} · {formatDateTime(dep.created_at)}</p>
        </div>
      </div>
      <Badge variant={config.variant}>
        <config.icon className="w-3 h-3" /> {config.label}
      </Badge>
    </motion.div>
  );
}

function RedeemCouponSection() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const redeem = useRedeemCoupon();
  const { data: wallet } = useWallet();

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setResult(null);
    try {
      const res = await redeem.mutateAsync(code.trim());
      if (res.success) {
        setResult({ type: 'success', message: res.message });
        setCode('');
      } else {
        setResult({ type: 'error', message: res.message });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to redeem coupon';
      setResult({ type: 'error', message: msg });
    }
  };

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
          <Gift className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Redeem Gift Code</h3>
          <p className="text-xs text-ink-400">Have a coupon code? Redeem it for instant wallet credit.</p>
        </div>
      </div>
      {result && (
        <div className={`mb-3 p-3 rounded-xl text-sm border ${
          result.type === 'success'
            ? 'bg-success-500/10 border-success-500/20 text-success-300'
            : 'bg-danger-500/10 border-danger-500/20 text-danger-300'
        }`}>
          {result.message}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setResult(null); }}
          placeholder="ENTER CODE"
          className="font-mono tracking-wider"
          onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
        />
        <Button onClick={handleRedeem} loading={redeem.isPending} disabled={!code.trim() || redeem.isPending}>
          <Gift className="w-4 h-4" /> Redeem
        </Button>
      </div>
      <p className="text-xs text-ink-500 mt-2">Current balance: {formatCurrency(wallet?.balance || 0)}</p>
    </Card>
  );
}
