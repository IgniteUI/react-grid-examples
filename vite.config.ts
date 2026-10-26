import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/react-grid-examples/',
  build: {
    chunkSizeWarningLimit: 10 * 1024 * 1024, // 10 MB
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: './projects/sales-grid/public/**',
          dest: '',
        },
        {
          src: './projects/erp-hierarchical-grid/public/*',
          dest: '',
        },
        {
          src: './projects/finance-grid/public/**',
          dest: '',
        },
        {
          src: './projects/hr-portal/public/**',
          dest: '',
        },
        {
          src: './projects/fleet-management-grid/public/**',
          dest: '',
        },
        {
          src: './projects/manufacturing/public/**',
          dest: '',
        },
        // '/*' copies only the top-level 'assets' folder, keeping 'assets/<app>/...' intact;
        // '/**' would also copy every nested folder and file to the site root.
        {
          src: './projects/fleet-management-new/public/*',
          dest: '',
        },
        {
          src: './projects/excel/public/*',
          dest: '',
        }
      ]
    })
  ],
  resolve: {
    mainFields: ['module']
  },
  server: {
    open: true,
    port: 3003,
  },
});
