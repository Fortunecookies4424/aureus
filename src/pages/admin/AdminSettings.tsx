import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Globe, CreditCard, Users, FileText, Image } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useSettings } from '@/hooks/usePublicData';
import { Card, Button, Input, Textarea, PageHeader, Badge } from '@/components/ui';
import type { WebsiteSettings } from '@/types/database';

type Tab = 'general' | 'homepage' | 'contact' | 'financial' | 'content' | 'social';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'homepage', label: 'Homepage', icon: Globe },
  { id: 'contact', label: 'Contact', icon: CreditCard },
  { id: 'financial', label: 'Financial', icon: Users },
  { id: 'content', label: 'Content (CMS)', icon: FileText },
  { id: 'social', label: 'Social Links', icon: Image },
];

export default function AdminSettings() {
  const { data: settings } = useSettings();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState<Partial<WebsiteSettings>>({});

  // Sync form when settings load
  const current: Partial<WebsiteSettings> = { ...settings, ...form };

  const set = (key: keyof WebsiteSettings, value: string | number | boolean) => {
    setForm({ ...form, [key]: value });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('website_settings').update(form).eq('id', settings!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setForm({});
      toast.success('Settings saved!', 'Changes are now live.');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  return (
    <div>
      <PageHeader
        title="Website Settings"
        subtitle="Manage platform configuration and content"
        icon={<Settings className="w-5 h-5" />}
        action={
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={Object.keys(form).length === 0}>
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        }
      />

      {settings?.maintenance_mode && (
        <div className="card-elevated rounded-xl p-3 mb-4 border-warning-500/30 bg-warning-500/5">
          <Badge variant="warning">Maintenance Mode is ON</Badge>
          <span className="text-xs text-ink-300 ml-2">The public site is currently inaccessible to visitors.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-gold-400/10 border border-gold-400/30 text-gold-200' : 'bg-ink-800 border border-white/10 text-ink-300 hover:text-white'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'general' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">General Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Company Name" value={current.company_name || ''} onChange={(e) => set('company_name', e.target.value)} />
              <Input label="Logo URL" value={current.logo_url || ''} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://..." />
              <Input label="Support Email" value={current.email || ''} onChange={(e) => set('email', e.target.value)} />
              <Input label="Phone" value={current.phone || ''} onChange={(e) => set('phone', e.target.value)} />
              <Input label="Address" value={current.address || ''} onChange={(e) => set('address', e.target.value)} />
              <Input label="Currency Symbol" value={current.currency || ''} onChange={(e) => set('currency', e.target.value)} />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/5">
              <div>
                <p className="text-sm font-medium text-white">Maintenance Mode</p>
                <p className="text-xs text-ink-400">Take the public site offline</p>
              </div>
              <button onClick={() => set('maintenance_mode', !current.maintenance_mode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${current.maintenance_mode ? 'bg-warning-500' : 'bg-ink-700'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${current.maintenance_mode ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {tab === 'homepage' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Homepage Content</h3>
            <Input label="Hero Title" value={current.hero_title || ''} onChange={(e) => set('hero_title', e.target.value)} />
            <Textarea label="Hero Subtitle" value={current.hero_subtitle || ''} onChange={(e) => set('hero_subtitle', e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Stat 1 Label" value={current.hero_stat1_label || ''} onChange={(e) => set('hero_stat1_label', e.target.value)} />
              <Input label="Stat 1 Value" value={current.hero_stat1_value || ''} onChange={(e) => set('hero_stat1_value', e.target.value)} />
              <Input label="Stat 2 Label" value={current.hero_stat2_label || ''} onChange={(e) => set('hero_stat2_label', e.target.value)} />
              <Input label="Stat 2 Value" value={current.hero_stat2_value || ''} onChange={(e) => set('hero_stat2_value', e.target.value)} />
              <Input label="Stat 3 Label" value={current.hero_stat3_label || ''} onChange={(e) => set('hero_stat3_label', e.target.value)} />
              <Input label="Stat 3 Value" value={current.hero_stat3_value || ''} onChange={(e) => set('hero_stat3_value', e.target.value)} />
            </div>
          </div>
        )}

        {tab === 'contact' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Contact Email" value={current.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} />
              <Input label="Contact Phone" value={current.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} />
            </div>
            <Textarea label="Contact Address" value={current.contact_address || ''} onChange={(e) => set('contact_address', e.target.value)} />
          </div>
        )}

        {tab === 'financial' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Financial Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Referral Percentage (%)" type="number" value={current.referral_percentage?.toString() || ''} onChange={(e) => set('referral_percentage', parseFloat(e.target.value) || 0)} />
              <Input label="Min Withdrawal (₦)" type="number" value={current.min_withdrawal?.toString() || ''} onChange={(e) => set('min_withdrawal', parseFloat(e.target.value) || 0)} />
              <Input label="Max Withdrawal (₦)" type="number" value={current.max_withdrawal?.toString() || ''} onChange={(e) => set('max_withdrawal', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        )}

        {tab === 'content' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">CMS Content</h3>
            <Textarea label="About Us Text" value={current.about_text || ''} onChange={(e) => set('about_text', e.target.value)} />
            <Textarea label="Terms & Conditions" value={current.terms_text || ''} onChange={(e) => set('terms_text', e.target.value)} />
            <Textarea label="Privacy Policy" value={current.privacy_text || ''} onChange={(e) => set('privacy_text', e.target.value)} />
          </div>
        )}

        {tab === 'social' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Social Media Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Telegram URL" value={current.telegram_url || ''} onChange={(e) => set('telegram_url', e.target.value)} placeholder="https://t.me/..." />
              <Input label="WhatsApp URL" value={current.whatsapp_url || ''} onChange={(e) => set('whatsapp_url', e.target.value)} placeholder="https://wa.me/..." />
              <Input label="Facebook URL" value={current.facebook_url || ''} onChange={(e) => set('facebook_url', e.target.value)} placeholder="https://facebook.com/..." />
              <Input label="X (Twitter) URL" value={current.twitter_url || ''} onChange={(e) => set('twitter_url', e.target.value)} placeholder="https://twitter.com/..." />
              <Input label="Instagram URL" value={current.instagram_url || ''} onChange={(e) => set('instagram_url', e.target.value)} placeholder="https://instagram.com/..." />
              <Input label="LinkedIn URL" value={current.linkedin_url || ''} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/..." />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
