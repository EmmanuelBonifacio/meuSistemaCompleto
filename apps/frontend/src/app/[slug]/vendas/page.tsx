// =============================================================================
// src/app/[slug]/vendas/page.tsx
// =============================================================================
// O QUE FAZ:
//   Página pública do catálogo de vendas — a "vitrine" da loja.
//   Exibe produtos organizados em fileiras horizontais por categoria.
//   A primeira fileira é sempre "Lançamentos".
//   Inclui header com logo + busca + ícone do carrinho, e o chat fake.
//
// FLUXO COMPLETO:
//   1. Página carrega os produtos via GET /vendas/produtos (público)
//   2. Renderiza uma fileira por categoria (CategoryRow)
//   3. Visitante clica "Adicionar ao Carrinho" → useCart adiciona ao drawer
//   4. Visitante abre o carrinho e clica "Finalizar no WhatsApp"
//   5. Link wa.me abre, pedido é registrado no backend silenciosamente
// =============================================================================

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, ShoppingCart, Store } from "lucide-react";
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

// Ordem das categorias — Lançamentos SEMPRE primeiro
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
// Extrai a cor dominante de uma imagem usando a Canvas API do browser.
// Ignora pixels brancos, pretos e transparentes para focar na cor da marca.
// Retorna uma cor hex (ex: "#e53e3e"). Fallback: indigo-600.
// =============================================================================
function extrairCorDominante(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("#4f46e5");
          return;
        }
        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);
        const { data } = ctx.getImageData(0, 0, 64, 64);
        const mapa = new Map<string, number>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue; // transparente
          const r = Math.round(data[i] / 40) * 40;
          const g = Math.round(data[i + 1] / 40) * 40;
          const b = Math.round(data[i + 2] / 40) * 40;
          if (r > 210 && g > 210 && b > 210) continue; // branco
          if (r < 40 && g < 40 && b < 40) continue; // preto
          const key = `${r},${g},${b}`;
          mapa.set(key, (mapa.get(key) ?? 0) + 1);
        }
        if (mapa.size === 0) {
          resolve("#4f46e5");
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
        resolve(
          `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
        );
      } catch {
        resolve("#4f46e5");
      }
    };
    img.onerror = () => resolve("#4f46e5");
    img.src = imageUrl;
  });
}

// Escurece uma cor hex em `fator` (ex: 0.7 = 30% mais escura)
function escurecerCor(hex: string, fator = 0.7): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * fator);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * fator);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * fator);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export default function VendasPage() {
  const params = useParams<{ slug: string }>();
  const [produtos, setProdutos] = useState<ProdutoVenda[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [nomeLoja, setNomeLoja] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [corPrimaria, setCorPrimaria] = useState("#4f46e5");
  const [corSecundaria, setCorSecundaria] = useState("#7c3aed");
  const logoImgRef = useRef<HTMLImageElement | null>(null);

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

  // -------------------------------------------------------------------------
  // Carrega os produtos do catálogo ao montar a página
  // -------------------------------------------------------------------------
  useEffect(() => {
    listProdutosCatalogo({ limit: 200, slug: params.slug })
      .then((res) => setProdutos(res.data))
      .catch((err) =>
        console.error("[VendasPage] Erro ao carregar produtos:", err),
      )
      .finally(() => setIsLoading(false));
  }, []);

  // Carrega as configurações da loja (whatsapp, nome, logo)
  useEffect(() => {
    getVendasConfig(params.slug)
      .then((cfg) => {
        if (cfg.whatsapp_number) setWhatsappNumber(cfg.whatsapp_number);
        setNomeLoja(cfg.nome_loja || cfg.tenant_name || params.slug);
        if (cfg.logo_url) setLogoUrl(cfg.logo_url);
      })
      .catch(() => {
        setNomeLoja(params.slug);
      });
  }, [params.slug]);

  // Extrai cor dominante da logo quando ela carrega
  useEffect(() => {
    if (!logoUrl) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
    const fullUrl = logoUrl.startsWith("http")
      ? logoUrl
      : `${apiBase}${logoUrl}`;
    extrairCorDominante(fullUrl).then((cor) => {
      setCorPrimaria(cor);
      setCorSecundaria(escurecerCor(cor, 0.72));
    });
  }, [logoUrl]);

  // -------------------------------------------------------------------------
  // Filtra produtos pela busca e agrupa por categoria (memoizado)
  // -------------------------------------------------------------------------
  const produtosPorCategoria = useMemo(() => {
    const textoBusca = busca.toLowerCase().trim();

    const filtrados = textoBusca
      ? produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(textoBusca) ||
            p.descricao?.toLowerCase().includes(textoBusca),
        )
      : produtos;

    // Agrupa em um Map: categoria → [produtos]
    const mapa = new Map<string, ProdutoVenda[]>();

    for (const categoria of ORDEM_CATEGORIAS) {
      const grupo = filtrados.filter((p) => p.categoria === categoria);
      if (grupo.length > 0) {
        mapa.set(categoria, grupo);
      }
    }

    // Categorias não mapeadas em ORDEM_CATEGORIAS vão pro final
    for (const produto of filtrados) {
      if (!ORDEM_CATEGORIAS.includes(produto.categoria)) {
        const atual = mapa.get(produto.categoria) ?? [];
        mapa.set(produto.categoria, [...atual, produto]);
      }
    }

    return mapa;
  }, [produtos, busca]);

  const semResultados = busca && produtosPorCategoria.size === 0;

  return (
    <>
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Logo / Nome da Loja */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {logoUrl ? (
              <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                <Image
                  ref={logoImgRef as React.Ref<HTMLImageElement>}
                  src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}${logoUrl}`}
                  alt={nomeLoja}
                  fill
                  className="object-contain"
                  sizes="32px"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg"
                style={{ backgroundColor: corPrimaria }}
              >
                <Store className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              {nomeLoja || params.slug}
            </span>
          </div>

          {/* Barra de Busca */}
          <div className="flex-1 max-w-lg mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-200 transition-all"
              />
            </div>
          </div>

          {/* Ícone do Carrinho */}
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label={`Abrir carrinho (${totalItens} ${totalItens === 1 ? "item" : "itens"})`}
            className="relative flex items-center justify-center p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ShoppingCart className="w-5 h-5 text-gray-700" />
            {totalItens > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 text-white text-xs font-bold rounded-full flex items-center justify-center"
                style={{ backgroundColor: corPrimaria }}
              >
                {totalItens > 99 ? "99+" : totalItens}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ===== CONTEÚDO PRINCIPAL ===== */}
      <main>
        {/* Hero Banner — cor dinâmica baseada na logo */}
        <div
          className="text-white py-12 px-4 text-center"
          style={{
            background: `linear-gradient(135deg, ${corPrimaria}, ${corSecundaria})`,
          }}
        >
          {logoUrl && (
            <div className="flex justify-center mb-4">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white/20 border border-white/30">
                <Image
                  src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}${logoUrl}`}
                  alt={nomeLoja}
                  fill
                  className="object-contain p-1"
                  sizes="80px"
                  unoptimized
                />
              </div>
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {nomeLoja
              ? `Bem-vindo à ${nomeLoja}! 🛍️`
              : "Bem-vindo à nossa loja! 🛍️"}
          </h1>
          <p className="text-white/80 text-lg">
            Encontre os melhores produtos e finalize pelo WhatsApp
          </p>
        </div>

        {/* Estado de carregamento */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{
                borderColor: `${corPrimaria} transparent transparent transparent`,
              }}
            />
            <p className="text-gray-500 text-sm">Carregando produtos...</p>
          </div>
        )}

        {/* Sem resultados de busca */}
        {semResultados && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
            <Search className="w-12 h-12 text-gray-200" />
            <p className="text-gray-600 font-medium">
              Nenhum produto encontrado para &quot;{busca}&quot;
            </p>
            <button
              onClick={() => setBusca("")}
              className="text-sm hover:underline"
              style={{ color: corPrimaria }}
            >
              Limpar busca
            </button>
          </div>
        )}

        {/* Fileiras de Categorias */}
        {!isLoading && !semResultados && (
          <div className="divide-y divide-gray-100">
            {Array.from(produtosPorCategoria.entries()).map(
              ([categoria, produtosDaCategoria]) => (
                <CategoryRow
                  key={categoria}
                  categoria={categoria}
                  produtos={produtosDaCategoria}
                  whatsappNumber={whatsappNumber}
                  onAdicionarCarrinho={adicionarItem}
                />
              ),
            )}
          </div>
        )}

        {/* Estado vazio (sem produtos cadastrados) */}
        {!isLoading && produtos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
            <ShoppingCart className="w-16 h-16 text-gray-200" />
            <p className="text-gray-600 font-medium text-lg">
              Nenhum produto disponível ainda
            </p>
            <p className="text-gray-400 text-sm">
              Em breve novidades por aqui!
            </p>
          </div>
        )}
      </main>

      {/* ===== FOOTER SIMPLES ===== */}
      <footer className="py-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-8">
        <p>Pagamentos e entregas via WhatsApp • {nomeLoja || params.slug}</p>
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
      />

      {/* ===== CHAT FAKE ===== */}
      <FakeChatWidget whatsappNumber={whatsappNumber} />
    </>
  );
}
