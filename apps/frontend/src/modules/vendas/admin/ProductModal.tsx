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
import { X, Upload, Loader2, ImageIcon } from "lucide-react";
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
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
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
  produto?: ProdutoVenda | null; // null = modo criação, objeto = modo edição
  onSalvo: (produto: ProdutoVenda) => void;
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
};

// =============================================================================
// COMPONENTE: ProductModal
// =============================================================================
export function ProductModal({
  isOpen,
  onClose,
  produto,
  onSalvo,
}: ProductModalProps) {
  const [form, setForm] = useState<ProdutoVendaInput>(FORM_INICIAL);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const isModoEdicao = !!produto;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
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

          {/* Preços (linha dupla) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="preco"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Preço (R$) <span className="text-red-500">*</span>
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
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                required
              />
            </div>
            <div>
              <label
                htmlFor="preco_promo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Preço Promo (R$)
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
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
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
              {Object.entries(CATEGORIAS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ativo: e.target.checked }))
                }
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-sm font-medium text-gray-700">
                Produto ativo
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
