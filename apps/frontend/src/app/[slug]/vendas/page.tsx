// =============================================================================
// src/app/[slug]/vendas/page.tsx â€” Vitrine PÃºblica (design profissional)
// =============================================================================

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  ShoppingCart,
  Store,
  Truck,
  Shield,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { CategoryRow } from "@/modules/vendas/components/CategoryRow";
import { CartDrawer } from "@/modules/vendas/components/CartDrawer";
import { FakeChatWidget } from "@/modules/vendas/components/FakeChatWidget";
import { useCart } from "@/modules/vendas/hooks/useCart";
import {
  listProdutosCatalogo,
  getVendasConfig,
} from "@/services/vendas.service";
import type { ProdutoVenda } from "@/types/vendas.types";
import { CATEGORIAS_LABEL } from "@/types/vendas.types";

// Ordem das categorias â€” LanÃ§amentos SEMPRE primeiro
const ORDEM_CATEGORIAS = [
  "lancamentos",
  "mais-vendidos",
  "promocoes",
  "eletronicos",
  "vestuario",
  "acessorios",
  "servicos",
];

// =============================================================================
// Paleta de cores gerada da logo via Canvas API (WCAG-aware)
// =============================================================================
interface Paleta {
  primaria: string;
  secundaria: string;
  clara: string; // tint suave para fundos de seÃ§Ã£o
  escura: string; // shade para hover/botÃµes
  textoBranco: boolean; // contraste adequado para texto branco sobre primaria
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function luminanciaRelativa(r: number, g: number, b: number): number {
  return [r, g, b]
    .map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    })
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
}

function misturarComBranco(hex: string, intensidade: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * (1 - intensidade)),
    Math.round(g + (255 - g) * (1 - intensidade)),
    Math.round(b + (255 - b) * (1 - intensidade)),
  );
}

function escurecerCor(hex: string, fator = 0.7): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.round(r * fator),
    Math.round(g * fator),
    Math.round(b * fator),
  );
}

function paletaDefault(): Paleta {
  return {
    primaria: "#4f46e5",
    secundaria: "#7c3aed",
    clara: "#eef2ff",
    escura: "#3730a3",
    textoBranco: true,
  };
}

function gerarPaleta(imageUrl: string): Promise<Paleta> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(paletaDefault());
          return;
        }
        canvas.width = 80;
        canvas.height = 80;
        ctx.drawImage(img, 0, 0, 80, 80);
        const { data } = ctx.getImageData(0, 0, 80, 80);
        const mapa = new Map<string, number>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = Math.round(data[i] / 32) * 32;
          const g = Math.round(data[i + 1] / 32) * 32;
          const b = Math.round(data[i + 2] / 32) * 32;
          // Descarta acromÃ¡ticos (cinzas, branco, preto puro)
          if (Math.max(r, g, b) - Math.min(r, g, b) < 40) continue;
          if (r > 215 && g > 215 && b > 215) continue;
          if (r < 35 && g < 35 && b < 35) continue;
          const key = `${r},${g},${b}`;
          mapa.set(key, (mapa.get(key) ?? 0) + 1);
        }
        if (mapa.size === 0) {
          resolve(paletaDefault());
          return;
        }
        let maxCount = 0;
        let dominante = "79,70,229";
        for (const [key, count] of mapa) {
          if (count > maxCount) {
            maxCount = count;
            dominante = key;
          }
        }
        const [r, g, b] = dominante.split(",").map(Number);
        const primaria = rgbToHex(r, g, b);
        const lum = luminanciaRelativa(r, g, b);
        resolve({
          primaria,
          secundaria: escurecerCor(primaria, 0.72),
          clara: misturarComBranco(primaria, 0.15),
          escura: escurecerCor(primaria, 0.58),
          textoBranco: lum < 0.35,
        });
      } catch {
        resolve(paletaDefault());
      }
    };
    img.onerror = () => resolve(paletaDefault());
    img.src = imageUrl;
  });
}

function resolveLogoUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}${url}`;
}

export default function VendasPage() {
  const params = useParams<{ slug: string }>();
  const [produtos, setProdutos] = useState<ProdutoVenda[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [nomeLoja, setNomeLoja] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [paleta, setPaleta] = useState<Paleta>(paletaDefault());
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [ordemCategorias, setOrdemCategorias] =
    useState<string[]>(ORDEM_CATEGORIAS);
  const categoriaRefs = useRef<Record<string, HTMLElement | null>>({});

  const {
    itens,
    totalItens,
    totalValor,
    adicionarItem,
    removerItem,
    atualizarQuantidade,
    limparCarrinho,
    isOpen: isCartOpen,
    setIsOpen: setIsCartOpen,
  } = useCart();

  // Carrega produtos
  useEffect(() => {
    listProdutosCatalogo({ limit: 200, slug: params.slug })
      .then((res) => setProdutos(res.data))
      .catch((err) =>
        console.error("[VendasPage] Erro ao carregar produtos:", err),
      )
      .finally(() => setIsLoading(false));
  }, [params.slug]);

  // Carrega configuraÃ§Ãµes da loja
  useEffect(() => {
    getVendasConfig(params.slug)
      .then((cfg) => {
        if (cfg.whatsapp_number) setWhatsappNumber(cfg.whatsapp_number);
        setNomeLoja(cfg.nome_loja || cfg.tenant_name || params.slug);
        if (cfg.logo_url) setLogoUrl(cfg.logo_url);
        if (cfg.categorias && cfg.categorias.length > 0) {
          setOrdemCategorias(cfg.categorias);
        }
      })
      .catch(() => setNomeLoja(params.slug));
  }, [params.slug]);

  // Extrai paleta de cores da logo
  useEffect(() => {
    if (!logoUrl) return;
    const fullUrl = resolveLogoUrl(logoUrl);
    if (!fullUrl) return;
    gerarPaleta(fullUrl).then(setPaleta);
  }, [logoUrl]);

  // Agrupa produtos por categoria (memoizado)
  const produtosPorCategoria = useMemo(() => {
    const textoBusca = busca.toLowerCase().trim();
    const filtrados = textoBusca
      ? produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(textoBusca) ||
            p.descricao?.toLowerCase().includes(textoBusca),
        )
      : produtos;

    const mapa = new Map<string, ProdutoVenda[]>();
    for (const cat of ordemCategorias) {
      const grupo = filtrados.filter((p) => p.categoria === cat);
      if (grupo.length > 0) mapa.set(cat, grupo);
    }
    for (const p of filtrados) {
      if (!ordemCategorias.includes(p.categoria)) {
        const atual = mapa.get(p.categoria) ?? [];
        mapa.set(p.categoria, [...atual, p]);
      }
    }
    return mapa;
  }, [produtos, busca, ordemCategorias]);

  const categoriasDisponiveis = Array.from(produtosPorCategoria.keys());
  const semResultados = busca.length > 0 && produtosPorCategoria.size === 0;
  const logoFullUrl = resolveLogoUrl(logoUrl);

  const scrollParaCategoria = (cat: string) => {
    setCategoriaAtiva(cat);
    categoriaRefs.current[cat]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      {/* ===================================================================
          HEADER sticky â€” glass morphism
      =================================================================== */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Logo + Nome */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {logoFullUrl ? (
              <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 shadow-sm flex-shrink-0">
                <Image
                  src={logoFullUrl}
                  alt={nomeLoja}
                  fill
                  className="object-contain"
                  sizes="36px"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl shadow-sm flex-shrink-0"
                style={{ backgroundColor: paleta.primaria }}
              >
                <Store className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="font-bold text-gray-900 text-lg tracking-tight hidden sm:block">
              {nomeLoja || params.slug}
            </span>
          </div>

          {/* Barra de busca */}
          <div className="flex-1 max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-transparent rounded-full focus:outline-none focus:bg-white focus:border-gray-300 transition-all"
              />
            </div>
          </div>

          {/* BotÃ£o do Carrinho */}
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label={`Carrinho (${totalItens} itens)`}
            className="relative flex items-center justify-center p-2.5 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ShoppingCart className="w-5 h-5 text-gray-700" />
            {totalItens > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none"
                style={{ backgroundColor: paleta.primaria }}
              >
                {totalItens > 99 ? "99+" : totalItens}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ===================================================================
          HERO BANNER â€” gradiente gerado da logo do cliente
      =================================================================== */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${paleta.primaria} 0%, ${paleta.secundaria} 100%)`,
        }}
      >
        {/* PadrÃ£o de pontos decorativo */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-16 flex flex-col items-center text-center">
          {/* Logo grande no hero */}
          {logoFullUrl ? (
            <div className="relative w-28 h-28 rounded-3xl bg-white/20 border-2 border-white/40 shadow-2xl mb-6 overflow-hidden backdrop-blur-sm">
              <Image
                src={logoFullUrl}
                alt={nomeLoja}
                fill
                className="object-contain p-3"
                sizes="112px"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-3xl bg-white/20 border-2 border-white/40 shadow-2xl mb-6 flex items-center justify-center">
              <Store className="w-14 h-14 text-white/80" />
            </div>
          )}

          {/* Selo "Loja Oficial" */}
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-white/80" />
            <span className="text-white/80 text-xs font-semibold uppercase tracking-widest">
              Loja Oficial
            </span>
            <Sparkles className="w-4 h-4 text-white/80" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 drop-shadow-sm">
            {nomeLoja || "Nossa Loja"}
          </h1>
          <p className="text-white/85 text-base sm:text-lg mb-8 max-w-md leading-relaxed">
            Os melhores produtos com preÃ§os incrÃ­veis.
            <br className="hidden sm:block" />
            Compre agora e finalize pelo WhatsApp!
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: Truck, label: "Entrega RÃ¡pida" },
              { icon: Shield, label: "Compra Segura" },
              { icon: MessageCircle, label: "Atendimento no WhatsApp" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm font-medium border border-white/20"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Curva decorativa de transiÃ§Ã£o para o conteÃºdo */}
        <div
          className="h-10 bg-gray-50"
          style={{
            borderRadius: "60% 60% 0 0 / 100% 100% 0 0",
            transform: "scaleX(1.6)",
          }}
        />
      </section>

      {/* ===================================================================
          NAVEGAÃ‡ÃƒO POR CATEGORIA (pills)
      =================================================================== */}
      {!isLoading && categoriasDisponiveis.length > 1 && !busca && (
        <nav className="sticky top-16 z-20 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div
              className="flex gap-2 py-3 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {categoriasDisponiveis.map((cat) => {
                const isAtiva = categoriaAtiva === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => scrollParaCategoria(cat)}
                    className="flex-shrink-0 px-4 py-1.5 text-sm font-semibold rounded-full border-2 transition-all duration-200 whitespace-nowrap"
                    style={
                      isAtiva
                        ? {
                            backgroundColor: paleta.primaria,
                            borderColor: paleta.primaria,
                            color: paleta.textoBranco ? "white" : "#111",
                          }
                        : {
                            backgroundColor: "transparent",
                            borderColor: "#e5e7eb",
                            color: "#6b7280",
                          }
                    }
                  >
                    {CATEGORIAS_LABEL[cat] ?? cat}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* ===================================================================
          CONTEÃšDO PRINCIPAL
      =================================================================== */}
      <main className="pb-16">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div
              className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin"
              style={{
                borderColor: `${paleta.primaria} transparent transparent transparent`,
              }}
            />
            <p className="text-gray-500 text-sm">Carregando produtos...</p>
          </div>
        )}

        {/* Sem resultados de busca */}
        {semResultados && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ backgroundColor: paleta.clara }}
            >
              <Search
                className="w-10 h-10"
                style={{ color: paleta.primaria }}
              />
            </div>
            <p className="text-gray-700 font-semibold text-xl">
              Nenhum produto encontrado
            </p>
            <p className="text-gray-400 text-sm">
              NÃ£o achamos nada para &ldquo;{busca}&rdquo;
            </p>
            <button
              onClick={() => setBusca("")}
              className="mt-1 text-sm font-semibold hover:underline"
              style={{ color: paleta.primaria }}
            >
              â† Voltar ao catÃ¡logo
            </button>
          </div>
        )}

        {/* Fileiras de categorias */}
        {!isLoading && !semResultados && (
          <div className="divide-y divide-gray-100">
            {Array.from(produtosPorCategoria.entries()).map(
              ([categoria, produtosDaCategoria]) => (
                <div
                  key={categoria}
                  ref={(el) => {
                    categoriaRefs.current[categoria] = el;
                  }}
                >
                  <CategoryRow
                    categoria={categoria}
                    produtos={produtosDaCategoria}
                    whatsappNumber={whatsappNumber}
                    onAdicionarCarrinho={adicionarItem}
                    corPrimaria={paleta.primaria}
                    corClara={paleta.clara}
                  />
                </div>
              ),
            )}
          </div>
        )}

        {/* CatÃ¡logo vazio */}
        {!isLoading && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ backgroundColor: paleta.clara }}
            >
              <ShoppingCart
                className="w-12 h-12"
                style={{ color: paleta.primaria }}
              />
            </div>
            <p className="text-gray-700 font-semibold text-xl">
              Nenhum produto disponÃ­vel ainda
            </p>
            <p className="text-gray-400 text-sm">
              Em breve novidades por aqui!
            </p>
          </div>
        )}
      </main>

      {/* ===================================================================
          FOOTER
      =================================================================== */}
      <footer className="border-t border-gray-100 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-4 text-center">
          {logoFullUrl && (
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <Image
                src={logoFullUrl}
                alt={nomeLoja}
                fill
                className="object-contain"
                sizes="56px"
                unoptimized
              />
            </div>
          )}
          <p className="font-bold text-gray-800 text-lg">
            {nomeLoja || params.slug}
          </p>
          <p className="text-sm text-gray-400 max-w-xs">
            Compras seguras e cÃ³modas via WhatsApp.
            <br />
            Atendimento rÃ¡pido e confiÃ¡vel!
          </p>
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("OlÃ¡! Preciso de ajuda com um pedido.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-md hover:shadow-lg"
            >
              <MessageCircle className="w-4 h-4" />
              Falar no WhatsApp
            </a>
          )}
          <p className="text-xs text-gray-300 mt-2">
            Â© {new Date().getFullYear()} {nomeLoja} â€” Todos os direitos
            reservados
          </p>
        </div>
      </footer>

      {/* ===== CARRINHO LATERAL ===== */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        itens={itens}
        totalValor={totalValor}
        whatsappNumber={whatsappNumber}
        slug={params.slug}
        onAtualizarQuantidade={atualizarQuantidade}
        onRemoverItem={removerItem}
        onLimparCarrinho={limparCarrinho}
        corPrimaria={paleta.primaria}
      />

      {/* ===== CHAT WIDGET ===== */}
      <FakeChatWidget
        whatsappNumber={whatsappNumber}
        corPrimaria={paleta.primaria}
        nomeLoja={nomeLoja}
      />
    </>
  );
}
