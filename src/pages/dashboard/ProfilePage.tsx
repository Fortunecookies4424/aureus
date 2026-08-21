import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Phone, Lock, Building, Camera, Save, ChevronRight,
  Bell, Settings, Info, LogOut, Users, Wallet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, PageHeader, Badge } from '@/components/ui';
import { getInitials, padPassword } from '@/lib/utils';

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [bankName, setBankName] = useState(profile?.bank_name || '');
  const [accountName, setAccountName] = useState(profile?.bank_account_name || '');
  const [accountNumber, setAccountNumber] = useState(profile?.bank_account_number || '');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone })
        .eq('id', profile!.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated!');
    } catch {
      toast.error('Update failed', 'Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveBank = async () => {
    setSavingBank(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bank_name: bankName, bank_account_name: accountName, bank_account_number: accountNumber })
        .eq('id', profile!.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Bank details saved!');
    } catch {
      toast.error('Update failed', 'Please try again.');
    } finally {
      setSavingBank(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('Password too short', 'Password must be at least 4 characters long.');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: padPassword(newPassword) });
      if (error) throw error;
      toast.success('Password changed!');
      setNewPassword('');
    } catch {
      toast.error('Failed to change password', 'Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const menuItems = [
    { to: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { to: '/dashboard/investments', label: 'My Investments', icon: Wallet },
    { to: '/dashboard/referral', label: 'Referral Program', icon: Users },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your account and access all features" icon={<User className="w-5 h-5" />} />

      <div className="space-y-6">
        {/* Profile header card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl gold-gradient flex items-center justify-center text-ink-900 font-bold text-2xl">
                  {getInitials(fullName || profile?.username || '')}
                </div>
                <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-ink-800 border border-white/10 flex items-center justify-center text-gold-300 hover:border-gold-400/30 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center sm:text-left flex-1">
                <h3 className="text-lg font-semibold font-display text-white">{fullName || profile?.username}</h3>
                <p className="text-sm text-ink-400">{profile?.phone || 'No phone set'}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                  <Badge variant="gold">Active Member</Badge>
                  <span className="text-xs text-ink-500">Since {new Date(profile?.created_at || '').getFullYear()}</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick menu grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {menuItems.map((item, i) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={item.to}>
                <Card className="hover:border-gold-400/30 hover:bg-gold-400/5 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300 group-hover:scale-110 transition-transform">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-white">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-gold-400 text-ink-900 text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-ink-500 group-hover:text-gold-300 transition-colors" />
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* About */}
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Info className="w-5 h-5" />
            </div>
            <span className="flex-1 text-sm font-medium text-white">About Aureus</span>
          </div>
          <p className="text-xs text-ink-400 leading-relaxed pl-1">
            Aureus is a premier Nigerian investment platform built on transparency, security, and consistent returns. Grow your wealth with confidence.
          </p>
        </Card>

        {/* Personal information */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Personal Information</h3>
              <p className="text-xs text-ink-400">Update your name and phone number</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} icon={<User className="w-4 h-4" />} placeholder="Your name" />
            <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} icon={<Phone className="w-4 h-4" />} placeholder="0803 123 4567" />
          </div>
          <div className="mt-4">
            <Button onClick={saveProfile} loading={savingProfile}><Save className="w-4 h-4" /> Save Profile</Button>
          </div>
        </Card>

        {/* Bank details */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Bank Details</h3>
              <p className="text-xs text-ink-400">Used for withdrawal payments</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Access Bank" />
            <Input label="Account Name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="John Doe" />
            <Input label="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" />
          </div>
          <div className="mt-4">
            <Button onClick={saveBank} loading={savingBank}><Save className="w-4 h-4" /> Save Bank Details</Button>
          </div>
        </Card>

        {/* Change password */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Change Password</h3>
              <p className="text-xs text-ink-400">Keep your account secure</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" icon={<Lock className="w-4 h-4" />} />
          </div>
          <div className="mt-4">
            <Button onClick={changePassword} loading={savingPassword}>Change Password</Button>
          </div>
        </Card>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm font-semibold transition-colors hover:bg-danger-500/20"
        >
          <LogOut className="w-5 h-5" /> Logout
        </button>
      </div>
    </div>
  );
}
