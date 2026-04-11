// =============================================================================
// src/lib/utils.ts
// =============================================================================
// O QUE FAZ:
//   Utilitários compartilhados em todo o projeto.
//
//   A função `cn` (classNames) é o utilitário mais usado de qualquer projeto
//   com Tailwind CSS. Ela resolve um problema específico: mesclar classes
//   Tailwind de forma inteligente, sem duplicatas ou conflitos.
//
// PROBLEMA QUE `cn` RESOLVE:
//   Suponha que você tem um botão com classe padrão `text-white` e quer
//   sobrescrevê-la com `text-black` via prop. Se você fizer:
//     `className={`text-white ${props.className}`}`
//   O resultado seria `text-white text-black` — CONFLITO! O browser aplica
//   a última, mas isso é frágil e baseado na ordem do CSS.
//
//   Com `cn('text-white', 'text-black')`, o tailwind-merge detecta que ambas
//   afetam a mesma propriedade CSS (`color`) e mantém apenas a última: `text-black`.
//
// COMO FUNCIONA:
//   1. `clsx` concatena arrays/objetos de classes condicionalmente
//   2. `twMerge` remove duplicatas e conflitos de classes Tailwind
//
// EXEMPLO DE USO:
//   cn('px-4 py-2', isActive && 'bg-blue-500', className)
//   cn('text-sm text-gray-500', 'text-base') → apenas 'text-base' (sem conflito!)
// =============================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário para mesclar classes Tailwind de forma segura.
 * Combina condicionais (clsx) com resolução de conflitos (tailwind-merge).
 * @param inputs - Classes CSS, objetos condicionais, ou arrays de classes
 * @returns String de classes CSS mescladas e sem conflitos
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// =============================================================================
// FORMATADORES DE DADOS
// =============================================================================
// Centralizamos a formatação aqui para garantir consistência:
// "R$ 1.234,56" sempre aparece igual em toda a aplicação.

/**
 * Formata um número como moeda brasileira (BRL).
 * @example formatCurrency(1234.56) → "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata uma data ISO string para o padrão brasileiro.
 * @example formatDate("2024-03-15T10:00:00Z") → "15/03/2024"
 */
export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoString));
}

/**
 * Formata uma data ISO string com hora.
 * @example formatDateTime("2024-03-15T10:30:00Z") → "15/03/2024, 10:30"
 */
export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

/**
 * Decodifica um JWT sem verificar a assinatura (para uso no frontend).
 *
 * ATENÇÃO DE SEGURANÇA:
 *   A VERIFICAÇÃO da assinatura SEMPRE deve acontecer no Backend.
 *   No frontend, decodificamos apenas para LEITURA dos dados (ex: exibir
 *   nome do usuário, verificar role para mostrar/ocultar UI).
 *   Um usuário malicioso poderia forjar um JWT decoded localmente, mas
 *   qualquer requisição real ao backend seria rejeitada pelo servidor.
 *
 * @returns O payload decodificado, ou null se o token for inválido
 */
export function decodeJwt<T = Record<string, unknown>>(
  token: string,
): T | null {
  try {
    // JWT tem 3 partes separadas por ponto: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // A segunda parte (índice 1) é o payload em Base64URL
    // Base64URL usa '-' e '_' em vez de '+' e '/' do Base64 padrão
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    // atob() decodifica Base64 para string
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );

    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}

/**
 * Verifica se um JWT está expirado comparando o campo `exp` com o tempo atual.
 * @returns true se expirado ou inválido, false se ainda válido
 */
export function isJwtExpired(token: string): boolean {
  const payload = decodeJwt<{ exp?: number }>(token);
  if (!payload?.exp) return true;
  // `exp` é em segundos (Unix timestamp), Date.now() em milissegundos
  return payload.exp * 1000 < Date.now();
}
