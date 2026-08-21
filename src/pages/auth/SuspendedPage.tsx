import { Link } from 'react-router-dom';
import { Ban, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/context/AuthContext';

export default function SuspendedPage() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-ink-900 flex flex-col items-center justify-center p-6">
      <div className="absolute top-8 left-8">
        <Logo />
      </div>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-danger-500/10 border border-danger-500/30 flex items-center justify-center text-danger-400 mx-auto mb-6">
          <Ban className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold font-display text-white">Account Suspended</h1>
        <p className="mt-4 text-sm text-ink-300 leading-relaxed">
          Your account has been suspended. Please contact our support team for assistance if you believe this is an error.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link to="/login" onClick={() => signOut()}>
            <Button variant="secondary" fullWidth size="md">
              Back to Login <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" fullWidth size="md">Contact Support</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
