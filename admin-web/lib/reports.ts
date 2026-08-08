import { promises as fs } from 'node:fs';
import path from 'node:path';

export type ReportRecord = {
  id: string; createdAt: string; issue: string; details: string; reporterName: string; reporterEmail: string;
  destination: string; distanceKm: string; fare: string; latitude: string; longitude: string; photoUrl: string | null;
};

const dataDirectory = path.join(process.cwd(), 'data');
const reportsFile = path.join(dataDirectory, 'reports.json');

export async function readReports(): Promise<ReportRecord[]> {
  try { return JSON.parse(await fs.readFile(reportsFile, 'utf8')) as ReportRecord[]; }
  catch { return []; }
}

export async function saveReport(report: ReportRecord) {
  await fs.mkdir(dataDirectory, { recursive: true });
  const reports = await readReports();
  if (reports.some(item => item.id === report.id)) return;
  reports.unshift(report);
  await fs.writeFile(reportsFile, JSON.stringify(reports, null, 2));
}
