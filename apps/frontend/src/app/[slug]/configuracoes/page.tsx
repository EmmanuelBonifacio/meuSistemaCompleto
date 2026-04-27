// =============================================================================
// Rota legada: a Sidebar apontava para /{slug}/configuracoes, mas não havia página.
// Next.js prefetch gerava 404 no console. Redireciona para o dashboard do tenant.
// =============================================================================

import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ConfiguracoesPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/${slug}/dashboard`);
}
