import { getSupabaseAdmin, signedPhotoUrl } from './supabase';

export type UserRecord = { id: string; createdAt: string; name: string; email: string; role: string; photoUrl: string | null };
export type UserWrite = Omit<UserRecord, 'photoUrl'> & { photoPath: string | null };

export async function readUsers(): Promise<UserRecord[]> {
  const { data, error } = await getSupabaseAdmin().from('users').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map(async row => ({
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email,
    role: row.role,
    photoUrl: await signedPhotoUrl(row.photo_path),
  })));
}

export async function saveUser(user: UserWrite) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await supabase.from('users').select('id, created_at, photo_path').eq('email', user.email).maybeSingle();
  if (lookupError) throw lookupError;
  const { error } = await supabase.from('users').upsert({
    id: existing?.id ?? user.id,
    created_at: existing?.created_at ?? user.createdAt,
    name: user.name,
    email: user.email,
    role: user.role,
    photo_path: user.photoPath ?? existing?.photo_path ?? null,
  }, { onConflict: 'email' });
  if (error) throw error;
}
