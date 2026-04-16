import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { xiboRoutes } from "./xibo.routes";

const mockResolve = vi.fn();
const mockProducts = vi.fn();
const mockAds = vi.fn();

vi.mock("./xiboTenantResolver.service", () => ({
  resolveTenantFromXiboToken: (...args: unknown[]) => mockResolve(...args),
}));

vi.mock("./xiboData.service", () => ({
  listXiboActiveProducts: (...args: unknown[]) => mockProducts(...args),
  listXiboPlatformAds: (...args: unknown[]) => mockAds(...args),
}));

describe("xibo.routes (inject)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /products retorna 401 sem tenant resolvido", async () => {
    mockResolve.mockResolvedValue(null);
    const app = Fastify({ logger: false });
    await app.register(xiboRoutes, { prefix: "/api/v1/xibo" });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/xibo/products?token=invalido",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Token/i);
    await app.close();
  });

  it("GET /products retorna JSON e Cache-Control com token válido", async () => {
    mockResolve.mockResolvedValue({
      id: "t1",
      schemaName: "tenant_demo",
      slug: "demo",
    });
    mockProducts.mockResolvedValue([
      {
        id: "p1",
        nome: "Produto",
        preco: 10.5,
        foto_url: "https://exemplo/foto.jpg",
        descricao: "Detalhe",
      },
    ]);

    const app = Fastify({ logger: false });
    await app.register(xiboRoutes, { prefix: "/api/v1/xibo" });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/xibo/products?token=ok-token",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=300");
    const data = JSON.parse(res.body);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toMatchObject({
      id: "p1",
      nome: "Produto",
      preco: 10.5,
    });
    expect(mockProducts).toHaveBeenCalledWith("tenant_demo");
    await app.close();
  });

  it("GET /platform-ad retorna array", async () => {
    mockResolve.mockResolvedValue({
      id: "t1",
      schemaName: "tenant_demo",
      slug: "demo",
    });
    mockAds.mockResolvedValue([
      {
        id: "a1",
        titulo: "Campanha",
        video_url: "https://cdn/v.mp4",
        duracao_segundos: 15,
        thumb_url: null,
      },
    ]);

    const app = Fastify({ logger: false });
    await app.register(xiboRoutes, { prefix: "/api/v1/xibo" });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/xibo/platform-ad?token=ok",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toContain("max-age=300");
    const data = JSON.parse(res.body);
    expect(data[0].titulo).toBe("Campanha");
    expect(mockAds).toHaveBeenCalledWith("tenant_demo");
    await app.close();
  });
});
