import { useState, useEffect, useCallback } from 'react';
import { Settings, Bell, Shield, Globe, Moon, Save, Lock, Building, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Badge, Button, Input } from '@/components/ui';
import type { UserPreferences } from '@/types/database';

export default function SettingsPage() {
  const { profile, session, refreshProfile } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  // Profile form
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');

  // Bank details
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [accountName, setAccountName] = useState(profile?.bank_account_name || '');
  const [accountNumber, setAccountNumber] = useState(profile?.bank_account_number || '');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Preferences
  const [prefs, setPrefs] = useState<Partial<UserPreferences>>({});
  const [currentPrefs, setCurrentPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    supabase.from('user_preferences').select('*').eq('user_id', session?.user?.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCurrentPrefs(data as UserPreferences);
        } else if (session?.user?.id) {
          supabase.from('user_preferences').insert({ user_id: session.user.id }).then(() => {
            supabase.from('user_preferences').select('*').eq('user_id', session.user.id).maybeSingle()
              .then(({ data: d }) => { if (d) setCurrentPrefs(d as UserPreferences); });
          });
        }
      });
  }, [session?.user?.id]);

  const mergedPrefs: Partial<UserPreferences> = { ...currentPrefs, ...prefs };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName, username, phone, avatar_url: avatarUrl,
        bank_name: bankName, bank_account_name: accountName, bank_account_number: accountNumber,
      }).eq('id', session!.user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success('Profile updated!', 'Your changes have been saved.');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error('Update failed', msg);
    },
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile!.email, password: currentPassword,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Password updated!', 'Your new password is now active.');
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update password';
      toast.error('Password update failed', msg);
    },
  });

  const updatePrefs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('user_preferences').update({ ...prefs, updated_at: new Date().toISOString() }).eq('id', currentPrefs!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-preferences'] });
      if (currentPrefs) {
        setCurrentPrefs({ ...currentPrefs, ...prefs });
      }
      setPrefs({});
      toast.success('Notification settings saved!');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const setPref = (key: keyof UserPreferences, value: boolean) => {
    setPrefs({ ...prefs, [key]: value });
  };

  const profileChanged = fullName !== (profile?.full_name || '') || username !== (profile?.username || '') || phone !== (profile?.phone || '') ||
    avatarUrl !== (profile?.avatar_url || '') || bankName !== (profile?.bank_name || '') || accountName !== (profile?.bank_account_name || '') ||
    accountNumber !== (profile?.bank_account_number || '');

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account and preferences" icon={<Settings className="w-5 h-5" />} />

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Profile Information</h3>
              <p className="text-xs text-ink-400">Update your personal details</p>
            </div>
            <Button size="sm" onClick={() => updateProfile.mutate()} loading={updateProfile.isPending} disabled={!profileChanged}>
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" />
            <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." />
            <Input label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </div>
        </Card>

        {/* Bank Details */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Building className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Bank Account Details</h3>
              <p className="text-xs text-ink-400">Used for withdrawal payouts</p>
            </div>
            <Button size="sm" onClick={() => updateProfile.mutate()} loading={updateProfile.isPending} disabled={!profileChanged}>
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Access Bank" />
            <Input label="Account Name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="John Doe" />
            <Input label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" />
          </div>
        </Card>

        {/* Password Update */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Change Password</h3>
              <p className="text-xs text-ink-400">Update your account password</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••" />
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••" />
            <Input label="Confirm New Password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••" />
          </div>
          {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
            <p className="text-xs text-danger-400 mb-3">New passwords do not match</p>
          )}
          <Button size="sm" onClick={() => updatePassword.mutate()} loading={updatePassword.isPending}
            disabled={!currentPassword || !newPassword || newPassword !== confirmNewPassword || newPassword.length < 4}>
            <Save className="w-4 h-4" /> Update Password
          </Button>
        </Card>

        {/* Notifications */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-xs text-ink-400">Choose what you want to be notified about</p>
            </div>
            {Object.keys(prefs).length > 0 && (
              <Button size="sm" onClick={() => updatePrefs.mutate()} loading={updatePrefs.isPending}>
                <Save className="w-4 h-4" /> Save
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {[
              { key: 'notif_deposit' as const, label: 'Deposit confirmations', desc: 'When your deposits are approved' },
              { key: 'notif_withdrawal' as const, label: 'Withdrawal updates', desc: 'When your withdrawals are processed' },
              { key: 'notif_investment' as const, label: 'Investment milestones', desc: 'When investments start and complete' },
              { key: 'notif_referral' as const, label: 'Referral bonuses', desc: 'When you earn referral commissions' },
              { key: 'notif_announcement' as const, label: 'Announcements', desc: 'Platform-wide announcements' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-ink-400">{item.desc}</p>
                </div>
                <Toggle on={!!mergedPrefs[item.key]} onChange={(v) => setPref(item.key, v)} />
              </div>
            ))}
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Security</h3>
              <p className="text-xs text-ink-400">Manage your account security</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Login alerts</p>
                <p className="text-xs text-ink-400">Get notified of new sign-ins</p>
              </div>
              <Toggle on={!!mergedPrefs.login_alerts} onChange={(v) => setPref('login_alerts', v)} />
            </div>
          </div>
          {Object.keys(prefs).length > 0 && (
            <Button size="sm" className="mt-3" onClick={() => updatePrefs.mutate()} loading={updatePrefs.isPending}>
              <Save className="w-4 h-4" /> Save Security Settings
            </Button>
          )}
        </Card>

        {/* Preferences */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Preferences</h3>
              <p className="text-xs text-ink-400">Customize your experience</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Currency</p>
                <p className="text-xs text-ink-400">Display currency for amounts</p>
              </div>
              <Badge variant="gold">₦ NGN</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-white">Theme</p>
                <p className="text-xs text-ink-400">Dark mode is the default</p>
              </div>
              <div className="flex items-center gap-2 text-gold-300">
                <Moon className="w-4 h-4" /> <span className="text-sm">Dark</span>
              </div>
            </div>
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
