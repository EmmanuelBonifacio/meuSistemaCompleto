import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { prisma, withTenantSchema } from "../src/core/database/prisma";
import { provisionNewTenant } from "../src/core/tenant/tenant.provisioner";

type DemoProduct = {
  nome: string;
  descricao: string;
  preco: number;
  precoPromocional?: number | null;
  categoria: string;
  fotoUrl: string;
  destaque?: boolean;
  ordem: number;
};

type DemoStore = {
  name: string;
  slug: string;
  whatsappNumber: string;
  categorias: string[];
  primaryColor: string;
  accentColor: string;
  products: DemoProduct[];
};

const DEMO_PASSWORD = "demo123456";
const DEMO_USER_ROLE = "admin";
const MODULES_TO_ENABLE = ["vendas", "estoque", "financeiro"];
const LOGO_DIR = path.resolve(process.cwd(), "../../uploads/vendas/logos");
type StoreCatalog = Record<string, string[]>;
type PriceBand = Record<string, [number, number]>;
type TagMap = Record<string, string>;

function buildPhotoUrl(tags: string, lock: number): string {
  return `https://loremflickr.com/1200/900/${tags}?lock=${lock}`;
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function createProductsFromCatalog(
  storeName: string,
  categories: string[],
  catalog: StoreCatalog,
  priceBand: PriceBand,
  tagMap: TagMap,
  lockBase: number,
): DemoProduct[] {
  const products: DemoProduct[] = [];
  let lock = lockBase;

  for (const category of categories) {
    const names = catalog[category] ?? [];
    const [minPrice, maxPrice] = priceBand[category] ?? [59, 199];
    const tags = tagMap[category] ?? "shopping,product";

    for (const [index, nome] of names.entries()) {
      const factor = names.length > 1 ? index / (names.length - 1) : 0;
      const preco = roundPrice(minPrice + (maxPrice - minPrice) * factor);
      const isPromo = category === "promocoes" || (category === "mais-vendidos" && index % 3 === 0);
      const precoPromocional = isPromo ? roundPrice(preco * 0.88) : null;
      const destaque = category === "lancamentos" ? index < 3 : category === "mais-vendidos" ? index < 2 : false;

      products.push({
        nome,
        descricao: `${nome} da ${storeName}. Produto com qualidade e preco acessivel para o dia a dia.`,
        preco,
        precoPromocional,
        categoria: category,
        fotoUrl: buildPhotoUrl(tags, lock),
        destaque,
        ordem: index + 1,
      });

      lock += 1;
    }
  }

  return products;
}

const doceCategorias = ["lancamentos", "mais-vendidos", "promocoes", "doces", "bolos", "kits-festa"];
const docesCatalog: StoreCatalog = {
  lancamentos: ["Bolo Caseiro de Chocolate", "Torta de Morango Simples", "Bolo de Cenoura com Cobertura", "Bolo Formigueiro", "Pudim Tradicional", "Bolo de Milho", "Cuca de Banana", "Bolo de Fuba Cremoso"],
  "mais-vendidos": ["Kit Festa 20 Pessoas", "Brigadeiro Caixa 25", "Bolo de Cenoura", "Cupcake Sortido", "Torta de Limao", "Brownie Caseiro", "Beijinho Caixa 20", "Bolo Prestigio"],
  promocoes: ["Combo da Semana", "Kit Docinhos", "Bolo Brigadeiro Oferta", "Torta Holandesa Oferta", "Caixa Mista 30 Doces", "Mini Churros", "Cheesecake Oferta", "Kit Cafe da Tarde"],
  doces: ["Brigadeiro Tradicional", "Beijinho Tradicional", "Trufa de Chocolate", "Casadinho", "Camafeu", "Olho de Sogra", "Bicho de Pe", "Cajuzinho"],
  bolos: ["Bolo de Chocolate", "Bolo de Cenoura", "Bolo de Coco", "Bolo de Ninho", "Bolo de Morango", "Bolo de Leite Condensado", "Bolo de Prestigio", "Bolo de Amendoim"],
  "kits-festa": ["Kit Festa Basico", "Kit Festa Completo", "Kit Aniversario", "Kit Coffee Break", "Kit Cha de Bebe", "Kit Cha Revelacao", "Kit Festa Escolar", "Kit Mini Festa"],
};
const docesPriceBand: PriceBand = {
  lancamentos: [29.9, 79.9],
  "mais-vendidos": [24.9, 129.9],
  promocoes: [14.9, 59.9],
  doces: [2.5, 6.5],
  bolos: [34.9, 89.9],
  "kits-festa": [99.9, 299.9],
};
const docesTags: TagMap = {
  lancamentos: "cake,bakery,dessert",
  "mais-vendidos": "pastry,dessert,bakery",
  promocoes: "sweet,dessert,candy",
  doces: "candy,chocolate,dessert",
  bolos: "cake,confectionery,birthday",
  "kits-festa": "party,food,dessert",
};

const moveisCategorias = ["lancamentos", "mais-vendidos", "promocoes", "sala", "quarto", "escritorio"];
const moveisCatalog: StoreCatalog = {
  lancamentos: ["Sofa 2 Lugares", "Painel de TV Simples", "Mesa de Centro", "Poltrona de Tecido", "Aparador de Sala", "Rack para TV", "Estante de Ferro", "Banco de Madeira"],
  "mais-vendidos": ["Sofa 3 Lugares", "Mesa Jantar 6 Cadeiras", "Guarda Roupa 6 Portas", "Cama Box Queen", "Rack TV 65 Polegadas", "Poltrona Reclinavel", "Comoda 8 Gavetas", "Conjunto Sala"],
  promocoes: ["Combo Sala", "Kit Quarto Casal", "Mesa Escritorio Oferta", "Cadeira Escritório Oferta", "Estante Home Office", "Painel TV Oferta", "Sofa Compacto", "Kit Home Office"],
  sala: ["Sofa Retratil", "Mesa de Centro", "Rack de Madeira", "Poltrona Decorativa", "Aparador Simples", "Estante de Livros", "Puff Redondo", "Mesa Lateral"],
  quarto: ["Cama Box Queen", "Guarda Roupa", "Comoda 6 Gavetas", "Criado Mudo", "Penteadeira", "Cabeciera Estofada", "Banco Bau", "Closet Modulado"],
  escritorio: ["Mesa Home Office", "Cadeira Ergonomica", "Armario Arquivo", "Estante Organizadora", "Gaveteiro", "Suporte de Monitor", "Mesa Reuniao", "Poltrona Presidente"],
};
const moveisPriceBand: PriceBand = {
  lancamentos: [399, 1499],
  "mais-vendidos": [499, 1999],
  promocoes: [299, 1299],
  sala: [199, 1599],
  quarto: [249, 2299],
  escritorio: [149, 1199],
};
const moveisTags: TagMap = {
  lancamentos: "furniture,living-room,interior-design",
  "mais-vendidos": "furniture,home,interior",
  promocoes: "furniture,decor,room",
  sala: "living-room,furniture,sofa",
  quarto: "bedroom,furniture,bed",
  escritorio: "office,furniture,workspace",
};

const fashionCategorias = ["lancamentos", "mais-vendidos", "promocoes", "perfumes", "roupas", "bijuterias"];
const fashionCatalog: StoreCatalog = {
  lancamentos: ["Vestido Floral", "Perfume Feminino 100ml", "Blazer Basico", "Conjunto de Colar", "Camisa Social", "Bolsa Feminina", "Body Casual", "Jaqueta Cropped"],
  "mais-vendidos": ["Perfume Ambar", "Vestido Longo", "Conjunto Brinco e Colar", "Camisa Slim", "Saia Midi", "Pulseira Dourada", "Perfume Fresh", "Bolsa Tote"],
  promocoes: ["Kit Perfumes", "Combo Look Casual", "Bijuteria Oferta", "Vestido da Semana", "Camisa Oferta", "Kit Acessorios", "Perfume Oferta", "Pulseiras Kit"],
  perfumes: ["Perfume Floral 100ml", "Perfume Amadeirado", "Body Splash", "Perfume Citrico", "Perfume Oriental", "Perfume Musk", "Perfume Baunilha", "Perfume Rosas"],
  roupas: ["Vestido Midi", "Camisa Slim", "Blazer Feminino", "Saia Midi", "Jaqueta Cropped", "Calca Alfaiataria", "Blusa Social", "Macacao Casual"],
  bijuterias: ["Conjunto Colar e Brinco", "Pulseira Boho", "Anel Ajustavel", "Brinco Argola", "Colar Ponto de Luz", "Bracelete", "Brinco de Festa", "Kit Acessorios"],
};
const fashionPriceBand: PriceBand = {
  lancamentos: [69, 199],
  "mais-vendidos": [49, 169],
  promocoes: [29, 119],
  perfumes: [39, 159],
  roupas: [59, 189],
  bijuterias: [19, 79],
};
const fashionTags: TagMap = {
  lancamentos: "fashion,style,boutique",
  "mais-vendidos": "fashion,clothing,perfume",
  promocoes: "fashion,accessories,shopping",
  perfumes: "perfume,bottle,cosmetics",
  roupas: "clothing,fashion,outfit",
  bijuterias: "jewelry,accessories,fashion",
};

const demoStores: DemoStore[] = [
  {
    name: "Doce Encanto",
    slug: "doce-encanto",
    whatsappNumber: "5511993000101",
    categorias: doceCategorias,
    primaryColor: "#f472b6",
    accentColor: "#7c2d12",
    products: createProductsFromCatalog("Doce Encanto", doceCategorias, docesCatalog, docesPriceBand, docesTags, 1000),
  },
  {
    name: "Casa Nobre Moveis",
    slug: "casa-nobre-moveis",
    whatsappNumber: "5511993000202",
    categorias: moveisCategorias,
    primaryColor: "#1f3a5f",
    accentColor: "#8b5e3c",
    products: createProductsFromCatalog("Casa Nobre Moveis", moveisCategorias, moveisCatalog, moveisPriceBand, moveisTags, 2000),
  },
  {
    name: "Bella Essence",
    slug: "bella-essence",
    whatsappNumber: "5511993000303",
    categorias: fashionCategorias,
    primaryColor: "#111111",
    accentColor: "#c9a227",
    products: createProductsFromCatalog("Bella Essence", fashionCategorias, fashionCatalog, fashionPriceBand, fashionTags, 3000),
  },
];

function getSchemaName(slug: string): string {
  return `tenant_${slug.replace(/-/g, "_")}`;
}

function buildMonogram(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildLogoSvg(store: DemoStore): string {
  const monogram = buildMonogram(store.name);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${store.primaryColor}" />
      <stop offset="100%" stop-color="${store.accentColor}" />
    </linearGradient>
  </defs>
  <rect width="640" height="640" rx="96" fill="url(#bg)" />
  <rect x="72" y="72" width="496" height="496" rx="72" fill="rgba(255,255,255,0.12)" />
  <text x="320" y="340" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="170" font-weight="700" fill="#ffffff">${monogram}</text>
  <text x="320" y="435" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="rgba(255,255,255,0.92)">${store.name}</text>
</svg>`;
}

async function ensureTenantAndModules(store: DemoStore): Promise<{
  tenantId: string;
  schemaName: string;
}> {
  const schemaName = getSchemaName(store.slug);

  let tenant = await prisma.tenant.findUnique({
    where: { slug: store.slug },
    select: { id: true, schemaName: true },
  });

  if (!tenant) {
    const created = await provisionNewTenant({
      name: store.name,
      slug: store.slug,
      schemaName,
      moduleNames: MODULES_TO_ENABLE,
    });
    tenant = { id: created.id, schemaName: created.schemaName };
    console.log(`✅ Tenant criado: ${store.name} (${store.slug})`);
  } else {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { name: store.name, isActive: true },
    });
    console.log(`ℹ️ Tenant ja existente atualizado: ${store.name} (${store.slug})`);
  }

  const modules = await prisma.module.findMany({
    where: { name: { in: MODULES_TO_ENABLE } },
    select: { id: true, name: true },
  });

  for (const module of modules) {
    await prisma.tenantModule.upsert({
      where: {
        tenantId_moduleId: {
          tenantId: tenant.id,
          moduleId: module.id,
        },
      },
      create: {
        tenantId: tenant.id,
        moduleId: module.id,
        isEnabled: true,
        enabledAt: new Date(),
      },
      update: {
        isEnabled: true,
        enabledAt: new Date(),
      },
    });
  }

  return { tenantId: tenant.id, schemaName: tenant.schemaName };
}

async function seedStoreUser(schemaName: string, slug: string): Promise<void> {
  const email = `admin@${slug}.demo`;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        email         VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name          VARCHAR(100),
        role          VARCHAR(50)  NOT NULL DEFAULT 'user',
        is_active     BOOLEAN      NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT users_email_unique UNIQUE (email)
      )
    `);

    await tx.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email)
       DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         is_active = true,
         updated_at = NOW()`,
      email,
      passwordHash,
      `Administrador ${slug}`,
      DEMO_USER_ROLE,
    );
  });
}

async function seedStoreCatalog(
  store: DemoStore,
  schemaName: string,
  logoUrl: string,
): Promise<void> {
  await withTenantSchema(schemaName, async (tx) => {
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".venda_produtos (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        nome              VARCHAR(255)  NOT NULL,
        descricao         TEXT,
        preco             DECIMAL(10,2) NOT NULL DEFAULT 0.00
                          CONSTRAINT venda_produtos_preco_positivo CHECK (preco >= 0),
        preco_promocional DECIMAL(10,2)
                          CONSTRAINT venda_produtos_preco_promo_positivo CHECK (preco_promocional >= 0),
        categoria         VARCHAR(50)   NOT NULL DEFAULT 'lancamentos',
        foto_url          TEXT,
        ativo             BOOLEAN       NOT NULL DEFAULT true,
        destaque          BOOLEAN       NOT NULL DEFAULT false,
        ordem             INTEGER       NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      )
    `);

    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schemaName}".venda_config (
        id              INTEGER     PRIMARY KEY DEFAULT 1,
        whatsapp_number VARCHAR(20),
        nome_loja       VARCHAR(255),
        logo_url        VARCHAR(500),
        categorias      TEXT,
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT venda_config_single_row CHECK (id = 1)
      )
    `);

    await tx.$executeRawUnsafe(`
      ALTER TABLE "${schemaName}".venda_config
      ADD COLUMN IF NOT EXISTS categorias TEXT
    `);

    await tx.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".venda_config (id)
       VALUES (1)
       ON CONFLICT DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `UPDATE "${schemaName}".venda_config
       SET whatsapp_number = $1,
           nome_loja = $2,
           logo_url = $3,
           categorias = $4,
           updated_at = NOW()
       WHERE id = 1`,
      store.whatsappNumber,
      store.name,
      logoUrl,
      JSON.stringify(store.categorias),
    );

    await tx.$executeRawUnsafe(`DELETE FROM "${schemaName}".venda_produtos`);

    for (const product of store.products) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".venda_produtos
          (nome, descricao, preco, preco_promocional, categoria, foto_url, ativo, destaque, ordem)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)`,
        product.nome,
        product.descricao,
        product.preco,
        product.precoPromocional ?? null,
        product.categoria,
        product.fotoUrl,
        product.destaque ?? false,
        product.ordem,
      );
    }
  });
}

async function writeLogo(store: DemoStore): Promise<string> {
  if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
  }

  const filename = `logo-${store.slug}.svg`;
  const filePath = path.join(LOGO_DIR, filename);
  fs.writeFileSync(filePath, buildLogoSvg(store), "utf-8");

  return `/uploads/vendas/logos/${filename}`;
}

async function main() {
  console.log("🛍️ Iniciando criacao das lojas demo...");

  for (const store of demoStores) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Loja: ${store.name} (${store.slug})`);

    const { schemaName } = await ensureTenantAndModules(store);
    const logoUrl = await writeLogo(store);
    await seedStoreCatalog(store, schemaName, logoUrl);
    await seedStoreUser(schemaName, store.slug);

    console.log(`✅ Loja finalizada: ${store.name}`);
    console.log(`   URL catalogo: http://localhost:3001/${store.slug}/vendas`);
    console.log(`   Login tenant: admin@${store.slug}.demo / ${DEMO_PASSWORD}`);
  }

  console.log("\n🎉 As 3 lojas demo foram criadas e populadas com sucesso.");
}

main()
  .catch((error) => {
    console.error("❌ Erro ao criar lojas demo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
