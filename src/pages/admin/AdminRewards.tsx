import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Gift, CalendarCheck, Save, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Input, PageHeader, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { RewardsConfig, WebsiteSettings } from '@/types/database';

export default function AdminRewards() {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<RewardsConfig>>({});
  const [referralPct, setReferralPct] = useState('');
  const [savingPct, setSavingPct] = useState(false);

  const { data: config } = useQuery<RewardsConfig>({
    queryKey: ['rewards-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rewards_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as RewardsConfig;
    },
  });

  const { data: settings } = useQuery<WebsiteSettings>({
    queryKey: ['website-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('website_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as WebsiteSettings;
    },
  });

  const current: Partial<RewardsConfig> = { ...config, ...form };
  const set = (key: keyof RewardsConfig, value: string | number | boolean | null) => {
    setForm({ ...form, [key]: value });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rewards_config').update({ ...form, updated_at: new Date().toISOString() }).eq('id', config!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rewards-config'] });
      setForm({});
      toast.success('Rewards settings saved!', 'Changes are now live.');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const saveReferralPct = async () => {
    const val = parseFloat(referralPct);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Invalid percentage', 'Enter a value between 0 and 100.');
      return;
    }
    setSavingPct(true);
    try {
      const { error } = await supabase.from('website_settings').update({ referral_percentage: val }).eq('id', settings!.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['website-settings'] });
      toast.success('Referral commission updated!', `Commission rate set to ${val}%.`);
      setReferralPct('');
    } catch {
      toast.error('Failed to update commission rate');
    } finally {
      setSavingPct(false);
    }
  };

  const { data: checkins } = useQuery({
    queryKey: ['admin-checkins'],
    queryFn: async () => {
      const { count } = await supabase.from('daily_checkins').select('*', { count: 'exact', head: true });
      return count || 0;
    },
  });

  return (
    <div>
      <PageHeader
        title="Rewards Management"
        subtitle="Configure welcome bonus, daily check-in rewards, and referral commission"
        icon={<Gift className="w-5 h-5" />}
        action={<Button onClick={() => save.mutate()} loading={save.isPending} disabled={Object.keys(form).length === 0}><Save className="w-4 h-4" /> Save Changes</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referral Commission */}
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Referral Commission</h3>
              <p className="text-xs text-ink-400">Percentage of each referred user's deposit</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-ink-800/50 border border-white/5">
              <p className="text-xs text-ink-400">Current Commission Rate</p>
              <p className="text-2xl font-bold text-gold-300 font-display">{settings?.referral_percentage || 5}%</p>
            </div>
            <Input
              label="New Commission Rate (%)"
              type="number"
              value={referralPct}
              onChange={(e) => setReferralPct(e.target.value)}
              placeholder={settings?.referral_percentage?.toString() || '5'}
              icon={<span className="text-gold-300 font-semibold">%</span>}
            />
            <Button onClick={saveReferralPct} loading={savingPct} disabled={!referralPct}>
              <Save className="w-4 h-4" /> Update Commission Rate
            </Button>
            <div className="p-3 rounded-xl bg-ink-800/50 border border-white/5">
              <p className="text-xs text-ink-300">
                <Badge variant="gold">Rule</Badge> When a referred user's deposit is approved, the referrer earns this percentage of the deposit amount, credited to their wallet automatically.
              </p>
            </div>
          </div>
        </Card>

        {/* Welcome Bonus */}
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Welcome Bonus</h3>
              <p className="text-xs text-ink-400">Awarded once to new users on registration</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Enable Welcome Bonus</p>
                <p className="text-xs text-ink-400">Automatically credit new users</p>
              </div>
              <Toggle on={!!current.welcome_bonus_enabled} onChange={(v) => set('welcome_bonus_enabled', v)} />
            </div>
            <Input
              label="Welcome Bonus Amount (₦)"
              type="number"
              value={current.welcome_bonus_amount?.toString() || '0'}
              onChange={(e) => set('welcome_bonus_amount', parseFloat(e.target.value) || 0)}
              disabled={!current.welcome_bonus_enabled}
            />
            <Input
              label="Bonus Expiration (days, optional)"
              type="number"
              value={current.welcome_bonus_expiry_days?.toString() || ''}
              onChange={(e) => set('welcome_bonus_expiry_days', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Leave empty for no expiration"
              disabled={!current.welcome_bonus_enabled}
            />
            <div className="p-3 rounded-xl bg-ink-800/50 border border-white/5">
              <p className="text-xs text-ink-300">
                <Badge variant="gold">Rule</Badge> Welcome bonuses are credited to the available balance and can be used for investments immediately.
              </p>
            </div>
          </div>
        </Card>

        {/* Daily Check-in */}
        <Card>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Daily Check-in Reward</h3>
              <p className="text-xs text-ink-400">Users claim once per day</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Enable Daily Check-in</p>
                <p className="text-xs text-ink-400">Allow users to claim daily rewards</p>
              </div>
              <Toggle on={!!current.daily_checkin_enabled} onChange={(v) => set('daily_checkin_enabled', v)} />
            </div>
            <Input
              label="Daily Reward Amount (₦)"
              type="number"
              value={current.daily_checkin_amount?.toString() || '0'}
              onChange={(e) => set('daily_checkin_amount', parseFloat(e.target.value) || 0)}
              disabled={!current.daily_checkin_enabled}
            />
            <Input
              label="Daily Reset Time (24h)"
              type="text"
              value={current.daily_checkin_reset_time || '00:00'}
              onChange={(e) => set('daily_checkin_reset_time', e.target.value)}
              placeholder="00:00"
              disabled={!current.daily_checkin_enabled}
            />
            <Input
              label="Max Consecutive Streak (optional)"
              type="number"
              value={current.daily_checkin_max_streak?.toString() || ''}
              onChange={(e) => set('daily_checkin_max_streak', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="No limit"
              disabled={!current.daily_checkin_enabled}
            />
            <div className="p-3 rounded-xl bg-ink-800/50 border border-white/5 flex items-center justify-between">
              <p className="text-xs text-ink-300">Total check-ins claimed</p>
              <p className="text-sm font-bold text-gold-300">{checkins || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-warning-500/10 border border-warning-500/20 flex items-center justify-center text-warning-400 flex-shrink-0">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Withdrawal Rule for Bonus Rewards</p>
            <p className="text-xs text-ink-300 mt-1">
              Welcome bonuses and daily check-in rewards are credited directly to the <span className="text-gold-300">available balance</span> and can be used for investments or withdrawals.
              Referral bonuses are also credited to the available balance instantly when a new user signs up with a referral code.
            </p>
          </div>
        </div>
      </Card>
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
