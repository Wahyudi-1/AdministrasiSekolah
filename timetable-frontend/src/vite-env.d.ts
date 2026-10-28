/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GITHUB_OWNER?: string;
  readonly VITE_GITHUB_REPO?: string;
  readonly VITE_GITHUB_PAT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
