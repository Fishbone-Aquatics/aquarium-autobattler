import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SERVER = process.env.AQUARIUM_SERVER ?? 'http://localhost:3101';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/socket.io': { target: SERVER, ws: true },
      '/api': { target: SERVER },
    },
  },
});
