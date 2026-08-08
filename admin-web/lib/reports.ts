import { getSupabaseAdmin, signedPhotoUrl } from './supabase';

export type ReportRecord = {
  id: string; createdAt: string; issue: string; details: string; reporterName: string; reporterEmail: string;
  destination: string; distanceKm: string; fare: string; latitude: string; longitude: string; photoUrl: string | null;
};
export type ReportWrite = Omit<ReportRecord, 'photoUrl'> & { photoPath: string | null };

export async function readReports(): Promise<ReportRecord[]> {
  const { data, error } = await getSupabaseAdmin().from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data ?? []).map(async row => ({
    id: row.id,
    createdAt: row.created_at,
    issue: row.issue,
    details: row.details,
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email,
    destination: row.destination,
    distanceKm: row.distance_km,
    fare: row.fare,
    latitude: row.latitude,
    longitude: row.longitude,
    photoUrl: await signedPhotoUrl(row.photo_path),
  })));
}

export async function saveReport(report: ReportWrite) {
  const { error } = await getSupabaseAdmin().from('reports').upsert({
    id: report.id,
    created_at: report.createdAt,
    issue: report.issue,
    details: report.details,
    reporter_name: report.reporterName,
    reporter_email: report.reporterEmail,
    destination: report.destination,
    distance_km: report.distanceKm,
    fare: report.fare,
    latitude: report.latitude,
    longitude: report.longitude,
    photo_path: report.photoPath,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}
