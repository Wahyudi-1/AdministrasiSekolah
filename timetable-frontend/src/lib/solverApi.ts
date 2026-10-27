import { supabase } from './supabaseClient';

const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER as string; // Username GitHub Anda
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO as string;   // Nama Repo Anda
const GITHUB_PAT = import.meta.env.VITE_GITHUB_PAT as string;     // Opsional jika tidak memakai Supabase Webhook

export async function wakeUpSolverServer(): Promise<boolean> {
  // GitHub Actions selalu siap (Serverless 7GB RAM), tidak butuh wake-up ping
  return true;
}

export async function triggerScheduleGeneration(): Promise<string> {
  // 1. Buat baris tugas baru di tabel generation_jobs Supabase
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      status: 'queued',
      progress_message: 'Memicu mesin GitHub Actions (RAM 7 GB)... Proses memakan waktu ±20-30 detik.'
    })
    .select()
    .single();

  if (error || !job) {
    throw new Error(`Gagal membuat antrean di Supabase: ${error?.message}`);
  }

  // 2. Jika VITE_GITHUB_PAT diisi, picu langsung workflow_dispatch GitHub API dari browser
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
