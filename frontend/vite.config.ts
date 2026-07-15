import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El navegador solo habla con el propio origen: el proxy de dev evita abrir CORS
// entre 5173 y 3000 (referencia 14.1).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
