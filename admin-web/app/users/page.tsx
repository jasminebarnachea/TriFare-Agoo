import { AdminNav } from '../../components/AdminNav';
import { readUsers } from '../../lib/users';

export const dynamic = 'force-dynamic';
export default async function UsersPage() {
  const users = await readUsers();
  return <><AdminNav active="users" /><main><header><div><p className="kicker">REGISTERED ACCOUNTS</p><h1>Users</h1><p className="subtitle">People who created an account through the Tri Fare Agoo mobile app.</p></div><div className="count"><strong>{users.length}</strong><span>Total users</span></div></header>
    {!users.length ? <section className="empty"><div>◎</div><h2>No registered users yet</h2><p>New sign-ups will appear here.</p></section> : <section className="userTable"><div className="userHead"><span>User</span><span>Role</span><span>Joined</span></div>{users.map(user => <div className="userRow" key={user.id}><div className="userIdentity">{user.photoUrl ? <img src={user.photoUrl} alt="" /> : <span>{user.name.slice(0,1).toUpperCase()}</span>}<div><strong>{user.name}</strong><small>{user.email}</small></div></div><span className="role">{user.role}</span><time>{new Date(user.createdAt).toLocaleString()}</time></div>)}</section>}
  </main></>;
}
