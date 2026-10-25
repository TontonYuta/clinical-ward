import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const currentDir = import.meta.dirname;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(currentDir, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-ai';
              }
              return 'vendor-libs';
            }
          },
        },
      },
    },
    server: {
      proxy: {
        '/api-dav': {
          target: 'https://dichvucong.dav.gov.vn',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-dav/, ''),
        },
        '/api': {
          target: 'https://clinical-ward.vercel.app',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/api-dav': {
          target: 'https://dichvucong.dav.gov.vn',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-dav/, ''),
        },
      },
    },
  };
});
