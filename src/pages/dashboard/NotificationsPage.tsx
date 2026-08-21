import { motion } from 'framer-motion';
import {
  Bell, CheckCheck, TrendingUp, ArrowDownToLine, ArrowUpFromLine, Users,
  Megaphone, Info, Circle,
} from 'lucide-react';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useUserData';
import { Card, SkeletonCard, EmptyState, PageHeader, Button, Badge } from '@/components/ui';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types/database';

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  deposit: { icon: ArrowDownToLine, color: 'text-success-400' },
  withdrawal: { icon: ArrowUpFromLine, color: 'text-warning-400' },
  investment: { icon: TrendingUp, color: 'text-gold-300' },
  referral: { icon: Users, color: 'text-purple-400' },
  announcement: { icon: Megaphone, color: 'text-blue-400' },
  system: { icon: Info, color: 'text-ink-300' },
};

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        icon={<Bell className="w-5 h-5" />}
        action={unreadCount > 0 ? <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}><CheckCheck className="w-4 h-4" /> Mark all read</Button> : undefined}
      />

      <Card>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (notifications || []).length === 0 ? (
          <EmptyState icon={<Bell className="w-6 h-6" />} title="No notifications" description="You're all caught up! Notifications about your investments, deposits, and withdrawals will appear here." />
        ) : (
          <div className="space-y-2">
            {(notifications || []).map((n, i) => {
              const config = typeConfig[n.type] || typeConfig.system;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => !n.read && markRead.mutate(n.id)}
                  className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all ${n.read ? 'bg-ink-800/30' : 'bg-gold-400/5 border border-gold-400/10 hover:border-gold-400/20'}`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-ink-800 border border-white/5 flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <config.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      {!n.read && <Circle className="w-2 h-2 fill-gold-400 text-gold-400 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-ink-300 mt-0.5">{n.message}</p>
                    <p className="text-xs text-ink-500 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.type === 'announcement' && <Badge variant="info">Announcement</Badge>}
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
