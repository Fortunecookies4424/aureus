import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Trash2, Power } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, Button, Input, Textarea, Badge, PageHeader, Modal, EmptyState, Pagination } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Announcement } from '@/types/database';

export default function AdminAnnouncements() {
  const toast = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('announcements').insert({ title, message, active: true });
      if (error) throw error;

      const { data: users } = await supabase.from('profiles').select('id');
      if (users && users.length > 0) {
        const notifs = users.map((u) => ({ user_id: u.id, type: 'announcement' as const, title, message, read: false }));
        await supabase.from('notifications').insert(notifs);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Announcement published!', 'All users have been notified.');
      setModalOpen(false);
      setTitle('');
      setMessage('');
    },
    onError: () => toast.error('Failed to publish announcement'),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('announcements').update({ active: !active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement updated');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted');
    },
  });

  const allAnnouncements = announcements || [];
  const totalRecords = allAnnouncements.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const pagedAnnouncements = allAnnouncements.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Broadcast messages to all users" icon={<Megaphone className="w-5 h-5" />}
        action={<Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Announcement</Button>} />

      <Card>
        {isLoading ? (
          <p className="text-center text-ink-400 py-8">Loading...</p>
        ) : allAnnouncements.length === 0 ? (
          <EmptyState icon={<Megaphone className="w-6 h-6" />} title="No announcements" description="Create an announcement to notify all users." action={<Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> New Announcement</Button>} />
        ) : (
          <>
            <div className="space-y-3">
              {pagedAnnouncements.map((a) => (
                <div key={a.id} className="p-4 rounded-xl bg-ink-800/50 border border-white/5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-300">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{a.title}</p>
                        <p className="text-xs text-ink-400">{formatDate(a.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.active ? 'success' : 'default'}>{a.active ? 'Active' : 'Inactive'}</Badge>
                      <button onClick={() => toggle.mutate({ id: a.id, active: a.active })} className="p-1.5 rounded-lg text-ink-400 hover:text-warning-400 hover:bg-white/5 transition-colors"><Power className="w-4 h-4" /></button>
                      <button onClick={() => remove.mutate(a.id)} className="p-1.5 rounded-lg text-ink-400 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-ink-300">{a.message}</p>
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Announcement" size="md">
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
          <Textarea label="Message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your announcement..." />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={() => create.mutate()} loading={create.isPending} disabled={!title || !message}>Publish</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
