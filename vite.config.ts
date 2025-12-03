import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/navidad-en-la-mesa/', // IMPORTANTE: Esto debe coincidir con el nombre de tu repositorio en GitHub
})