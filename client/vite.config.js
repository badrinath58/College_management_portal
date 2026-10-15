import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend always runs on http://localhost:5173 (the backend allows exactly this origin via CLIENT_URL)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
