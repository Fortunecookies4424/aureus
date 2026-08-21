import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PartyPopper, X, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function WelcomeToast() {
  const { profile, session } = useAuth();
  const qc = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/yourtelegram');

  const { data: prefs } = useQuery({
    queryKey: ['user-preferences', session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_preferences').select('*').eq('user_id', session!.user.id).maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('website_settings').select('telegram_url').limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings?.telegram_url) {
      setTelegramUrl(settings.telegram_url);
    }
  }, [settings?.telegram_url]);

  useEffect(() => {
    if (prefs && !prefs.welcome_toast_dismissed && profile) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [prefs, profile]);

  const dismiss = useMutation({
    mutationFn: async () => {
      if (prefs) {
        const { error } = await supabase.from('user_preferences').update({ welcome_toast_dismissed: true }).eq('id', prefs.id);
        if (error) throw error;
      } else if (session?.user?.id) {
        const { error } = await supabase.from('user_preferences').insert({ user_id: session.user.id, welcome_toast_dismissed: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-preferences'] });
      setVisible(false);
    },
  });

  const handleJoinTelegram = () => {
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    dismiss.mutate();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className="fixed bottom-6 right-6 z-[100] max-w-sm w-full pointer-events-auto"
        >
          <div className="glass rounded-2xl border border-gold-400/30 shadow-card overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gold-400/10 blur-2xl pointer-events-none" />
            <div className="relative p-5">
              <button
                onClick={() => dismiss.mutate()}
                className="absolute top-3 right-3 text-ink-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gold-400/15 border border-gold-400/20 flex items-center justify-center text-gold-300">
                  <PartyPopper className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">Welcome!</p>
                </div>
              </div>

              <p className="text-sm text-ink-300 mb-4 leading-relaxed">
                Welcome to our investment platform! We're excited to have you here. Join our Telegram community for updates, investment tips, and important announcements.
              </p>

              <button
                onClick={handleJoinTelegram}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl gold-gradient text-ink-900 font-semibold text-sm hover:brightness-110 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                Join Telegram
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
