import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Client-side Supabase client (for use in browser/client components)
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

// Service role client (for backend operations that bypass RLS)
export const createServiceClient = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

// Storage configuration
export const STORAGE_BUCKETS = {
  DOCUMENTS: 'documents',
} as const;

// Helper to get signed URL for private files
export async function getSignedUrl(path: string, expiresIn: number = 3600) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.DOCUMENTS)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

// Helper to delete file from storage
export async function deleteFile(path: string) {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.DOCUMENTS)
    .remove([path]);

  if (error) throw error;
}
