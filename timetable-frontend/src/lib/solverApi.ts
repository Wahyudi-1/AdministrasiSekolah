import { supabase } from './supabaseClient';

const GITHUB_OWNER = 'Wahyudi-1';
const GITHUB_REPO = 'AdministrasiSekolah';
const WORKFLOW_FILE = 'run-solver.yml';

export const triggerScheduleGeneration = async () => {
  // 1. Dapatkan sesi pengguna aktif (school_id)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
  }
  const schoolId = userData.user.id;

  // 2. Buat baris job baru di Supabase khusus untuk school_id ini
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

  // 3. Panggil GitHub Actions API dengan membawa job_id dan school_id
  const githubToken = import.meta.env.VITE_GH_PAT;
  if (!githubToken) {
    throw new Error('Konfigurasi VITE_GH_PAT belum terpasang di environment.');
  }

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
