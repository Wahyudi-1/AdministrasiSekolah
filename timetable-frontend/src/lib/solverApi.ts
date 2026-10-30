import { supabase } from './supabaseClient';

const GITHUB_OWNER = 'Wahyudi-1';
const GITHUB_REPO = 'AdministrasiSekolah';
const WORKFLOW_FILE = 'run-solver.yml';

// 1. Fungsi Utama Memicu Eksekusi Solver di GitHub Actions
export const triggerScheduleGeneration = async (explicitSchoolId?: string) => {
  // Dapatkan sesi pengguna aktif sekolah (school_id)
  let schoolId = explicitSchoolId;
  if (!schoolId) {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
    }
    schoolId = userData.user.id;
  }

  // Buat antrean job baru di Supabase khusus sekolah ini
  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .insert([
      {
        school_id: schoolId,
        status: 'queued',
        progress_message: 'Memicu mesin GitHub Actions (Multi-Tenant)...',
      },
    ])
    .select()
    .single();

  if (jobError) {
    throw new Error(`Gagal membuat antrean job: ${jobError.message}`);
  }

  // Ambil token GitHub PAT (Prioritaskan env, fallback ke localStorage jika diset dari panel admin)
  const githubToken = import.meta.env.VITE_GH_PAT || localStorage.getItem('gh_pat_token');
  if (!githubToken) {
    throw new Error('Token GitHub (VITE_GH_PAT) belum dikonfigurasi.');
  }

  // Kirim trigger workflow_dispatch ke GitHub API dengan membawa school_id dan job_id
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken.trim()}`,
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
    // Jika dispatch GitHub gagal, tandai job di database sebagai failed
    await supabase
      .from('generation_jobs')
      .update({
        status: 'failed',
        progress_message: `Gagal memicu GitHub Actions: ${errText}`,
      })
      .eq('id', job.id);

    throw new Error(`Gagal memicu GitHub Actions (Status: ${response.status}): ${errText}`);
  }

  return job;
};

// 2. Fungsi Kompatibilitas untuk Komponen Lain
export const wakeUpSolverServer = async (): Promise<boolean> => {
  return true;
};

// 3. Fungsi Kompatibilitas Status Job dengan Isolasi Sekolah
export const getLatestJobStatus = async (jobId?: string, schoolId?: string) => {
  if (!jobId) return null;
  let query = supabase.from('generation_jobs').select('*').eq('id', jobId);
  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }
  const { data } = await query.single();
  return data;
};
