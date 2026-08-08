import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readUsers, saveUser, type UserRecord } from '../../../lib/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() { return NextResponse.json(await readUsers()); }

export async function POST(request: Request) {
  const form = await request.formData();
  const value = (key: string) => String(form.get(key) ?? '').trim().slice(0, 500);
  const email = value('email').toLowerCase();
  if (!email || !value('name')) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  const photo = form.get('photo');
  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size) {
    const filename = `${Date.now()}-${crypto.randomUUID()}.jpg`;
    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(path.join(uploadDirectory, filename), Buffer.from(await photo.arrayBuffer()));
    photoUrl = `/uploads/${filename}`;
  }
  const user: UserRecord = { id: value('clientId') || crypto.randomUUID(), createdAt: new Date().toISOString(), name: value('name'), email, role: value('role'), photoUrl };
  await saveUser(user);
  return NextResponse.json(user, { status: 201 });
}
