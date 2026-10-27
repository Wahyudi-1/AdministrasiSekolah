import { supabase } from './supabaseClient';

const SOLVER_URL = (import.meta.env.VITE_SOLVER_API_URL as string)?.replace(/\/$/, '');

/**
 * Mengirim sinyal ping ke Render.com saat web pertama kali dibuka
 * agar server bangun dari mode tidur sebelum pengguna menekan tombol Generate.
 */
export async function wakeUpSolverServer(): Promise<boolean> {
  if (!SOLVER_URL) return false;
  try {
    const res = await fetch(`${SOLVER_URL}/`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function triggerScheduleGeneration(): Promise<string> {
  // 1. Buat antrean job di Supabase
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      status: 'queued',
      progress_message: 'Menghubungi Solver Engine di Render.com (mohon tunggu ±20 detik jika server baru bangun)...'
    })
    .select()
    .single();

  if (error || !job) {
    throw new Error(`Gagal membuat antrean di Supabase: ${error?.message}`);
  }

  // 2. Panggil endpoint FastAPI di Render.com
  const response = await fetch(`${SOLVER_URL}/api/generate-timetable`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: job.id }),
  });

  if (!response.ok) {
    throw new Error(`Gagal memicu Solver Render.com (Status: ${response.status})`);
  }

  return job.id;
}
