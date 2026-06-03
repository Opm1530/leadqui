import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo.png", "icons/*.png"],
      devOptions: {
        enabled: true, // Ativa PWA também em dev para testar
      },
      manifest: {
        name: "Pequi Digital — Ecossistema",
        short_name: "Pequi Digital",
        description: "Plataforma completa de gestão para agências digitais",
        theme_color: "#0A0A0A",
        background_color: "#0A0A0A",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/hub",
        lang: "pt-BR",
        categories: ["business", "productivity"],
        icons: [
          { src: "/icons/icon-72x72.png",   sizes: "72x72",   type: "image/png" },
          { src: "/icons/icon-96x96.png",   sizes: "96x96",   type: "image/png" },
          { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
          { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
          { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
          { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
          { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Leads",
            short_name: "Leads",
            description: "Acessar gestão de leads",
            url: "/leads",
            icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
          },
          {
            name: "Tarefas",
            short_name: "Tasqui",
            description: "Acessar gestão de tarefas",
            url: "/tasqui",
            icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
          },
          {
            name: "Financeiro",
            short_name: "CashQui",
            description: "Acessar painel financeiro",
            url: "/cashqui",
            icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96" }],
          },
        ],
      },
      workbox: {
        // Faz cache de assets estáticos (JS, CSS, imagens)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Rotas que sempre buscam do servidor (dados em tempo real)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Cache de API com stale-while-revalidate (mostra dado do cache e atualiza em background)
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }, // 5 min
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache de imagens
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 dias
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
