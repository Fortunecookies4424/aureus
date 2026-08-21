import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, Plus, Edit3, Trash2, Power, Save, Camera, ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Input, Select, Textarea, Badge, PageHeader, Modal, EmptyState, StatCard, Pagination } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { uploadPackageImage, PLACEHOLDER_IMAGE } from '@/lib/upload';
import type { InvestmentPackage } from '@/types/database';

const iconOptions = [
  { value: 'sprout', label: 'Sprout' },
  { value: 'coins', label: 'Coins' },
  { value: 'crown', label: 'Crown' },
  { value: 'diamond', label: 'Diamond' },
];

const freqOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const blankForm = {
  name: '', description: '', price: '', roi: '', duration_days: '',
  payout_frequency: 'daily', image_url: '',
  icon: 'sprout', status: 'active', featured: false,
};

export default function AdminPackages() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof blankForm>(blankForm);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: packages, isLoading } = useQuery<InvestmentPackage[]>({
    queryKey: ['admin-packages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('investment_packages').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data as InvestmentPackage[];
    },
  });

  const allPackages = packages || [];
  const totalRecords = allPackages.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedPackages = allPackages.slice((page - 1) * pageSize, page * pageSize);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price) || 0,
        roi: parseFloat(form.roi) || 0,
        duration_days: parseInt(form.duration_days) || 30,
        payout_frequency: form.payout_frequency,
        min_investment: parseFloat(form.price) || 0,
        max_investment: parseFloat(form.price) || 0,
        image_url: form.image_url || null,
        icon: form.icon,
        status: form.status,
        featured: form.featured,
      };
      if (editId) {
        const { error } = await supabase.from('investment_packages').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('investment_packages').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success(editId ? 'Package updated!' : 'Package created!');
      setModalOpen(false);
      setForm(blankForm);
      setEditId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save package';
      toast.error('Save failed', msg);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('investment_packages').update({ status: status === 'active' ? 'inactive' : 'active' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Package status updated');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-packages'] });
      qc.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Package deleted');
    },
    onError: () => toast.error('Failed to delete package'),
  });

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadPackageImage(file);
      if (url) {
        setForm((prev) => ({ ...prev, image_url: url }));
        toast.success('Image uploaded!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error('Image upload failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (pkg: InvestmentPackage) => {
    setEditId(pkg.id);
    setForm({
      name: pkg.name, description: pkg.description, price: pkg.price.toString(),
      roi: pkg.roi.toString(), duration_days: pkg.duration_days.toString(),
      payout_frequency: pkg.payout_frequency, image_url: pkg.image_url || '',
      icon: pkg.icon || 'sprout', status: pkg.status, featured: pkg.featured,
    });
    setModalOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(blankForm);
    setModalOpen(true);
  };

  return (
    <div>
      <PageHeader title="Investment Packages" subtitle="Create and manage investment plans" icon={<Package className="w-5 h-5" />}
        action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Package</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Packages" value={allPackages.length} icon={<Package className="w-5 h-5" />} />
        <StatCard label="Active" value={allPackages.filter((p) => p.status === 'active').length} icon={<Power className="w-5 h-5" />} />
        <StatCard label="Featured" value={allPackages.filter((p) => p.featured).length} icon={<Package className="w-5 h-5" />} />
      </div>

      {isLoading ? (
        <Card><p className="text-center text-ink-400 py-8">Loading...</p></Card>
      ) : allPackages.length === 0 ? (
        <Card><EmptyState icon={<Package className="w-6 h-6" />} title="No packages yet" description="Create your first investment package to get started." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Package</Button>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedPackages.map((pkg, i) => (
              <motion.div key={pkg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={pkg.featured ? 'border-gold-400/30' : ''}>
                  <div className="relative h-32 -mx-6 -mt-6 mb-3 overflow-hidden rounded-t-2xl bg-ink-800">
                    <img
                      src={pkg.image_url || PLACEHOLDER_IMAGE}
                      alt={pkg.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                    />
                  </div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {pkg.featured && <Badge variant="gold">Featured</Badge>}
                      <Badge variant={pkg.status === 'active' ? 'success' : 'default'}>{pkg.status}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(pkg)} className="p-1.5 rounded-lg text-ink-400 hover:text-gold-300 hover:bg-white/5 transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => toggle.mutate({ id: pkg.id, status: pkg.status })} className="p-1.5 rounded-lg text-ink-400 hover:text-warning-400 hover:bg-white/5 transition-colors"><Power className="w-4 h-4" /></button>
                      <button onClick={() => remove.mutate(pkg.id)} className="p-1.5 rounded-lg text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-white">{pkg.name}</h3>
                  <p className="text-xs text-ink-400 mt-1 line-clamp-2 h-8">{pkg.description}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-ink-400">Price:</span> <span className="text-gold-300 font-semibold">{formatCurrency(pkg.price)}</span></div>
                    <div><span className="text-ink-400">ROI:</span> <span className="text-white">{pkg.roi}%</span></div>
                    <div><span className="text-ink-400">Days:</span> <span className="text-white">{pkg.duration_days}</span></div>
                    <div><span className="text-ink-400">Redeemed:</span> <span className="text-white">{pkg.max_investment > 0 ? '—' : '—'}</span></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalRecords={totalRecords}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = '';
        }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Package' : 'New Package'} size="lg">
        <div className="space-y-4">
          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-ink-100 mb-2">Package Image</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-ink-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-ink-500" />
                )}
              </div>
              <div className="flex-1">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploading} disabled={uploading}>
                  <Camera className="w-4 h-4" /> {form.image_url ? 'Change Image' : 'Upload Image'}
                </Button>
                {form.image_url && (
                  <button onClick={() => setForm({ ...form, image_url: '' })} className="ml-2 text-xs text-danger-400 hover:text-danger-300">Remove</button>
                )}
                <p className="text-xs text-ink-500 mt-1.5">JPG, PNG up to 5MB. A default placeholder is shown if no image is uploaded.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Package Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gold Plan" />
            <Select label="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} options={iconOptions} />
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the investment plan..." />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Input label="Investment Price (₦)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="20000" />
            <Input label="ROI (%)" type="number" value={form.roi} onChange={(e) => setForm({ ...form, roi: e.target.value })} placeholder="25" />
            <Input label="Duration (days)" type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} placeholder="30" />
            <Select label="Payout Frequency" value={form.payout_frequency} onChange={(e) => setForm({ ...form, payout_frequency: e.target.value })} options={freqOptions} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={statusOptions} />
            <div>
              <label className="block text-sm font-medium text-ink-100 mb-2">Featured</label>
              <button onClick={() => setForm({ ...form, featured: !form.featured })}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.featured ? 'bg-gold-400' : 'bg-ink-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.featured ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={() => save.mutate()} loading={save.isPending} disabled={!form.name || !form.price}><Save className="w-4 h-4" /> {editId ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
