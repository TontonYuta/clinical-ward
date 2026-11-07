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
            if (id.includes('src/components/RightPane/Tabs/')) {
              if (id.includes('BhytAuditTab') || id.includes('BhytAuditReportModal') || id.includes('BhytSubstitutionModal')) {
                return 'tab-bhyt';
              }
              if (id.includes('CPOE') || id.includes('CpoePrescriptionTab')) {
                return 'tab-cpoe';
              }
              if (id.includes('ColdChain')) {
                return 'tab-coldchain';
              }
            }
            if (id.includes('src/data/clinicalProfiles/')) {
              return 'clinical-profiles';
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
          target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/.vercel/**', '**/.worktrees/**', '**/backend/**', '**/artifacts/**', '**/*.db*', '**/*.sqlite*', '**/node_modules/**'],
      },
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
