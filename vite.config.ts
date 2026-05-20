import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from "@tailwindcss/vite";
import path from 'node:path'   // important

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact({
      prerender: {
        enabled: true,
        renderTarget: "#root",
        additionalPrerenderRoutes: [
          "/",
          "/services",
          "/pricing",
          "/contact",
          "/terms",
          "/privacy",
          "/legal",
          "/cgv",
        ],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
