import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Percent, Save, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Input, PageHeader } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { WithdrawalFeeConfig } from '@/types/database';

export default function AdminWithdrawalFees() {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<WithdrawalFeeConfig>>({});
  const [previewAmount, setPreviewAmount] = useState('10000');

  const { data: config } = useQuery<WithdrawalFeeConfig>({
    queryKey: ['withdrawal-fee-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('withdrawal_fee_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as WithdrawalFeeConfig;
    },
  });

  const current: Partial<WithdrawalFeeConfig> = { ...config, ...form };
  const set = (key: keyof WithdrawalFeeConfig, value: string | number | boolean | null) => {
    setForm({ ...form, [key]: value });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('withdrawal_fee_config').update({ ...form, updated_at: new Date().toISOString() }).eq('id', config!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdrawal-fee-config'] });
      setForm({});
      toast.success('Fee settings saved!', 'Withdrawal fees are now updated.');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const { data: feePreview } = useQuery<{ fee: number; net: number; enabled: boolean }>({
    queryKey: ['fee-preview', previewAmount, config?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_withdrawal_fee', { p_amount: parseFloat(previewAmount) || 0 });
      if (error) throw error;
      return data as { fee: number; net: number; enabled: boolean };
    },
    enabled: !!config,
  });

  return (
    <div>
      <PageHeader
        title="Withdrawal Fee Settings"
        subtitle="Configure automatic fees on withdrawal requests"
        icon={<Percent className="w-5 h-5" />}
        action={<Button onClick={() => save.mutate()} loading={save.isPending} disabled={Object.keys(form).length === 0}><Save className="w-4 h-4" /> Save Changes</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-white mb-5">Fee Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Enable Withdrawal Fees</p>
                <p className="text-xs text-ink-400">Automatically calculate fees on withdrawals</p>
              </div>
              <Toggle on={!!current.enabled} onChange={(v) => set('enabled', v)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-100 mb-2">Fee Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => set('fee_type', 'fixed')}
                  className={`p-3 rounded-xl border text-center transition-all ${current.fee_type === 'fixed' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 bg-ink-800/50 text-ink-300'}`}
                >
                  Fixed Amount
                </button>
                <button
                  onClick={() => set('fee_type', 'percentage')}
                  className={`p-3 rounded-xl border text-center transition-all ${current.fee_type === 'percentage' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 bg-ink-800/50 text-ink-300'}`}
                >
                  Percentage
                </button>
              </div>
            </div>

            <Input
              label={current.fee_type === 'percentage' ? 'Fee Value (%)' : 'Fee Value (₦)'}
              type="number"
              value={current.fee_value?.toString() || '0'}
              onChange={(e) => set('fee_value', parseFloat(e.target.value) || 0)}
              disabled={!current.enabled}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Minimum Fee (₦)"
                type="number"
                value={current.min_fee?.toString() || '0'}
                onChange={(e) => set('min_fee', parseFloat(e.target.value) || 0)}
                disabled={!current.enabled}
              />
              <Input
                label="Maximum Fee (₦, optional)"
                type="number"
                value={current.max_fee?.toString() || ''}
                onChange={(e) => set('max_fee', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="No cap"
                disabled={!current.enabled}
              />
            </div>
          </div>
        </Card>

        {/* Fee Calculator Preview */}
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Fee Preview</h3>
              <p className="text-xs text-ink-400">Test the fee calculation with a sample amount</p>
            </div>
          </div>
          <div className="space-y-4">
            <Input
              label="Withdrawal Amount"
              type="number"
              value={previewAmount}
              onChange={(e) => setPreviewAmount(e.target.value)}
              icon={<span className="text-gold-300 font-semibold">₦</span>}
            />
            <div className="space-y-2 p-4 rounded-xl bg-ink-800/50 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-300">Withdrawal Amount</span>
                <span className="text-sm font-medium text-white">{formatCurrency(parseFloat(previewAmount) || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-300">Withdrawal Fee</span>
                <span className="text-sm font-medium text-warning-400">-{formatCurrency(feePreview?.fee || 0)}</span>
              </div>
              <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Net Amount Received</span>
                <span className="text-lg font-bold text-gold-300">{formatCurrency(feePreview?.net || 0)}</span>
              </div>
            </div>
            <p className="text-xs text-ink-400">
              {current.enabled
                ? `Fees are ${current.fee_type === 'percentage' ? `calculated as ${current.fee_value}% of the withdrawal amount` : `a fixed ₦${current.fee_value}`}, with a minimum of ₦${current.min_fee}${current.max_fee ? ` and maximum of ₦${current.max_fee}` : ''}.`
                : 'Fees are currently disabled. Users receive the full withdrawal amount.'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-gold-400' : 'bg-ink-700'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}
