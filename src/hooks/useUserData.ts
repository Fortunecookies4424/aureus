import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Wallet, Investment, InvestmentPackage, Deposit, Withdrawal, Transaction, Notification, Referral } from '@/types/database';

// ===== Wallet =====
export function useWallet() {
  const { session } = useAuth();
  return useQuery<Wallet>({
    queryKey: ['wallet', session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('ensure_wallet', { p_user_id: session!.user.id });
      const { data: wallet, error } = await supabase.from('wallets').select('*').eq('user_id', session!.user.id).maybeSingle();
      if (error) throw error;
      return wallet as Wallet;
    },
    enabled: !!session,
  });
}

// ===== Investment Packages =====
export function useInvestmentPackages(activeOnly = false) {
  return useQuery<InvestmentPackage[]>({
    queryKey: ['packages', { activeOnly }],
    queryFn: async () => {
      let query = supabase.from('investment_packages').select('*').order('sort_order', { ascending: true });
      if (activeOnly) query = query.eq('status', 'active');
      const { data, error } = await query;
      if (error) throw error;
      return data as InvestmentPackage[];
    },
  });
}

// ===== My Investments =====
export function useMyInvestments() {
  const { session } = useAuth();
  return useQuery<Investment[]>({
    queryKey: ['my-investments', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Investment[];
    },
    enabled: !!session,
  });
}

// ===== Start Investment =====
export function useStartInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ packageId, amount }: { packageId: string; amount: number }) => {
      const { data, error } = await supabase.rpc('start_investment', {
        p_package_id: packageId,
        p_amount: amount,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['my-investments'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// ===== Deposits =====
export function useMyDeposits() {
  const { session } = useAuth();
  return useQuery<Deposit[]>({
    queryKey: ['my-deposits', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Deposit[];
    },
    enabled: !!session,
  });
}

export function useCreateDeposit() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (params: { amount: number; method: string; proofUrl?: string; reference: string }) => {
      const { data, error } = await supabase.from('deposits').insert({
        user_id: session!.user.id,
        amount: params.amount,
        method: params.method,
        proof_url: params.proofUrl || null,
        reference: params.reference,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-deposits'] });
    },
  });
}

// ===== Withdrawals =====
export function useMyWithdrawals() {
  const { session } = useAuth();
  return useQuery<Withdrawal[]>({
    queryKey: ['my-withdrawals', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Withdrawal[];
    },
    enabled: !!session,
  });
}

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { amount: number; bankName: string; bankAccountName: string; bankAccountNumber: string }) => {
      const { data, error } = await supabase.rpc('request_withdrawal', {
        p_amount: params.amount,
        p_bank_name: params.bankName,
        p_bank_account_name: params.bankAccountName,
        p_bank_account_number: params.bankAccountNumber,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['my-withdrawals'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// ===== Transactions =====
export function useMyTransactions() {
  const { session } = useAuth();
  return useQuery<Transaction[]>({
    queryKey: ['transactions', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!session,
  });
}

// ===== Notifications =====
export function useNotifications() {
  const { session } = useAuth();
  return useQuery<Notification[]>({
    queryKey: ['notifications', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${session!.user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!session,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', session!.user.id)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ===== Referrals =====
export function useReferrals() {
  const { session } = useAuth();
  return useQuery<Referral[]>({
    queryKey: ['referrals', session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*, referred:referred_id(id, username, email, created_at)')
        .eq('referrer_id', session!.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Referral[];
    },
    enabled: !!session,
  });
}
