import Link from 'next/link';

export function AdminNav({ active }: { active: 'overview' | 'reports' | 'users' }) {
  return <nav><div className="logo"><span>TF</span><div>Tri Fare Agoo<small>Administration</small></div></div><div className="navLinks">
    <Link className={active === 'overview' ? 'active' : ''} href="/">Overview</Link>
    <Link className={active === 'reports' ? 'active' : ''} href="/reports">Reports</Link>
    <Link className={active === 'users' ? 'active' : ''} href="/users">Users</Link>
  </div></nav>;
}
