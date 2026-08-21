import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, ArrowRight, Eye, EyeOff, User, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Button, Input } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { normalizePhone, isValidPhone, phoneToFakeEmail, padPassword } from '@/lib/utils';

type Tab = 'login' | 'register';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const setFieldError = (key: string, msg: string) => {
    setErrors((prev) => ({ ...prev, [key]: msg }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const normalized = normalizePhone(phone);
    if (!normalized) {
      e.phone = 'Phone number is required';
    } else if (!isValidPhone(phone)) {
      e.phone = 'Enter a valid phone number (e.g. 0803 123 4567)';
    }
    if (!password) {
      e.password = 'Password is required';
    } else if (password.length < 4) {
      e.password = 'Password must be at least 4 characters long.';
    } else if (password.length > 64) {
      e.password = 'Password must be no more than 64 characters.';
    }
    if (tab === 'register') {
      if (!fullName.trim()) e.fullName = 'Full name is required';
      if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    const normalized = normalizePhone(phone);
    const email = phoneToFakeEmail(normalized);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: padPassword(password) });
    if (error) throw error;

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileErr) console.error('Profile lookup failed after login:', profileErr);

    if (profile?.status === 'suspended') {
      navigate('/suspended');
      return;
    }
    toast.success('Welcome back!');
    navigate(profile?.role === 'admin' ? '/admin' : from || '/dashboard');
  };

  const handleRegister = async () => {
    const normalized = normalizePhone(phone);

    // Pre-check phone uniqueness before attempting signup
    const { data: taken, error: checkErr } = await supabase.rpc('is_phone_taken', { p_phone: normalized });
    if (checkErr) console.error('Phone uniqueness check failed:', checkErr);
    if (taken === true) {
      setFieldError('phone', 'An account with this phone number already exists. Try signing in.');
      toast.error('Phone already registered', 'Use the Sign In tab to log into your existing account.');
      setTab('login');
      return;
    }

    const email = phoneToFakeEmail(normalized);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: padPassword(password),
      options: {
        data: {
          full_name: fullName.trim(),
          phone: normalized,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Registration failed: no user returned. Please try again.');

    toast.success('Account created!', 'You are now logged in.');
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;
    setLoading(true);
    try {
      if (tab === 'login') await handleLogin();
      else await handleRegister();
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      console.error('Auth error:', err);
      if (msg.includes('invalid') || msg.includes('not confirmed') || msg.includes('credentials') || msg.includes('auth')) {
        toast.error('Sign in failed', 'Check your phone number and password and try again.');
      } else if (msg.includes('already') || msg.includes('registered') || msg.includes('exists') || msg.includes('duplicate')) {
        toast.error('Account exists', 'An account with this phone already exists. Try signing in.');
        setTab('login');
      } else {
        toast.error('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setErrors({});
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen bg-ink-900 flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-ink-950 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute inset-0 bg-radial-gold" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-gold-400/5 blur-3xl animate-float" />
        <div className="relative max-w-md">
          <Logo size="lg" />
          <h2 className="mt-8 text-3xl font-bold font-display leading-tight">
            Grow Your Wealth with <span className="gold-gradient-text">Confidence</span>
          </h2>
          <p className="mt-4 text-ink-300 leading-relaxed">
            Premium investment plans designed for ambitious Nigerians. Transparent returns, secure growth, and a platform built on trust.
          </p>
          <div className="mt-8 space-y-3">
            {['Bank-grade security', 'Transparent ROI', 'Fast withdrawals', 'Referral rewards'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-gold-400/20 border border-gold-400/30 flex items-center justify-center">
                  <ArrowRight className="w-3 h-3 text-gold-300" />
                </div>
                <span className="text-sm text-ink-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="lg" />
          </div>

          {/* Tab switcher */}
          <div className="flex p-1 bg-ink-800/60 rounded-2xl border border-white/8 mb-8">
            <TabButton active={tab === 'login'} onClick={() => switchTab('login')}>
              Sign In
            </TabButton>
            <TabButton active={tab === 'register'} onClick={() => switchTab('register')}>
              Create Account
            </TabButton>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === 'login' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'login' ? 10 : -10 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-2xl font-bold font-display text-white">
                {tab === 'login' ? 'Welcome Back' : 'Create Your Account'}
              </h1>
              <p className="mt-2 text-sm text-ink-300">
                {tab === 'login'
                  ? 'Sign in to your Aureus account to continue'
                  : 'Join thousands of investors growing their wealth'}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {tab === 'register' && (
                  <Input
                    label="Full Name"
                    type="text"
                    name="fullName"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors({ ...errors, fullName: '' }); }}
                    placeholder="John Doe"
                    icon={<User className="w-4 h-4" />}
                    error={errors.fullName}
                    autoComplete="name"
                    required
                  />
                )}

                <Input
                  label="Phone Number"
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors({ ...errors, phone: '' }); }}
                  placeholder="0803 123 4567"
                  icon={<Phone className="w-4 h-4" />}
                  error={errors.phone}
                  autoComplete="tel"
                  required
                />

                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }}
                    placeholder="Min. 4 characters"
                    icon={<Lock className="w-4 h-4" />}
                    error={errors.password}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
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

                {tab === 'register' && (
                  <div className="relative">
                    <Input
                      label="Confirm Password"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' }); }}
                      placeholder="Re-enter password"
                      icon={<Lock className="w-4 h-4" />}
                      error={errors.confirmPassword}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}

                <Button type="submit" fullWidth size="lg" loading={loading} disabled={loading}>
                  {loading
                    ? (tab === 'login' ? 'Signing in…' : 'Creating account…')
                    : (tab === 'login' ? 'Sign In' : 'Create Account')}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>

              {/* Quick toggle for users who change their mind */}
              <p className="mt-6 text-center text-sm text-ink-300">
                {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
                  className="text-gold-300 hover:text-gold-200 font-medium transition-colors"
                >
                  {tab === 'login' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Feature highlights for new users */}
          {tab === 'register' && (
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: <User className="w-4 h-4" />, label: 'No email needed' },
                { icon: <Wallet className="w-4 h-4" />, label: 'Instant access' },
                { icon: <Lock className="w-4 h-4" />, label: 'Secure account' },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-ink-800/40 border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-gold-400/10 border border-gold-400/15 flex items-center justify-center text-gold-300">
                    {f.icon}
                  </div>
                  <span className="text-[10px] text-ink-300 text-center leading-tight">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? 'text-ink-900' : 'text-ink-300 hover:text-white'
      }`}
    >
      {active && (
        <motion.div
          layoutId="auth-tab"
          className="absolute inset-0 gold-gradient rounded-xl"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}
