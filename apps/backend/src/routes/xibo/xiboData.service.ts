// =============================================================================
// src/routes/xibo/xiboData.service.ts
// =============================================================================
// Leitura de dados para feeds Xibo (catálogo + anúncios plataforma).
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import { findAllProdutosVenda } from "../../modules/vendas/vendas.repository";

export interface XiboProductRow {
  id: string;
  nome: string;
  preco: number;
  foto_url: string | null;
  descricao: string | null;
}

export interface XiboPlatformAdRow {
  id: string;
  titulo: string;
  video_url: string;
  duracao_segundos: number;
  thumb_url: string | null;
}

export function effectiveDisplayPreco(input: {
  preco: number;
  preco_promocional: number | null;
}): number {
  const promo = input.preco_promocional;
  if (promo != null && promo > 0) return promo;
  return input.preco;
}

export async function listXiboActiveProducts(
  schemaName: string,
): Promise<XiboProductRow[]> {
  const result = await findAllProdutosVenda(
    schemaName,
    {
      page: 1,
      limit: 500,
      busca: undefined,
      categoria: undefined,
      slug: undefined,
    },
    true,
  );

  return result.data.map((p) => ({
    id: p.id,
    nome: p.nome,
    preco: effectiveDisplayPreco({
      preco: p.preco,
      preco_promocional: p.preco_promocional,
    }),
    foto_url: p.foto_url,
    descricao: p.descricao,
  }));
}

export async function listXiboPlatformAds(
  schemaName: string,
): Promise<XiboPlatformAdRow[]> {
  return withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".xibo_platform_ads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo VARCHAR(255) NOT NULL,
        video_url TEXT NOT NULL,
        duracao_segundos INTEGER NOT NULL DEFAULT 30
          CONSTRAINT xibo_platform_ads_duration_check
          CHECK (duracao_segundos > 0 AND duracao_segundos <= 86400),
        thumb_url TEXT,
        ativo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_xibo_platform_ads_ativo
        ON "${schemaName}".xibo_platform_ads (ativo)
        WHERE ativo = true
    `);

    const rows = await tx.$queryRawUnsafe<XiboPlatformAdRow[]>(
      `SELECT id::text AS id, titulo, video_url, duracao_segundos, thumb_url
       FROM xibo_platform_ads
       WHERE ativo = true
       ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      ...r,
      duracao_segundos: Number(r.duracao_segundos),
    }));
  });
}
