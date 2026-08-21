import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Coupon } from '@/types/database';

// ===== Admin: list all coupons =====
export function useCoupons() {
  return useQuery<Coupon[]>({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });
}

// ===== Admin: create coupon =====
export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      code: string;
      value: number;
      max_redemptions: number;
      expires_at: string | null;
    }) => {
      const { data, error } = await supabase
        .from('coupons')
        .insert({
          code: params.code.toUpperCase().trim(),
          value: params.value,
          max_redemptions: params.max_redemptions,
          expires_at: params.expires_at,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
}

// ===== Admin: update coupon =====
export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      code?: string;
      value?: number;
      max_redemptions?: number;
      expires_at?: string | null;
      status?: string;
    }) => {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (params.code !== undefined) update.code = params.code.toUpperCase().trim();
      if (params.value !== undefined) update.value = params.value;
      if (params.max_redemptions !== undefined) update.max_redemptions = params.max_redemptions;
      if (params.expires_at !== undefined) update.expires_at = params.expires_at;
      if (params.status !== undefined) update.status = params.status;

      const { data, error } = await supabase
        .from('coupons')
        .update(update)
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
}

// ===== Admin: delete coupon =====
export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
}

// ===== User: redeem coupon =====
export function useRedeemCoupon() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
      if (error) throw error;
      return data as { success: boolean; message: string; amount?: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet', session?.user?.id] });
      qc.invalidateQueries({ queryKey: ['transactions', session?.user?.id] });
      qc.invalidateQueries({ queryKey: ['notifications', session?.user?.id] });
    },
  });
}

// ===== Admin: list redemptions for a coupon =====
export function useCouponRedemptions(couponId: string | null) {
  return useQuery({
    queryKey: ['coupon-redemptions', couponId],
    queryFn: async () => {
      if (!couponId) return [];
      const { data, error } = await supabase
        .from('coupon_redemptions')
        .select('*, user:profiles!coupon_redemptions_user_id_fkey(full_name, username, phone)')
        .eq('coupon_id', couponId)
        .order('redeemed_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!couponId,
  });
}
