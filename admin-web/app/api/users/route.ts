import { NextResponse } from 'next/server';
import { readUsers, saveUser, type UserWrite } from '../../../lib/users';
import { uploadPrivatePhoto } from '../../../lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() { return NextResponse.json(await readUsers()); }

export async function POST(request: Request) {
  const form = await request.formData();
  const value = (key: string) => String(form.get(key) ?? '').trim().slice(0, 500);
  const email = value('email').toLowerCase();
  if (!email || !value('name')) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  const photo = form.get('photo');
  let photoPath: string | null = null;
  if (photo instanceof File && photo.size) {
    photoPath = await uploadPrivatePhoto('users', photo);
  }
  const user: UserWrite = { id: value('clientId') || crypto.randomUUID(), createdAt: new Date().toISOString(), name: value('name'), email, role: value('role'), photoPath };
  await saveUser(user);
  return NextResponse.json(user, { status: 201 });
}
