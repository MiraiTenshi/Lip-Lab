import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves project sites from /<repo-name>/, so the base path
// must match the repository name. Set REPO_NAME as an env var at build time
// (the included GitHub Action does this automatically), or edit the
// fallback string below to match your repo.
const repoName = process.env.REPO_NAME || 'lip-shade-lab'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
})
