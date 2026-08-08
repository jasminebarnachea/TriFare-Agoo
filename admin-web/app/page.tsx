import { AdminNav } from '../components/AdminNav';
import { readReports } from '../lib/reports';
import { readUsers } from '../lib/users';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const [reports, users] = await Promise.all([readReports(), readUsers()]);
  const issueCounts = reports.reduce<Record<string, number>>((counts, report) => ({ ...counts, [report.issue]: (counts[report.issue] ?? 0) + 1 }), {});
  const maxIssue = Math.max(1, ...Object.values(issueCounts));
  const residents = users.filter(user => user.role === 'Agoo resident').length;
  return <><AdminNav active="overview" /><main><header><div><p className="kicker">ADMIN OVERVIEW</p><h1>Dashboard</h1><p className="subtitle">A live summary of Tri Fare Agoo users and passenger concerns.</p></div></header>
    <section className="metrics"><div><span>Total users</span><strong>{users.length}</strong><small>{residents} Agoo residents</small></div><div><span>Total reports</span><strong>{reports.length}</strong><small>{reports.filter(report => report.photoUrl).length} with photo evidence</small></div><div><span>Reports today</span><strong>{reports.filter(report => new Date(report.createdAt).toDateString() === new Date().toDateString()).length}</strong><small>Submitted since midnight</small></div><div><span>Tourists</span><strong>{users.length - residents}</strong><small>Registered visitors</small></div></section>
    <section className="analytics"><div className="sectionTitle"><div><p className="kicker">ANALYTICS</p><h2>Issues by category</h2></div><a href="/reports">View reports →</a></div>
      {Object.keys(issueCounts).length ? <div className="bars">{Object.entries(issueCounts).sort((a,b) => b[1]-a[1]).map(([issue,count]) => <div className="barRow" key={issue}><span>{issue}</span><div><i style={{ width: `${Math.max(8, count / maxIssue * 100)}%` }} /></div><strong>{count}</strong></div>)}</div> : <p className="emptyLine">Analytics will appear after the first report.</p>}
    </section>
    <section className="recent"><div className="sectionTitle"><div><p className="kicker">RECENT ACTIVITY</p><h2>Latest reports</h2></div></div>{reports.slice(0,5).map(report => <div className="activity" key={report.id}><span className="issue">{report.issue}</span><div><strong>{report.destination}</strong><small>{report.reporterName} · {new Date(report.createdAt).toLocaleString()}</small></div></div>)}</section>
  </main></>;
}
