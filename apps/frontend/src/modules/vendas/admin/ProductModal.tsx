// =============================================================================
// src/modules/vendas/admin/ProductModal.tsx
// =============================================================================
// O QUE FAZ:
//   Modal para adicionar ou editar produto de venda.
//   Ao receber uma `produto` via prop, entra em modo edição (campos preenchidos).
//   Ao não receber, entra em modo criação (campos vazios).
//
// FUNCIONALIDADES:
//   - Campos: nome, preço, preço promocional, categoria, descrição, ativo, destaque
//   - Upload de foto: preview imediato com FileReader + envio ao backend
//   - Validação básica no frontend antes de enviar
// =============================================================================

"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, Loader2, ImageIcon, AlertTriangle } from "lucide-react";
import Image from "next/image";
import type {
  ProdutoVenda,
  ProdutoVendaInput,
  CategoriaVenda,
} from "@/types/vendas.types";

// Raiz do backend — imagens são servidas por ele, não pelo frontend
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Constrói a URL completa para imagens armazenadas como caminhos relativos
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
    return url;
  return `${API_BASE}${url}`;
}
import { CATEGORIAS_LABEL } from "@/types/vendas.types";
import {
  createProduto,
  updateProduto,
  uploadFotoProduto,
} from "@/services/vendas.service";

// =============================================================================
// PROPS
// =============================================================================
interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto?: ProdutoVenda | null;
  onSalvo: (produto: ProdutoVenda) => void;
  categorias?: string[]; // categorias personalizadas do tenant
}

// Estado inicial do formulário
const FORM_INICIAL: ProdutoVendaInput = {
  nome: "",
  descricao: "",
  preco: 0,
  preco_promocional: null,
  categoria: "lancamentos",
  ativo: true,
  destaque: false,
  ordem: 0,
  vendido_por_peso: false,
};

// =============================================================================
// COMPONENTE: ProductModal
// =============================================================================
export function ProductModal({
  isOpen,
  onClose,
  produto,
  onSalvo,
  categorias,
}: ProductModalProps) {
  const [form, setForm] = useState<ProdutoVendaInput>(FORM_INICIAL);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const isModoEdicao = !!produto;

  // Lista de categorias válidas do tenant (ou fallback nas categorias padrão)
  const categoriasValidas =
    categorias && categorias.length > 0
      ? categorias
      : Object.keys(CATEGORIAS_LABEL);

  // Verdadeiro quando o produto tem uma categoria que não existe mais na config
  const categoriaInvalida = !categoriasValidas.includes(form.categoria);

  // Preenche o formulário quando em modo edição
  useEffect(() => {
    if (produto) {
      setForm({
        nome: produto.nome,
        descricao: produto.descricao ?? "",
        preco: produto.preco,
        preco_promocional: produto.preco_promocional ?? null,
        categoria: produto.categoria,
        ativo: produto.ativo,
        destaque: produto.destaque,
        ordem: produto.ordem,
        vendido_por_peso: produto.vendido_por_peso ?? false,
      });
      // Resolve a URL para exibição correta — URLs relativas precisam do prefixo do backend
      setFotoPreview(resolveImageUrl(produto.foto_url));
    } else {
      setForm(FORM_INICIAL);
      setFotoPreview(null);
    }
    setFotoArquivo(null);
    setErro(null);
  }, [produto, isOpen]);

  // -------------------------------------------------------------------------
  // Preview de foto ao selecionar arquivo
  // -------------------------------------------------------------------------
  const handleSelecaoFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    // Validação de tipo
    if (!arquivo.type.startsWith("image/")) {
      setErro("Apenas imagens são permitidas (jpg, png, webp, gif).");
      return;
    }

    setFotoArquivo(arquivo);

    // Gera preview local imediatamente (sem upload ainda)
    const reader = new FileReader();
    reader.onloadend = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(arquivo);
  };

  // -------------------------------------------------------------------------
  // Submit do formulário
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!form.nome.trim()) {
      setErro("Nome do produto é obrigatório.");
      return;
    }
    if (form.preco < 0) {
      setErro("Preço não pode ser negativo.");
      return;
    }
    // Trava de segurança: não permite ativar um produto sem categoria válida
    if (form.ativo && categoriaInvalida) {
      setErro(
        "Selecione uma categoria válida antes de ativar o produto.",
      );
      return;
    }

    setIsLoading(true);
    try {
      let produtoSalvo: ProdutoVenda;

      if (isModoEdicao && produto) {
        // Modo edição — PATCH
        const { produto: atualizado } = await updateProduto(produto.id, form);
        produtoSalvo = atualizado;
      } else {
        // Modo criação — POST
        const { produto: criado } = await createProduto(form);
        produtoSalvo = criado;
      }

      // Se selecionou uma nova foto, faz upload após salvar o produto
      if (fotoArquivo) {
        const { produto: comFoto } = await uploadFotoProduto(
          produtoSalvo.id,
          fotoArquivo,
        );
        produtoSalvo = comFoto;
      }

      onSalvo(produtoSalvo);
      onClose();
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao salvar produto.";
      setErro(mensagem);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal: max-h com dvh evita corte com barra do Safari; padding inferior respeita iPhone com notch */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[min(100dvh,100vh)] overflow-y-auto touch-manipulation">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {isModoEdicao ? "Editar Produto" : "Adicionar Produto"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Formulário */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-5 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
        >
          {/* Upload de Foto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto do Produto
            </label>
            <div
              onClick={() => inputFotoRef.current?.click()}
              className="relative w-full h-40 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors group"
            >
              {fotoPreview ? (
                <Image
                  src={fotoPreview}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="512px"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 group-hover:text-indigo-500 transition-colors">
                  <ImageIcon className="w-10 h-10" />
                  <span className="text-sm">Clique para selecionar foto</span>
                </div>
              )}
              {/* Overlay de hover para trocar foto */}
              {fotoPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white" />
                </div>
              )}
            </div>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleSelecaoFoto}
              className="hidden"
            />
          </div>

          {/* Nome */}
          <div>
            <label
              htmlFor="nome"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              id="nome"
              type="text"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Camiseta Premium Preta"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label
              htmlFor="descricao"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Descrição
            </label>
            <textarea
              id="descricao"
              value={form.descricao ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, descricao: e.target.value }))
              }
              placeholder="Descreva o produto em detalhes..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Tipo de venda: destaque máximo (não depende de scroll lateral) */}
          <fieldset
            data-testid="venda-tipo-preco"
            className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 shadow-sm"
          >
            <legend className="px-1 text-sm font-bold text-indigo-900">
              Tipo de venda na loja
            </legend>
            <p className="mb-3 text-xs text-indigo-800/90">
              Define se o preço abaixo é por <strong>peça</strong> ou por{" "}
              <strong>1 kg</strong> (balança).
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                  !form.vendido_por_peso
                    ? "border-indigo-600 bg-white ring-1 ring-indigo-600"
                    : "border-gray-200 bg-white/80 hover:border-indigo-300"
                }`}
              >
                <input
                  name="tipo_venda_loja"
                  type="radio"
                  className="mt-1 h-4 w-4 text-indigo-600"
                  checked={!form.vendido_por_peso}
                  onChange={() =>
                    setForm((f) => ({ ...f, vendido_por_peso: false }))
                  }
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    Por unidade
                  </span>
                  <span className="text-xs text-gray-600">
                    Cliente escolhe quantas unidades.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
                  form.vendido_por_peso
                    ? "border-amber-600 bg-amber-50 ring-1 ring-amber-500"
                    : "border-gray-200 bg-white/80 hover:border-amber-300"
                }`}
              >
                <input
                  name="tipo_venda_loja"
                  type="radio"
                  className="mt-1 h-4 w-4 text-amber-600"
                  checked={!!form.vendido_por_peso}
                  onChange={() =>
                    setForm((f) => ({ ...f, vendido_por_peso: true }))
                  }
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    Por quilo (kg)
                  </span>
                  <span className="text-xs text-gray-600">
                    Preço = R$ por 1 kg na vitrine.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {/* Preços */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-800">
              {form.vendido_por_peso
                ? "Preços por quilograma (1 kg)"
                : "Preços por unidade"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="preco"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Preço (R$) <span className="text-red-500">*</span>
                  {form.vendido_por_peso && (
                    <span className="ml-1 text-xs font-semibold text-amber-800">
                      / kg
                    </span>
                  )}
                </label>
                <input
                  id="preco"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.preco}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      preco: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="preco_promo"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Preço Promo (R$)
                  {form.vendido_por_peso && (
                    <span className="ml-1 text-xs font-semibold text-amber-800">
                      / kg
                    </span>
                  )}
                </label>
                <input
                  id="preco_promo"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.preco_promocional ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      preco_promocional: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="Opcional"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label
              htmlFor="categoria"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Categoria <span className="text-red-500">*</span>
            </label>
            {categoriaInvalida && (
              <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                A categoria &quot;{form.categoria}&quot; foi removida. Selecione
                outra antes de ativar o produto.
              </div>
            )}
            <select
              id="categoria"
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  categoria: e.target.value as CategoriaVenda,
                }))
              }
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 bg-white"
              required
            >
              {/* Opção desabilitada exibindo a categoria inválida atual */}
              {categoriaInvalida && (
                <option value={form.categoria} disabled>
                  {form.categoria} (removida — selecione outra)
                </option>
              )}
              {/* Opção desabilitada exibindo a categoria inválida atual */}
              {categoriaInvalida && (
                <option value={form.categoria} disabled>
                  {form.categoria} (removida — selecione outra)
                </option>
              )}
              {categorias && categorias.length > 0
                ? categorias.map((cat) => (
                    <option key={cat} value={cat}>
                      {/* Usa label traduzido se existir, senão usa o nome direto */}
                      {CATEGORIAS_LABEL[cat] ?? cat}
                    </option>
                  ))
                : Object.entries(CATEGORIAS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label
              className={`flex items-center gap-2 ${
                categoriaInvalida ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
              title={
                categoriaInvalida
                  ? "Selecione uma categoria válida para ativar"
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={form.ativo}
                disabled={categoriaInvalida}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ativo: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-sm font-medium text-gray-700">
                Produto ativo
                {categoriaInvalida && (
                  <span className="ml-1 text-xs text-amber-600 font-normal">
                    (sem categoria válida)
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.destaque}
                onChange={(e) =>
                  setForm((f) => ({ ...f, destaque: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-sm font-medium text-gray-700">
                Destaque
              </span>
            </label>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
              {erro}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : isModoEdicao ? (
                "Salvar alterações"
              ) : (
                "Adicionar produto"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
