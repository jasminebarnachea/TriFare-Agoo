import { NextResponse } from 'next/server';
import { readReports, saveReport, type ReportWrite } from '../../../lib/reports';
import { uploadPrivatePhoto } from '../../../lib/supabase';

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
  let photoPath: string | null = null;
  if (photo instanceof File && photo.size) {
    photoPath = await uploadPrivatePhoto('reports', photo);
  }
  const report: ReportWrite = {
    id: value('clientId') || crypto.randomUUID(), createdAt: new Date().toISOString(), issue, details,
    reporterName: value('reporterName'), reporterEmail: value('reporterEmail'), destination: value('destination'),
    distanceKm: value('distanceKm'), fare: value('fare'), latitude: value('latitude'), longitude: value('longitude'), photoPath,
  };
  await saveReport(report);
  return NextResponse.json(report, { status: 201 });
}
