import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno para que estén disponibles en el proceso de build
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    base: '/', 
    define: {
      // Esto permite usar process.env.API_KEY en el código del cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Prevenir crash si se accede a otras props de process.env
      'process.env': {}
    }
  }
})