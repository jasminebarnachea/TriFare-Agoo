import { promises as fs } from 'node:fs';
import path from 'node:path';

export type UserRecord = { id: string; createdAt: string; name: string; email: string; role: string; photoUrl: string | null };
const dataDirectory = path.join(process.cwd(), 'data');
const usersFile = path.join(dataDirectory, 'users.json');

export async function readUsers(): Promise<UserRecord[]> {
  try { return JSON.parse(await fs.readFile(usersFile, 'utf8')) as UserRecord[]; }
  catch { return []; }
}

export async function saveUser(user: UserRecord) {
  await fs.mkdir(dataDirectory, { recursive: true });
  const users = await readUsers();
  const existing = users.findIndex(item => item.email.toLowerCase() === user.email.toLowerCase());
  if (existing >= 0) users[existing] = { ...users[existing], ...user, id: users[existing].id, createdAt: users[existing].createdAt };
  else users.unshift(user);
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}
