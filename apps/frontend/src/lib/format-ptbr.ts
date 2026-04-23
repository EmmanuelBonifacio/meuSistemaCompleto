/**
 * Formatação numérica estável entre SSR (Node) e browser.
 * `toLocaleString` / `Intl` podem differir ligeiramente e causar React #418/#423.
 */

export function formatBrl(valor: number): string {
  if (!Number.isFinite(valor)) return "R$ 0,00";
  const neg = valor < 0;
  const abs = Math.abs(valor);
  const [intPart, dec] = abs.toFixed(2).split(".");
  const withThousands = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (neg) {
    return `R$ -${withThousands},${dec}`;
  }
  return `R$ ${withThousands},${dec}`;
}

/** Peso com vírgula decimal; até 2 casas, sem forçar Intl. */
export function formatQuantidadeKg(valor: number): string {
  if (!Number.isFinite(valor)) return "0";
  const r = Math.round(valor * 100) / 100;
  return r.toString().replace(".", ",");
}
