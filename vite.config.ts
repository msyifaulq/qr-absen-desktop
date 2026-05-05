import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from "./package.json";

const buildDate = new Date()
  .toISOString()
  .slice(0, 7) // YYYY-MM
  .replace("-", "."); // jadi YYYY.MM

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
