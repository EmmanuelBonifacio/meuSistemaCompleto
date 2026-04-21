"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LandingImage } from "./landing-image";

const WA = "https://wa.me/5538997330921";
const DEMO_STORE = "https://app.saasplatform.com.br/loja-demonstracao/vendas";

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
        width={220}
        height={44}
        style={{ maxWidth: "min(240px, 100%)", maxHeight: "2.75rem" }}
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
      className={`landing-wa-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#25D366] px-3 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[#20bd5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366] sm:px-5 sm:text-sm ${className ?? ""}`}
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
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h2 className="flex flex-col items-center gap-1 text-2xl font-bold tracking-tight text-slate-900 sm:flex-row sm:justify-center sm:text-3xl md:text-4xl">
        <span aria-hidden>{emoji}</span>
        <span>{title}</span>
      </h2>
      {subtitle ? (
        <p className="mt-3 text-base text-slate-600 sm:text-lg">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function SaasPlatformLanding() {
  return (
    <div
      className={cn(
        "saas-landing relative min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 text-slate-900 antialiased",
      )}
      style={{
        fontFamily:
          "var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-[#e8f0ff] via-slate-50 to-slate-100" />
        <div className="absolute left-0 right-0 top-0 mx-auto h-[min(520px,70vh)] max-w-[1400px] rounded-b-[40%] bg-gradient-to-br from-[#3b82f6]/12 via-[#64748b]/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 max-w-[50vw] rounded-full bg-[#2563eb]/5 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <LogoMark className="min-w-0" />
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/admin"
              className="hidden text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline md:inline"
            >
              Painel administrativo
            </Link>
            <WAButton>Falar no WhatsApp</WAButton>
          </div>
        </div>
      </header>

      <main className="w-full pb-32 pt-8 sm:pb-28 sm:pt-12">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div className="min-w-0 space-y-5">
              <p className="inline-flex max-w-full items-center rounded-full border border-blue-200 bg-blue-50/90 px-3 py-1.5 text-xs font-medium text-blue-800 sm:text-sm">
                Vendas + WhatsApp + Catálogo online
              </p>
              <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[2.6rem] lg:leading-[1.12]">
                SaaSPlatform —{" "}
                <span className="bg-gradient-to-r from-[#2563eb] to-[#475569] bg-clip-text text-transparent">
                  Módulo de Vendas e Catálogo
                </span>
              </h1>
              <div className="space-y-3 text-base leading-relaxed text-slate-600 sm:text-lg">
                <p>
                  Nosso sistema SaaS foi desenvolvido para empresas que desejam
                  vender de forma prática e moderna.
                </p>
                <p>Com o módulo de vendas integrado ao WhatsApp, você pode:</p>
                <ul className="list-disc space-y-2 pl-5 marker:text-[#2563eb]">
                  <li>
                    Criar e gerenciar seu catálogo online em poucos minutos.
                  </li>
                  <li>
                    Receber pedidos diretamente pelo WhatsApp, com checkout
                    simplificado.
                  </li>
                  <li>
                    Manter sua loja funcionando 24 horas por dia, sem
                    interrupções.
                  </li>
                  <li>
                    Personalizar categorias e produtos conforme a necessidade
                    do seu negócio.
                  </li>
                </ul>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                <a
                  href={DEMO_STORE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border-2 border-[#2563eb] bg-white px-5 py-2.5 text-center text-sm font-semibold text-[#2563eb] shadow-sm transition hover:bg-blue-50 sm:px-6 sm:py-3 sm:text-base"
                >
                  Veja uma loja funcionando
                </a>
                <WAButton className="sm:min-w-[188px]">
                  Falar no WhatsApp
                </WAButton>
              </div>
            </div>

            <div className="relative w-full min-w-0 lg:pl-2">
              <div
                className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#2563eb]/18 to-slate-300/25 opacity-70 blur-2xl sm:-inset-4"
                aria-hidden
              />
              <figure className="relative w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-200/60">
                <LandingImage
                  paths={IMG.apresentacao}
                  alt="Apresentação do SaaSPlatform e do módulo de vendas"
                  priority
                  className="h-auto w-full object-cover object-center"
                />
              </figure>
            </div>
          </div>
        </section>

        <section
          id="planos"
          className="mt-16 border-y border-slate-200/90 bg-white/70 py-14 sm:mt-24 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              emoji="📦"
              title="Planos disponíveis"
              subtitle="Escolha o ritmo do seu crescimento"
            />
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
              <div className="order-2 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-md sm:p-6 lg:order-1">
                <LandingImage
                  paths={IMG.planos}
                  alt="Planos e investimento"
                  className="h-auto w-full rounded-xl object-cover"
                />
              </div>
              <div className="order-1 space-y-5 lg:order-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                      Plano Semestral
                    </h3>
                    <p className="text-2xl font-bold text-[#2563eb]">R$ 180,00</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 sm:text-base">
                    Ideal para quem deseja testar e validar o sistema em curto
                    prazo.
                  </p>
                </div>
                <div className="relative rounded-2xl border-2 border-[#2563eb] bg-gradient-to-br from-blue-50/95 to-white p-6 shadow-lg sm:p-8">
                  <span className="absolute right-3 top-3 rounded-full bg-[#2563eb] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white sm:right-4 sm:top-4 sm:text-xs">
                    Melhor valor
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-3 pt-1">
                    <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                      Plano Anual
                    </h3>
                    <p className="text-2xl font-bold text-[#2563eb]">
                      R$ 150,00
                      <span className="text-sm font-normal text-slate-500">
                        {" "}
                        / mês
                      </span>
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 sm:text-base">
                    Melhor custo-benefício, garantindo suporte contínuo e
                    estabilidade durante todo o ano.
                  </p>
                </div>
                <div className="flex justify-center lg:justify-start">
                  <WAButton className="min-w-[200px] px-6 py-3 text-base">
                    Contratar agora
                  </WAButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <SectionTitle
            emoji="🎯"
            title="Benefícios inclusos"
            subtitle="Tudo o que você precisa para operar com tranquilidade"
          />
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center">
            <ul className="min-w-0 space-y-4 text-base text-slate-700 sm:text-lg">
              <li className="flex gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
                  ✓
                </span>
                <span>
                  Ao contratar qualquer plano, você terá acesso a suporte
                  dedicado para tirar dúvidas e resolver problemas.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
                  ✓
                </span>
                <span>Treinamento personalizado para dominar o sistema.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
                  ✓
                </span>
                <span>
                  Acompanhamento individual para atender necessidades especiais.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm text-white">
                  ✓
                </span>
                <span>
                  Garantia de catálogo sempre online e funcionando sem falhas.
                </span>
              </li>
            </ul>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <LandingImage
                paths={IMG.beneficios}
                alt="Suporte e treinamento"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200/90 bg-slate-50 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionTitle
              emoji="🛠️"
              title="Módulo de Vendas"
              subtitle="O coração do seu catálogo e dos pedidos pelo WhatsApp"
            />
            <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div className="order-2 min-w-0 space-y-4 text-base text-slate-700 sm:text-lg lg:order-1">
                <p>O módulo de vendas é o coração do sistema. Ele permite:</p>
                <ul className="list-disc space-y-2.5 pl-5 marker:text-[#2563eb]">
                  <li>Adicionar e editar produtos com facilidade.</li>
                  <li>Definir preços e promoções.</li>
                  <li>
                    Organizar categorias como Perfumes, Relógios, Roupas ou
                    qualquer outra.
                  </li>
                  <li>
                    Acompanhar pedidos e status em tempo real no painel
                    administrativo.
                  </li>
                </ul>
                <a
                  href={DEMO_STORE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex font-semibold text-[#2563eb] underline-offset-4 hover:underline"
                >
                  Abrir loja de demonstração →
                </a>
              </div>
              <div className="order-1 w-full min-w-0 lg:order-2">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-200/50">
                  <LandingImage
                    paths={IMG.painel}
                    alt="Painel de vendas e pedidos pelo WhatsApp"
                    className="h-auto w-full object-cover object-top"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-white/95 pb-28 pt-10 backdrop-blur-sm sm:pb-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:items-start sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <LogoMark />
            <div>
              <p className="font-medium text-slate-800">
                SaaSPlatform — Soluções sob medida para o seu negócio.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                © 2026 Todos os direitos reservados.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            Acesso ao painel
          </Link>
        </div>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-700/20 bg-[#25D366] px-3 py-2.5 shadow-[0_-6px_24px_rgba(0,0,0,0.1)] backdrop-blur-[2px] sm:px-4 sm:py-3 supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg justify-center">
          <WAButton className="w-full max-w-md sm:w-auto">Falar no WhatsApp</WAButton>
        </div>
      </div>
    </div>
  );
}
