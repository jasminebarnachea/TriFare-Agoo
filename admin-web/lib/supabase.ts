import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'tri-fare-uploads';

export async function uploadPrivatePhoto(folder: 'users' | 'reports', photo: File) {
  const supabase = getSupabaseAdmin();
  const extension = photo.type === 'image/png' ? 'png' : 'jpg';
  const objectPath = `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(storageBucket).upload(
    objectPath,
    Buffer.from(await photo.arrayBuffer()),
    { contentType: photo.type || `image/${extension}`, upsert: false },
  );
  if (error) throw error;
  return objectPath;
}

export async function signedPhotoUrl(objectPath: string | null) {
  if (!objectPath) return null;
  const { data, error } = await getSupabaseAdmin().storage
    .from(storageBucket)
    .createSignedUrl(objectPath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
