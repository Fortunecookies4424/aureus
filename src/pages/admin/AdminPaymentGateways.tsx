import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CreditCard, Save, Plus, Trash2, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Input, PageHeader, Badge, Modal, EmptyState } from '@/components/ui';
import type { PaymentGateway } from '@/types/database';

const gatewaySlugs = ['paystack', 'nomba', 'flutterwave', 'monnify'];
const paymentMethods = ['card', 'bank_transfer', 'ussd', 'bank_account'];

export default function AdminPaymentGateways() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PaymentGateway | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<PaymentGateway>>({});

  const { data: gateways, isLoading } = useQuery<PaymentGateway[]>({
    queryKey: ['payment-gateways'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_gateways').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data as PaymentGateway[];
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('payment_gateways').update({
        ...form,
        updated_at: new Date().toISOString(),
      }).eq('id', editing!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Gateway updated!');
      setEditing(null);
      setForm({});
    },
    onError: () => toast.error('Failed to update gateway'),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('payment_gateways').insert({
        name: form.name,
        slug: form.slug,
        enabled: form.enabled || false,
        public_key: form.public_key || '',
        secret_key: form.secret_key || '',
        merchant_id: form.merchant_id || '',
        webhook_secret: form.webhook_secret || '',
        environment: form.environment || 'sandbox',
        supported_methods: form.supported_methods || [],
        sort_order: form.sort_order || 99,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Gateway added!');
      setCreating(false);
      setForm({});
    },
    onError: () => toast.error('Failed to add gateway'),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('payment_gateways').update({ is_default: false }).neq('id', id);
      const { error } = await supabase.from('payment_gateways').update({ is_default: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Default gateway updated');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_gateways').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Gateway deleted');
    },
  });

  const current: Partial<PaymentGateway> = { ...editing, ...form };
  const set = (key: keyof PaymentGateway, value: unknown) => {
    setForm({ ...form, [key]: value });
  };

  const openEdit = (gw: PaymentGateway) => {
    setEditing(gw);
    setForm({});
  };

  const toggleMethod = (method: string) => {
    const methods = current.supported_methods || [];
    set('supported_methods', methods.includes(method) ? methods.filter((m) => m !== method) : [...methods, method]);
  };

  return (
    <div>
      <PageHeader
        title="Payment Gateway Management"
        subtitle="Configure payment providers for deposits and withdrawals"
        icon={<CreditCard className="w-5 h-5" />}
        action={<Button onClick={() => { setCreating(true); setForm({}); }}><Plus className="w-4 h-4" /> Add Gateway</Button>}
      />

      {isLoading ? (
        <p className="text-center text-ink-400 py-8">Loading...</p>
      ) : (gateways || []).length === 0 ? (
        <EmptyState icon={<CreditCard className="w-6 h-6" />} title="No gateways configured" description="Add a payment gateway to start accepting deposits." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(gateways || []).map((gw) => (
            <Card key={gw.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{gw.name}</p>
                      {gw.is_default && <Badge variant="gold">Default</Badge>}
                    </div>
                    <p className="text-xs text-ink-400 capitalize">{gw.slug} · {gw.environment}</p>
                  </div>
                </div>
                <Badge variant={gw.enabled ? 'success' : 'default'}>{gw.enabled ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <div className="text-xs text-ink-400 space-y-1 mb-3">
                <p>Methods: {gw.supported_methods.length > 0 ? gw.supported_methods.join(', ') : 'None configured'}</p>
                <p>Public Key: {gw.public_key ? '✓ Set' : 'Not set'}</p>
                <p>Secret Key: {gw.secret_key ? '✓ Set' : 'Not set'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(gw)}>Configure</Button>
                {!gw.is_default && gw.enabled && (
                  <Button size="sm" variant="ghost" onClick={() => setDefault.mutate(gw.id)}><Star className="w-3.5 h-3.5" /> Set Default</Button>
                )}
                {!gatewaySlugs.includes(gw.slug) && (
                  <button onClick={() => remove.mutate(gw.id)} className="p-2 rounded-lg text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors ml-auto">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false); setForm({}); }}
        title={creating ? 'Add Payment Gateway' : `Configure ${editing?.name}`} size="md">
        <div className="space-y-4">
          {creating && (
            <>
              <Input label="Gateway Name" value={current.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Paystack" />
              <Input label="Slug" value={current.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="e.g. paystack" />
            </>
          )}
          <div className="flex items-center justify-between py-2">
            <p className="text-sm font-medium text-white">Enable Gateway</p>
            <Toggle on={!!current.enabled} onChange={(v) => set('enabled', v)} />
          </div>
          <Input label="Public Key" value={current.public_key || ''} onChange={(e) => set('public_key', e.target.value)} placeholder="pk_..." />
          <Input label="Secret Key" value={current.secret_key || ''} onChange={(e) => set('secret_key', e.target.value)} placeholder="sk_..." type="password" />
          <Input label="Merchant ID" value={current.merchant_id || ''} onChange={(e) => set('merchant_id', e.target.value)} placeholder="Optional" />
          <Input label="Webhook Secret" value={current.webhook_secret || ''} onChange={(e) => set('webhook_secret', e.target.value)} placeholder="whsec_..." type="password" />
          <div>
            <label className="block text-sm font-medium text-ink-100 mb-2">Environment</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => set('environment', 'sandbox')}
                className={`p-3 rounded-xl border text-center transition-all ${current.environment === 'sandbox' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 bg-ink-800/50 text-ink-300'}`}>
                Sandbox
              </button>
              <button onClick={() => set('environment', 'production')}
                className={`p-3 rounded-xl border text-center transition-all ${current.environment === 'production' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 bg-ink-800/50 text-ink-300'}`}>
                Production
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-100 mb-2">Supported Payment Methods</label>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <button key={m} onClick={() => toggleMethod(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all ${(current.supported_methods || []).includes(m) ? 'bg-gold-400/10 border border-gold-400/30 text-gold-200' : 'bg-ink-800 border border-white/10 text-ink-300'}`}>
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => { setEditing(null); setCreating(false); setForm({}); }}>Cancel</Button>
            <Button fullWidth onClick={() => (creating ? create.mutate() : update.mutate())}
              loading={create.isPending || update.isPending}
              disabled={creating && (!current.name || !current.slug)}>
              {creating ? 'Add Gateway' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
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
