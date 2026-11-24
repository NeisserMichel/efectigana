import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const appVersion = JSON.parse(readFileSync(new URL('./app-version.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION_CODE__: JSON.stringify(appVersion.versionCode),
    __APP_VERSION_NAME__: JSON.stringify(appVersion.versionName),
  },
})
