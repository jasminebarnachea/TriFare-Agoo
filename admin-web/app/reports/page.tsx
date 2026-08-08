import { AdminNav } from '../../components/AdminNav';
import { readReports } from '../../lib/reports';

export const dynamic = 'force-dynamic';
export default async function ReportsPage() {
  const reports = await readReports();
  return <><AdminNav active="reports" /><main><header><div><p className="kicker">TRI FARE AGOO</p><h1>Reports & Feedback</h1><p className="subtitle">Passenger concerns, trip information, locations, and photo evidence.</p></div><div className="count"><strong>{reports.length}</strong><span>Total reports</span></div></header>
    {!reports.length ? <section className="empty"><div>✓</div><h2>No reports yet</h2><p>New mobile submissions will appear here.</p></section> : <section className="grid">{reports.map(report => <article key={report.id}>
      {report.photoUrl && <a href={report.photoUrl} target="_blank"><img src={report.photoUrl} alt={`Evidence for ${report.issue}`} /></a>}
      <div className="content"><div className="topline"><span className="issue">{report.issue}</span><time>{new Date(report.createdAt).toLocaleString()}</time></div><h2>{report.destination}</h2><p className="details">{report.details || 'No additional details provided.'}</p>
        <dl><div><dt>Reporter</dt><dd>{report.reporterName}<small>{report.reporterEmail}</small></dd></div><div><dt>Trip</dt><dd>{report.distanceKm ? `${report.distanceKm} km` : '—'}{report.fare && <small>₱{report.fare} fare</small>}</dd></div><div><dt>GPS</dt><dd>{report.latitude && report.longitude ? <a href={`https://maps.google.com/?q=${report.latitude},${report.longitude}`} target="_blank">View location</a> : 'Unavailable'}</dd></div></dl>
      </div></article>)}</section>}
  </main></>;
}
