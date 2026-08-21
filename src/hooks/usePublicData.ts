import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { WebsiteSettings, Faq, Testimonial, Announcement } from '@/types/database';

// ===== Website Settings =====
export function useSettings() {
  return useQuery<WebsiteSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('website_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as WebsiteSettings;
    },
    staleTime: 60_000,
  });
}

// ===== FAQs =====
export function useFaqs() {
  return useQuery<Faq[]>({
    queryKey: ['faqs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('faqs').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Faq[];
    },
    staleTime: 60_000,
  });
}

// ===== Testimonials =====
export function useTestimonials() {
  return useQuery<Testimonial[]>({
    queryKey: ['testimonials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('testimonials').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return data as Testimonial[];
    },
    staleTime: 60_000,
  });
}

// ===== Announcements =====
export function useAnnouncements() {
  return useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });
}
