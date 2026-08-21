import { useState } from 'react';
import { User, Mail, Lock, Camera, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, PageHeader, Badge } from '@/components/ui';
import { getInitials, padPassword } from '@/lib/utils';

export default function AdminProfile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile!.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated!');
    } catch {
      toast.error('Update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error('Password too short', 'Password must be at least 4 characters long.'); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: padPassword(newPassword) });
      if (error) throw error;
      toast.success('Password changed!');
      setNewPassword('');
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader title="Admin Profile" subtitle="Manage your administrator account" icon={<User className="w-5 h-5" />} />

      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center text-ink-900 font-bold text-2xl">
                {getInitials(fullName || 'Admin')}
              </div>
              <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ink-800 border border-white/10 flex items-center justify-center text-gold-300 hover:border-gold-400/30 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="text-lg font-semibold font-display text-white">{fullName || 'Admin'}</h3>
              <p className="text-sm text-ink-400">{profile?.email}</p>
              <Badge variant="gold" className="mt-1">Administrator</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={<User className="w-4 h-4" />} />
            <Input label="Email" value={profile?.email || ''} disabled icon={<Mail className="w-4 h-4" />} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="mt-4">
            <Button onClick={saveProfile} loading={savingProfile}><Save className="w-4 h-4" /> Save Profile</Button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Change Password</h3>
              <p className="text-xs text-ink-400">Keep your admin account secure</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" icon={<Lock className="w-4 h-4" />} />
          </div>
          <div className="mt-4">
            <Button onClick={changePassword} loading={savingPassword}>Change Password</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
