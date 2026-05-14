import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,       // makes it accessible on your local network (for Android testing)
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,   // rewrites Origin header so backend CORS doesn't block phone IP
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
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
