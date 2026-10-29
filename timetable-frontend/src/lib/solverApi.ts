import { supabase } from './supabaseClient';

const GITHUB_OWNER = 'Wahyudi-1';
const GITHUB_REPO = 'AdministrasiSekolah';
const WORKFLOW_FILE = 'run-solver.yml';

// 1. Fungsi Utama Memicu Eksekusi Solver di GitHub Actions
export const triggerScheduleGeneration = async () => {
  // Dapatkan sesi pengguna aktif (school_id)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
  }
  const schoolId = userData.user.id;

  // Buat antrean job baru di Supabase khusus sekolah ini
  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .insert([
      {
        school_id: schoolId,
        status: 'queued',
        progress_message: 'Memicu enjin GitHub Actions...',
      },
    ])
    .select()
    .single();

  if (jobError) throw new Error(`Gagal membuat antrean job: ${jobError.message}`);

  // Ambil token GitHub PAT
  const githubToken = import.meta.env.VITE_GH_PAT;
  if (!githubToken) {
    throw new Error('Konfigurasi VITE_GH_PAT belum terpasang di file .env atau Secrets.');
  }

  // Kirim trigger workflow_dispatch ke GitHub API
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          job_id: String(job.id),
          school_id: String(schoolId),
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal memicu GitHub Actions (Status: ${response.status}): ${errText}`);
  }

  return job;
};

// 2. Fungsi Kompatibilitas untuk Komponen Lama (Menghilangkan Error Build)
export const wakeUpSolverServer = async (): Promise<boolean> => {
  // Karena solver berjalan serverless on-demand di GitHub Actions,
  // fungsi ini selalu mengembalikan status siap (true).
  return true;
};

// 3. Fungsi Kompatibilitas Status Job
export const getLatestJobStatus = async (jobId?: string) => {
  if (!jobId) return null;
  const { data } = await supabase.from('generation_jobs').select('*').eq('id', jobId).single();
  return data;
};
