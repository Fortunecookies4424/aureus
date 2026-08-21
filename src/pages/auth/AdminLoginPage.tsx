import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Shield, User, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Button, Input } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { normalizePhone, phoneToFakeEmail, padPassword } from '@/lib/utils';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !identifier.trim() || !password) return;
    setLoading(true);
    try {
      const normalized = normalizePhone(identifier);
      const email = phoneToFakeEmail(normalized);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: padPassword(password),
      });

      if (error) throw error;

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        toast.error('Access denied', 'This account does not have admin privileges.');
        return;
      }

      if (profile?.status === 'suspended') {
        navigate('/suspended');
        return;
      }

      toast.success('Welcome back, Admin');
      navigate('/admin');
    } catch {
      toast.error('Login failed', 'Invalid admin credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid opacity-10" />
      <div className="absolute inset-0 bg-radial-gold opacity-50" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gold-400/5 blur-3xl animate-float" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="card-elevated rounded-2xl p-8 border border-gold-400/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-white">Admin Login</h1>
              <p className="text-sm text-ink-400">Secure access for administrators only</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Admin Phone Number"
              type="tel"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="0803 123 4567"
              icon={<User className="w-4 h-4" />}
              autoComplete="username"
              required
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 4 characters"
                icon={<Lock className="w-4 h-4" />}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-ink-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button type="submit" fullWidth size="lg" loading={loading} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In as Admin'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <a href="/login" className="text-sm text-ink-400 hover:text-gold-300 transition-colors">
              ← Back to user login
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
