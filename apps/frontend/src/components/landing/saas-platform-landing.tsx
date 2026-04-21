"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LandingImage } from "./landing-image";

const WA = "https://wa.me/5538997330921";
const DEMO_STORE = "https://app.saasplatform.com.br/loja-demostracao/vendas";

const FEATURES = [
  {
    icon: "🛍️",
    title: "Catálogo Online",
    desc: "Monte sua vitrine profissional em minutos, com fotos, preços e categorias personalizadas.",
    color: "from-blue-500 to-indigo-600",
    bg: "bg-blue-50",
  },
  {
    icon: "💬",
    title: "Pedidos via WhatsApp",
    desc: "Seus clientes adicionam ao carrinho e finalizam o pedido direto no WhatsApp com um clique.",
    color: "from-emerald-500 to-green-600",
    bg: "bg-emerald-50",
  },
  {
    icon: "📊",
    title: "Painel Administrativo",
    desc: "Acompanhe pedidos, métricas de vendas e gerencie produtos em tempo real.",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
  },
  {
    icon: "🎨",
    title: "Identidade Visual",
    desc: "A vitrine adota automaticamente as cores da sua logo, deixando a loja com a sua cara.",
    color: "from-pink-500 to-rose-600",
    bg: "bg-pink-50",
  },
  {
    icon: "⚡",
    title: "Sempre Online",
    desc: "Infraestrutura robusta na nuvem. Sua loja funciona 24 horas por dia, sem interrupções.",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-50",
  },
  {
    icon: "🔒",
    title: "Seguro e Confiável",
    desc: "Acesso protegido com autenticação dedicada por loja e suporte direto via WhatsApp.",
    color: "from-cyan-500 to-teal-600",
    bg: "bg-cyan-50",
  },
];

/** Fotos em public/landing/ (ficheiros reais enviados pelo cliente) */
const IMG = {
  apresentacao: [
    "/landing/FotoLojaPronta6.jpg",
    "/landing/FotoLojaPronta.jpg",
    "/landing/FooLojaPronta.jpg",
    "/landing/FotoLojaPronta8.jpg",
  ],
  planos: [
    "/landing/20260420_222642.jpg",
    "/landing/FotoLojaPronta5.jpg",
    "/landing/FotoPaginaCatalogo.jpg",
  ],
  beneficios: [
    "/landing/FotoPaginaDashboardAdmin.jpg",
    "/landing/FotoModelAdicionarProduto.jpg",
    "/landing/ConfiguraçoesPaginasVendas.jpg",
    "/landing/FotoPaginaLoginAdministrador.jpg",
  ],
  painel: [
    "/landing/FotoPaginaPainelVendas.jpg",
    "/landing/FotoPaginaCatalogo.jpg",
    "/landing/Fotolojapronta1.jpg",
  ],
};

const LOGO_PATHS = [
  "/landing/LogoSaaSPlatform.png",
  "/landing/logo.png",
  "/landing/logo.jpg",
  "/landing/logo.webp",
  "/landing/logo-saasplatform.svg",
];

function LogoMark({ className }: { className?: string }) {
  const [i, setI] = useState(0);
  const src = LOGO_PATHS[Math.min(i, LOGO_PATHS.length - 1)];

  return (
    <div
      className={cn("saas-landing-logo flex items-center", className)}
      aria-label="SaaSPlatform"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="SaaSPlatform"
        className="object-contain object-left"
        width={1350}
        height={288}
        style={{ maxWidth: "min(1350px, 100%)", maxHeight: "18rem" }}
        onError={() => setI((n) => (n < LOGO_PATHS.length - 1 ? n + 1 : n))}
      />
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.421 1.035 7.401 3.014 1.982 1.98 3.073 4.762 3.073 7.402 0 5.452-4.436 9.888-9.888 9.888M12.05.026C5.495.026.16 5.361.16 11.916c0 2.096.546 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.89-11.89A11.898 11.898 0 0020.188.026h-8.137z" />
    </svg>
  );
}

function WAButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={WA}
      target="_blank"
      rel="noopener noreferrer"
      className={`landing-wa-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-900/20 transition-all duration-300 hover:scale-[1.03] hover:bg-[#20bd5a] hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] ${className ?? ""}`}
    >
      <WhatsAppIcon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
      <span className="whitespace-nowrap">{children}</span>
    </a>
  );
}

function SectionTitle({
  emoji,
  title,
  subtitle,
  light,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className="mb-3 inline-flex items-center justify-center rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-700">
        {emoji} {title}
      </span>
      <h2
        className={cn(
          "text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.6rem]",
          light ? "text-white" : "text-slate-900",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-3 text-base sm:text-lg",
            light ? "text-white/75" : "text-slate-500",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function SaasPlatformLanding() {
  return (
    <div
      className={cn(
        "saas-landing relative min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white text-slate-900 antialiased",
      )}
      style={{
        fontFamily:
          "var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Background decorativo fixo ── */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#dbeafe] via-white to-[#f0fdf4]" />
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-[#2563eb]/20 to-[#6366f1]/10 blur-[100px]" />
        <div className="absolute -right-40 top-[30%] h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#22c55e]/15 to-[#10b981]/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-t from-[#2563eb]/8 to-transparent blur-[80px]" />
      </div>

      {/* ══════════════ HEADER ══════════════ */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <LogoMark className="min-w-0" />
          <nav className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            <a
              href="#planos"
              className="hidden text-sm font-medium text-slate-600 transition hover:text-[#2563eb] md:inline"
            >
              Planos
            </a>
            <WAButton>Falar no WhatsApp</WAButton>
          </nav>
        </div>
      </header>

      <main className="w-full pb-32 sm:pb-28">
        {/* ══════════════ HERO ══════════════ */}
        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Texto */}
            <div className="min-w-0 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-700 shadow-sm">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                Catálogo online · WhatsApp · Pedidos
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.2rem]">
                Venda mais com seu{" "}
                <span
                  className="bg-gradient-to-r from-[#2563eb] via-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent"
                  style={{ WebkitBackgroundClip: "text" }}
                >
                  catálogo digital
                </span>{" "}
                e pedidos pelo WhatsApp
              </h1>

              <p className="max-w-[52ch] text-lg leading-relaxed text-slate-600">
                Monte sua loja online em minutos, receba pedidos direto no
                WhatsApp e gerencie tudo num painel simples e poderoso.
              </p>

              {/* Stats rápidos */}
              <div className="flex flex-wrap gap-4">
                {[
                  { val: "24h", label: "Loja sempre online" },
                  { val: "1 min", label: "Para adicionar produto" },
                  { val: "100%", label: "Personalizado" },
                ].map((s) => (
                  <div
                    key={s.val}
                    className="flex flex-col rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm"
                  >
                    <span className="text-2xl font-extrabold text-[#2563eb]">
                      {s.val}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <WAButton className="min-w-[210px] py-3.5 text-base">
                  Falar no WhatsApp agora
                </WAButton>
                <a
                  href={DEMO_STORE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-white px-6 py-3.5 text-base font-bold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#2563eb] hover:text-[#2563eb] hover:shadow-md"
                >
                  🛒 Ver loja demo
                </a>
              </div>
            </div>

            {/* Imagem hero */}
            <div className="relative w-full min-w-0">
              <div
                className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-[#2563eb]/25 via-[#6366f1]/15 to-[#22c55e]/20 blur-3xl"
                aria-hidden
              />
              <figure className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_30px_80px_rgba(37,99,235,0.18)] ring-1 ring-slate-200/50">
                <LandingImage
                  paths={IMG.apresentacao}
                  alt="Vitrine de catálogo online do SaaSPlatform"
                  priority
                  className="h-auto w-full object-cover object-center"
                />
                {/* Badge flutuante */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-2xl border border-white/60 bg-white/90 px-4 py-2.5 shadow-lg backdrop-blur-md">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Pedido confirmado!
                    </p>
                    <p className="text-[10px] text-slate-500">
                      via WhatsApp · agora
                    </p>
                  </div>
                </div>
              </figure>
            </div>
          </div>
        </section>

        {/* ══════════════ FEATURES GRID ══════════════ */}
        <section className="border-y border-slate-100 bg-gradient-to-b from-slate-50/80 to-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              emoji="⚡"
              title="Tudo que você precisa"
              subtitle="Uma plataforma completa para vender, organizar e crescer."
            />
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className={cn(
                      "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow-md transition-transform duration-300 group-hover:scale-110",
                      f.color,
                    )}
                  >
                    {f.icon}
                  </div>
                  <h3 className="mb-1.5 text-base font-bold text-slate-900">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {f.desc}
                  </p>
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-2xl transition-opacity duration-300 group-hover:opacity-60",
                      f.bg,
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ PLANOS ══════════════ */}
        <section id="planos" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              emoji="📦"
              title="Planos disponíveis"
              subtitle="Escolha o ritmo do seu crescimento. Sem surpresas."
            />

            <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
              {/* Imagem */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-lg sm:p-4">
                <LandingImage
                  paths={IMG.planos}
                  alt="Planos e investimento"
                  className="h-auto w-full rounded-2xl object-cover"
                />
              </div>

              {/* Cards de plano */}
              <div className="space-y-5">
                {/* Semestral */}
                <div className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:p-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Plano Semestral
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        6 meses de acesso completo
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-extrabold text-slate-900">
                        R$ 180
                        <span className="text-base font-normal text-slate-400">
                          ,00
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">R$ 30/mês</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-500">
                    Ideal para testar e validar o sistema. Acesso a todos os
                    recursos.
                  </p>
                </div>

                {/* Anual — destaque */}
                <div className="group relative overflow-hidden rounded-3xl border-2 border-[#2563eb] bg-gradient-to-br from-blue-600 to-indigo-700 p-6 shadow-2xl shadow-blue-900/25 transition-all duration-300 hover:-translate-y-0.5 sm:p-8">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                  <div className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                  <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-[#2563eb] shadow-md sm:text-xs">
                    🏆 Melhor valor
                  </span>
                  <div className="relative flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Plano Anual
                      </h3>
                      <p className="mt-1 text-sm text-blue-200">
                        12 meses com economia garantida
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-extrabold text-white">
                        R$ 150
                        <span className="text-base font-normal text-blue-300">
                          /mês
                        </span>
                      </p>
                      <p className="text-xs text-blue-300">
                        Economia de R$ 30/mês
                      </p>
                    </div>
                  </div>
                  <p className="relative mt-4 text-sm text-blue-100">
                    Melhor custo-benefício com suporte prioritário e
                    estabilidade durante todo o ano.
                  </p>
                  <div className="relative mt-5 flex flex-wrap gap-2">
                    {[
                      "✓ Suporte dedicado",
                      "✓ Treinamento",
                      "✓ Atualizações incluídas",
                    ].map((b) => (
                      <span
                        key={b}
                        className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center lg:justify-start">
                  <WAButton className="min-w-[220px] py-3.5 text-base">
                    Quero contratar agora
                  </WAButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ BENEFÍCIOS ══════════════ */}
        <section className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              emoji="🎯"
              title="Benefícios inclusos"
              subtitle="Você não contrata só um software — contrata parceria e suporte real."
            />
            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
              <ul className="min-w-0 space-y-5">
                {[
                  {
                    icon: "🎧",
                    title: "Suporte dedicado",
                    desc: "Atendimento direto para resolver dúvidas e problemas com agilidade.",
                  },
                  {
                    icon: "🎓",
                    title: "Treinamento personalizado",
                    desc: "Aprenda a usar o sistema do jeito certo, no seu ritmo.",
                  },
                  {
                    icon: "👤",
                    title: "Acompanhamento individual",
                    desc: "Atenção especial para atender as necessidades únicas do seu negócio.",
                  },
                  {
                    icon: "🌐",
                    title: "Catálogo sempre online",
                    desc: "Infraestrutura na nuvem com alta disponibilidade e sem falhas.",
                  },
                ].map((b) => (
                  <li
                    key={b.title}
                    className="group flex gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:border-blue-100 hover:shadow-md"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-2xl shadow-sm">
                      {b.icon}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{b.title}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-100">
                <LandingImage
                  paths={IMG.beneficios}
                  alt="Suporte e treinamento"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ MÓDULO DE VENDAS ══════════════ */}
        <section className="relative overflow-hidden py-16 sm:py-24">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e3a8a] to-[#1e40af]" />
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              emoji="🛠️"
              title="Módulo de Vendas"
              subtitle="O coração do seu catálogo e dos pedidos pelo WhatsApp"
              light
            />
            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
              <div className="order-2 min-w-0 space-y-5 lg:order-1">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: "✏️", text: "Adicionar e editar produtos" },
                    { icon: "💰", text: "Preços e promoções flexíveis" },
                    { icon: "🗂️", text: "Categorias personalizadas" },
                    { icon: "📬", text: "Pedidos em tempo real" },
                  ].map((item) => (
                    <div
                      key={item.text}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:bg-white/15"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-sm font-medium text-white">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <WAButton className="min-w-[200px] py-3.5">
                    Quero minha loja agora
                  </WAButton>
                  <a
                    href={DEMO_STORE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border-2 border-white/40 px-6 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:border-white/70 hover:bg-white/10"
                  >
                    Ver demonstração →
                  </a>
                </div>
              </div>
              <div className="order-1 w-full min-w-0 lg:order-2">
                <div className="relative overflow-hidden rounded-3xl border border-white/20 shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
                  <LandingImage
                    paths={IMG.painel}
                    alt="Painel de vendas e pedidos pelo WhatsApp"
                    className="h-auto w-full object-cover object-top"
                  />
                  <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════ CTA FINAL ══════════════ */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <span className="mb-4 inline-block text-5xl">🚀</span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Pronto para começar a vender?
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-lg text-slate-500">
              Entre em contato agora e tenha sua loja online funcionando ainda
              hoje.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <WAButton className="min-w-[240px] py-4 text-base">
                Começar agora pelo WhatsApp
              </WAButton>
              <a
                href={DEMO_STORE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-8 py-4 text-base font-bold text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:text-[#2563eb] hover:shadow-md"
              >
                🛒 Explorar loja demo
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="w-full border-t border-slate-100 bg-slate-50 pb-28 pt-10 sm:pb-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
            <LogoMark />
            <div>
              <p className="font-semibold text-slate-800">
                SaaSPlatform — Soluções sob medida para o seu negócio.
              </p>
              <p className="mt-0.5 text-sm text-slate-400">
                © 2026 Todos os direitos reservados.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={DEMO_STORE}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 transition hover:text-[#2563eb]"
            >
              Ver demo
            </a>
            <Link
              href="/admin"
              className="text-sm text-slate-500 transition hover:text-[#2563eb]"
            >
              Painel Admin
            </Link>
          </div>
        </div>
      </footer>

      {/* ══════════════ BARRA WHATSAPP FIXO ══════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-700/20 bg-gradient-to-r from-[#25D366] to-[#20bd5a] px-4 py-3 shadow-[0_-8px_30px_rgba(37,211,102,0.25)] backdrop-blur-sm supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3">
          <WhatsAppIcon className="h-5 w-5 shrink-0 text-white" />
          <a
            href={WA}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-md text-center text-sm font-bold text-white sm:w-auto"
          >
            Falar no WhatsApp e montar minha loja
          </a>
        </div>
      </div>
    </div>
  );
}
