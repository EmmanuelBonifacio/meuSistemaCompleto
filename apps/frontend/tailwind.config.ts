import type { Config } from "tailwindcss";

// =============================================================================
// tailwind.config.ts
// =============================================================================
// O QUE FAZ:
//   Configura o Tailwind CSS para o projeto, definindo:
//   - Quais arquivos ele deve "varrer" para gerar apenas as classes usadas
//   - A paleta de cores customizada (design system)
//   - A fonte padrão (Inter, estilo Enterprise Moderno à la Stripe/Vercel)
//   - Animações e bordas customizadas
//
// POR QUE DEFINIR UMA PALETA CUSTOMIZADA?
//   Ao centralizar as cores aqui, garantimos consistência visual.
//   Chamamos classe `bg-primary` em vez de `bg-indigo-600` espalhado
//   pelo código. Se precisar mudar a cor primária, muda só aqui.
//
// O QUE É "content"?
//   O Tailwind varre os arquivos listados em `content` procurando classes
//   CSS usadas. Apenas essas classes são incluídas no CSS final (PurgeCSS).
//   Isso resulta em um arquivo CSS minúsculo em produção (geralmente < 10KB).
// =============================================================================

const config: Config = {
  // Modo "class" permite ativar/desativar dark mode via classe .dark no <html>
  darkMode: ["class"],

  // Qualquer .tsx sob src/ (inclui pastas novas como components/landing) — evita purge a perder estilos
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],

  theme: {
    extend: {
      // ------------------------------------------------------------------
      // FONTES: Inter (Google Fonts via next/font)
      // ------------------------------------------------------------------
      // A variável CSS --font-inter é injetada pelo Next.js em layout.tsx
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },

      // ------------------------------------------------------------------
      // PALETA DE CORES (Design System Enterprise Moderno)
      // ------------------------------------------------------------------
      // Seguimos o padrão CSS Variables para suporte a dark mode dinâmico.
      // As variáveis são definidas em globals.css sob :root e .dark
      colors: {
        // Cores base do sistema (mapeadas para CSS variables)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Cor primária: azul rico (referência: botão "Deploy" da Vercel)
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Cor secundária: fundo suave dos cards
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Cor destrutiva: vermelho para erros e ações perigosas
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Cor de texto suave (labels, placeholders, items desativados)
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // Cor de destaque (hover, seleção)
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        // Card e componentes elevados
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Popover (menus flutuantes)
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // Sidebar (fundo escuro do menu lateral)
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
      },

      // ------------------------------------------------------------------
      // BORDAS ARREDONDADAS (estilo moderno com cantos mais suaves)
      // ------------------------------------------------------------------
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // ------------------------------------------------------------------
      // ANIMAÇÕES (para toasts, modais, etc.)
      // ------------------------------------------------------------------
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-from-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in-from-left 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
