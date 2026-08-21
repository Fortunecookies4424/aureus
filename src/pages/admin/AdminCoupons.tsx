import { useState } from 'react';
import { Gift, Plus, Trash2, Power, Save, Copy, RefreshCw, Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, useCouponRedemptions } from '@/hooks/useCoupons';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Input, Badge, PageHeader, Modal, EmptyState, StatCard, Pagination } from '@/components/ui';
import { formatCurrency, cn } from '@/lib/utils';
import type { Coupon, CouponStatus } from '@/types/database';

const blankForm = {
  code: '', value: '', max_redemptions: '1', expires_at: '',
};

function genRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getCouponStatus(coupon: Coupon): CouponStatus {
  if (coupon.status === 'disabled') return 'disabled';
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return 'expired';
  if (coupon.redeemed_count >= coupon.max_redemptions) return 'fully_redeemed';
  return 'active';
}

const statusConfig: Record<CouponStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  active: { label: 'Active', variant: 'success' },
  disabled: { label: 'Disabled', variant: 'default' },
  expired: { label: 'Expired', variant: 'warning' },
  fully_redeemed: { label: 'Fully Redeemed', variant: 'danger' },
};

export default function AdminCoupons() {
  const toast = useToast();
  const { data: coupons, isLoading } = useCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [redemptionViewId, setRedemptionViewId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const allCoupons = coupons || [];
  const totalRecords = allCoupons.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedCoupons = allCoupons.slice((page - 1) * pageSize, page * pageSize);

  const openNew = () => {
    setEditId(null);
    setForm({ ...blankForm, code: genRandomCode() });
    setModalOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      value: c.value.toString(),
      max_redemptions: c.max_redemptions.toString(),
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.value) {
      toast.error('Missing fields', 'Code and value are required.');
      return;
    }
    const payload = {
      code: form.code.trim(),
      value: parseFloat(form.value),
      max_redemptions: parseInt(form.max_redemptions) || 1,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };
    try {
      if (editId) {
        await updateCoupon.mutateAsync({ id: editId, ...payload });
        toast.success('Coupon updated!');
      } else {
        await createCoupon.mutateAsync(payload);
        toast.success('Coupon created!');
      }
      setModalOpen(false);
      setForm(blankForm);
      setEditId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save coupon';
      toast.error('Save failed', msg);
    }
  };

  const toggleStatus = async (c: Coupon) => {
    try {
      await updateCoupon.mutateAsync({ id: c.id, status: c.status === 'active' ? 'disabled' : 'active' });
      toast.success(c.status === 'active' ? 'Coupon disabled' : 'Coupon enabled');
    } catch {
      toast.error('Failed to update coupon');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this coupon? This cannot be undone.')) return;
    try {
      await deleteCoupon.mutateAsync(id);
      toast.success('Coupon deleted');
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!', code);
  };

  const activeCount = allCoupons.filter((c) => getCouponStatus(c) === 'active').length;
  const totalRedemptions = allCoupons.reduce((sum, c) => sum + c.redeemed_count, 0);
  const totalValue = allCoupons.reduce((sum, c) => sum + c.value * c.redeemed_count, 0);

  return (
    <div>
      <PageHeader title="Coupon Management" subtitle="Create and manage redeemable gift codes" icon={<Gift className="w-5 h-5" />}
        action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Create Coupon</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Coupons" value={allCoupons.length} icon={<Gift className="w-5 h-5" />} />
        <StatCard label="Active" value={activeCount} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard label="Total Redemptions" value={totalRedemptions} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Total Value Redeemed" value={formatCurrency(totalValue)} icon={<Gift className="w-5 h-5" />} />
      </div>

      {isLoading ? (
        <Card><p className="text-center text-ink-400 py-8">Loading...</p></Card>
      ) : allCoupons.length === 0 ? (
        <Card><EmptyState icon={<Gift className="w-6 h-6" />} title="No coupons yet" description="Create your first coupon code to offer gift rewards to users." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Create Coupon</Button>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedCoupons.map((c) => {
              const status = getCouponStatus(c);
              const remaining = c.max_redemptions - c.redeemed_count;
              return (
                <Card key={c.id} className="flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <button onClick={() => copyCode(c.code)} className="font-mono font-bold text-white tracking-wider hover:text-gold-300 transition-colors flex items-center gap-1">
                          {c.code} <Copy className="w-3 h-3" />
                        </button>
                        <p className="text-xs text-ink-400">{formatCurrency(c.value)} value</p>
                      </div>
                    </div>
                    <Badge variant={statusConfig[status].variant}>{statusConfig[status].label}</Badge>
                  </div>

                  <div className="space-y-2 text-sm flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">Redemptions</span>
                      <span className="text-white font-medium">{c.redeemed_count} / {c.max_redemptions}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">Remaining</span>
                      <span className={cn('font-medium', remaining > 0 ? 'text-success-400' : 'text-danger-400')}>{remaining}</span>
                    </div>
                    {c.expires_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-ink-400">Expires</span>
                        <span className="text-white text-xs">{new Date(c.expires_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/5">
                    <button onClick={() => openEdit(c)} className="flex-1 py-1.5 rounded-lg text-xs text-ink-300 hover:text-gold-300 hover:bg-white/5 transition-colors">Edit</button>
                    <button onClick={() => toggleStatus(c)} className="flex-1 py-1.5 rounded-lg text-xs text-ink-300 hover:text-warning-400 hover:bg-white/5 transition-colors flex items-center justify-center gap-1">
                      <Power className="w-3 h-3" /> {c.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => setRedemptionViewId(c.id)} className="flex-1 py-1.5 rounded-lg text-xs text-ink-300 hover:text-gold-300 hover:bg-white/5 transition-colors">Redemptions</button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Coupon' : 'Create Coupon'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-100 mb-2">Coupon Code</label>
            <div className="flex gap-2">
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME5000" className="font-mono" />
              <Button variant="outline" size="md" onClick={() => setForm({ ...form, code: genRandomCode() })}><RefreshCw className="w-4 h-4" /></Button>
            </div>
            <p className="text-xs text-ink-500 mt-1.5">Click the refresh button to generate a random code.</p>
          </div>
          <Input label="Value (₦)" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="5000" />
          <Input label="Max Redemptions" type="number" value={form.max_redemptions} onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })} placeholder="100" />
          <Input label="Expiry Date (optional)" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={handleSave} loading={createCoupon.isPending || updateCoupon.isPending} disabled={!form.code || !form.value}><Save className="w-4 h-4" /> {editId ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      <RedemptionsModal couponId={redemptionViewId} onClose={() => setRedemptionViewId(null)} />
    </div>
  );
}

function RedemptionsModal({ couponId, onClose }: { couponId: string | null; onClose: () => void }) {
  const { data: redemptions, isLoading } = useCouponRedemptions(couponId);
  return (
    <Modal open={!!couponId} onClose={onClose} title="Coupon Redemptions" size="md">
      {isLoading ? <p className="text-center text-ink-400 py-6">Loading...</p> : !redemptions || redemptions.length === 0 ? (
        <EmptyState icon={<Users className="w-6 h-6" />} title="No redemptions yet" description="No one has redeemed this coupon yet." />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {redemptions.map((r: Record<string, unknown>) => {
            const user = r.user as { full_name: string; username: string; phone: string } | null;
            return (
              <div key={r.id as string} className="flex items-center justify-between p-3 rounded-xl bg-ink-800/50 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 text-xs font-bold">
                    {(user?.full_name || user?.username || '?')[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{user?.full_name || user?.username}</p>
                    <p className="text-xs text-ink-400">{user?.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gold-300 font-semibold">{formatCurrency(r.amount as number)}</p>
                  <p className="text-xs text-ink-400">{new Date(r.redeemed_at as string).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
