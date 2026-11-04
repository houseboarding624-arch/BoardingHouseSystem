import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/BoardingHouseSystem/',
  plugins: [react()],
  server: {
    // ilagay dito yung dati mong proxy config, kung meron
  },
})