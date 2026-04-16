import { describe, it, expect } from "vitest";
import { effectiveDisplayPreco } from "./xiboData.service";

describe("xiboData.service — effectiveDisplayPreco", () => {
  it("usa preço cheio quando não há promoção", () => {
    expect(
      effectiveDisplayPreco({ preco: 99.9, preco_promocional: null }),
    ).toBe(99.9);
  });

  it("usa promoção quando > 0", () => {
    expect(
      effectiveDisplayPreco({ preco: 100, preco_promocional: 79.9 }),
    ).toBe(79.9);
  });

  it("ignora promoção zero", () => {
    expect(
      effectiveDisplayPreco({ preco: 50, preco_promocional: 0 }),
    ).toBe(50);
  });
});
