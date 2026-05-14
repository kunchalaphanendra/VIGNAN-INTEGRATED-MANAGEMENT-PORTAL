import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000'
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'portal-hod':    [
            './src/pages/hod/Attendance.jsx',
            './src/pages/hod/Students.jsx',
            './src/pages/hod/Faculty.jsx',
            './src/pages/hod/Marks.jsx',
          ],
          'portal-faculty': [
            './src/pages/faculty/Attendance.jsx',
            './src/pages/faculty/Marks.jsx',
          ],
          'portal-student': [
            './src/pages/student/Dashboard.jsx',
            './src/pages/student/Attendance.jsx',
          ],
        }
      }
    }
  }
})
