import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server proxies /socket.io to the Node server so the client can
// connect using same-origin (no CORS, no hardcoded URL). The same client
// build works against either:
//   - dev: Vite serves the page, proxies socket.io to localhost:3001
//   - playtest: Node serves both the built client and socket.io directly
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
