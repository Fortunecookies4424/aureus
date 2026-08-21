import { supabase } from '@/lib/supabase';

export async function uploadPackageImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `pkg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('package-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('package-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function uploadPromoBanner(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `promo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('promo-banners')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage.from('promo-banners').getPublicUrl(fileName);
  return data.publicUrl;
}

export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgMjAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzFhMWEyMCIvPjxyZWN0IHg9IjE4MCIgeT0iODUiIHdpZHRoPSI0MCIgaGVpZ2h0PSIzMCIgcng9IjYiIGZpbGw9IiNkNGFmMzciIG9wYWNpdHk9IjAuMjUiLz48L3N2Zz4=';
