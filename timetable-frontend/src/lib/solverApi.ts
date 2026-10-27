import { supabase } from './supabaseClient';

const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER as string;
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO as string;
const GITHUB_PAT = import.meta.env.VITE_GITHUB_PAT as string;

export async function wakeUpSolverServer(): Promise<boolean> {
  return true;
}

export async function triggerScheduleGeneration(): Promise<string> {
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      status: 'queued',
      progress_message: 'Memicu enjin GitHub Actions (RAM 7 GB)... Sila tunggu ±20-30 saat.'
    })
    .select()
    .single();

  if (error || !job) {
    throw new Error(`Gagal membuat barisan tugas di Supabase: ${error?.message}`);
  }

  if (GITHUB_PAT && GITHUB_OWNER && GITHUB_REPO) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/run-solver.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${GITHUB_PAT}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { job_id: job.id },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gagal memicu GitHub Actions (Status: ${res.status})`);
    }
  }

  return job.id;
}
