import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Allow port override via env variable (used by Playwright tests)
    port: process.env.VITE_DEV_SERVER_PORT
      ? parseInt(process.env.VITE_DEV_SERVER_PORT, 10)
      : undefined,
  },
})