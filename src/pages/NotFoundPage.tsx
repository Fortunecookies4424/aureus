import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui';
import { Logo } from '@/components/brand/Logo';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-ink-900 flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <Logo size="lg" />
        <h1 className="mt-12 text-8xl font-bold text-gradient-gold font-display">404</h1>
        <p className="mt-4 text-lg text-ink-300">Page not found</p>
        <p className="mt-2 text-sm text-ink-400">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="inline-block mt-8">
          <Button size="md"><Home className="w-4 h-4" /> Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
