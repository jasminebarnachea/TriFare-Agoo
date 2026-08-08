import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { readReports, saveReport, type ReportRecord } from '../../../lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() { return NextResponse.json(await readReports()); }

export async function POST(request: Request) {
  const form = await request.formData();
  const photo = form.get('photo');
  const value = (key: string) => String(form.get(key) ?? '').slice(0, 5000);
  const issue = value('issue').trim();
  const details = value('details').trim();
  if (!issue || (!details && !(photo instanceof File && photo.size))) {
    return NextResponse.json({ error: 'An issue and either report details or a photo are required.' }, { status: 400 });
  }
  let photoUrl: string | null = null;
  if (photo instanceof File && photo.size) {
    const extension = photo.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(path.join(uploadDirectory, filename), Buffer.from(await photo.arrayBuffer()));
    photoUrl = `/uploads/${filename}`;
  }
  const report: ReportRecord = {
    id: value('clientId') || crypto.randomUUID(), createdAt: new Date().toISOString(), issue, details,
    reporterName: value('reporterName'), reporterEmail: value('reporterEmail'), destination: value('destination'),
    distanceKm: value('distanceKm'), fare: value('fare'), latitude: value('latitude'), longitude: value('longitude'), photoUrl,
  };
  await saveReport(report);
  return NextResponse.json(report, { status: 201 });
}
