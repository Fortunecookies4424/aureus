import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, Plus, Trash2, Power, Camera, ImageIcon, Save, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { Card, Button, Input, Textarea, Badge, PageHeader, Modal, EmptyState, StatCard } from '@/components/ui';
import { uploadPromoBanner, PLACEHOLDER_IMAGE } from '@/lib/upload';
import { formatDateTime } from '@/lib/utils';
import type { PromotionalBanner } from '@/types/database';

export default function AdminPromoBanners() {
  const toast = useToast();
  const qc = useQueryClient();
  const { session } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', image_url: '', link_url: '', enabled: true });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: banners, isLoading } = useQuery<PromotionalBanner[]>({
    queryKey: ['promo-banners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('promotional_banners').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as PromotionalBanner[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description,
        image_url: form.image_url,
        link_url: form.link_url,
        enabled: form.enabled,
        created_by: session?.user?.id || null,
      };
      if (editId) {
        const { error } = await supabase.from('promotional_banners').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('promotional_banners').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-banners'] });
      qc.invalidateQueries({ queryKey: ['active-promo-banner'] });
      toast.success(editId ? 'Banner updated!' : 'Banner created!');
      setModalOpen(false);
      setForm({ title: '', description: '', image_url: '', link_url: '', enabled: true });
      setEditId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save banner';
      toast.error('Save failed', msg);
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from('promotional_banners').update({ enabled: !enabled, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-banners'] });
      qc.invalidateQueries({ queryKey: ['active-promo-banner'] });
      toast.success('Banner status updated');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotional_banners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-banners'] });
      qc.invalidateQueries({ queryKey: ['active-promo-banner'] });
      toast.success('Banner deleted');
    },
    onError: () => toast.error('Failed to delete banner'),
  });

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadPromoBanner(file);
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

  const openEdit = (banner: PromotionalBanner) => {
    setEditId(banner.id);
    setForm({ title: banner.title, description: banner.description, image_url: banner.image_url, link_url: banner.link_url, enabled: banner.enabled });
    setModalOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ title: '', description: '', image_url: '', link_url: '', enabled: true });
    setModalOpen(true);
  };

  const allBanners = banners || [];

  return (
    <div>
      <PageHeader title="Promotional Banners" subtitle="Upload and manage dashboard promotional flyers" icon={<Megaphone className="w-5 h-5" />}
        action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Banner</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Banners" value={allBanners.length} icon={<Megaphone className="w-5 h-5" />} />
        <StatCard label="Active" value={allBanners.filter((b) => b.enabled).length} icon={<Power className="w-5 h-5" />} />
        <StatCard label="Inactive" value={allBanners.filter((b) => !b.enabled).length} icon={<Power className="w-5 h-5" />} />
      </div>

      {isLoading ? (
        <Card><p className="text-center text-ink-400 py-8">Loading...</p></Card>
      ) : allBanners.length === 0 ? (
        <Card><EmptyState icon={<Megaphone className="w-6 h-6" />} title="No banners yet" description="Upload your first promotional flyer to display on user dashboards." action={<Button onClick={openNew}><Plus className="w-4 h-4" /> Add Banner</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allBanners.map((banner, i) => (
            <motion.div key={banner.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <div className="relative h-40 -mx-6 -mt-6 mb-3 overflow-hidden rounded-t-2xl bg-ink-800">
                  <img
                    src={banner.image_url || PLACEHOLDER_IMAGE}
                    alt={banner.title || 'Promotional banner'}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                  />
                  <div className="absolute top-3 right-3">
                    <Badge variant={banner.enabled ? 'success' : 'default'}>{banner.enabled ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </div>
                {banner.title && <h3 className="font-semibold text-white">{banner.title}</h3>}
                {banner.description && <p className="text-xs text-ink-400 mt-1 line-clamp-2">{banner.description}</p>}
                {banner.link_url && (
                  <p className="text-xs text-gold-300 mt-1 flex items-center gap-1 truncate">
                    <LinkIcon className="w-3 h-3" /> {banner.link_url}
                  </p>
                )}
                <p className="text-xs text-ink-500 mt-2">Created {formatDateTime(banner.created_at)}</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(banner)}>Edit</Button>
                  <button onClick={() => toggle.mutate({ id: banner.id, enabled: banner.enabled })}
                    className="p-2 rounded-lg text-ink-400 hover:text-warning-400 hover:bg-white/5 transition-colors" title="Toggle">
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove.mutate(banner.id)}
                    className="p-2 rounded-lg text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors ml-auto" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = '';
        }}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Banner' : 'New Banner'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-100 mb-2">Flyer Image</label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-20 rounded-xl overflow-hidden bg-ink-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-ink-500" />
                )}
              </div>
              <div className="flex-1">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploading} disabled={uploading}>
                  <Camera className="w-4 h-4" /> {form.image_url ? 'Replace Image' : 'Upload Image'}
                </Button>
                {form.image_url && (
                  <button onClick={() => setForm({ ...form, image_url: '' })} className="ml-2 text-xs text-danger-400 hover:text-danger-300">Remove</button>
                )}
                <p className="text-xs text-ink-500 mt-1.5">JPG, PNG up to 5MB. High-resolution images recommended for crisp display on all devices.</p>
              </div>
            </div>
          </div>

          <Input label="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Special Investment Offer" />
          <Textarea label="Short Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description shown below the banner..." />
          <Input label="Destination URL (optional, for future use)" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-white">Enable Banner</p>
              <p className="text-xs text-ink-400">Only enabled banners are shown to users</p>
            </div>
            <button onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.enabled ? 'bg-gold-400' : 'bg-ink-700'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={() => save.mutate()} loading={save.isPending} disabled={!form.image_url}>
              <Save className="w-4 h-4" /> {editId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
