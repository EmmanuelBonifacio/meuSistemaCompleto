// =============================================================================
// src/modules/estoque/estoque.repository.ts
// =============================================================================
// O QUE FAZ:
//   Camada de ACESSO A DADOS do módulo de estoque. É o único lugar no sistema
//   que sabe como buscar, criar, atualizar e deletar produtos no banco.
//
// PADRÃO REPOSITORY:
//   O Repository isola o código de acesso a banco de dados do resto da
//   aplicação. Se amanhã você quiser trocar PostgreSQL por MongoDB, você
//   só reescreve este arquivo. O Service e o Controller não mudam nada.
//
// A MAGIA DO ISOLAMENTO (COMO O CLIENTE A NÃO VÊ OS DADOS DO CLIENTE B):
//   Toda função recebe `schemaName: string` como primeiro parâmetro.
//   Este parâmetro é o nome do schema PostgreSQL do tenant que fez a
//   requisição (ex: "tenant_acme_corp" ou "tenant_foobar").
//
//   Internamente, cada função chama:
//     withTenantSchema(schemaName, async (tx) => { ... query ... })
//
//   O withTenantSchema (definido em core/database/prisma.ts) executa:
//     SET LOCAL search_path TO "tenant_acme_corp", public
//
//   A partir daí, `SELECT * FROM products` vai para "tenant_acme_corp.products".
//   É IMPOSSÍVEL acessar dados de outro tenant acidentalmente, pois o
//   PostgreSQL garante o isolamento no nível de schema.
//
// POR QUE SQL RAW E NÃO PRISMA MODELS?
//   O Prisma gerencia apenas as tabelas do schema 'public' (tenants, modules, etc.)
//   As tabelas dos módulos (products, transactions) vivem em schemas dinâmicos
//   criados em tempo de execução. O Prisma não tem models para elas.
//   Usamos $queryRaw/$executeRaw com o search_path já configurado.
// =============================================================================

import { withTenantSchema } from "../../core/database/prisma";
import {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from "./estoque.schema";

// =============================================================================
// TIPO: Product
// =============================================================================
// Define a estrutura de um produto como ele existe no banco de dados.
// Criado manualmente pois o Prisma não conhece a tabela `products` dos tenants.
// =============================================================================
export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  sku: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// TIPO: ProductListResult
// =============================================================================
export interface ProductListResult {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================================================
// FUNÇÃO: findAllProducts
// =============================================================================
export async function findAllProducts(
  schemaName: string,
  query: ListProductsQuery,
): Promise<ProductListResult> {
  const { page, limit, search, onlyActive } = query;
  const offset = (page - 1) * limit;

  return withTenantSchema(schemaName, async (tx) => {
    // Constrói a cláusula WHERE dinamicamente baseado nos filtros recebidos.
    // Em vez de concatenar strings SQL (vulnerável a injection), usamos
    // condições parametrizadas com $1, $2, etc.
    //
    // NOTA SOBRE $queryRaw vs Prisma.sql:
    //   Prisma.sql é o tagged template que faz escaping automático de valores.
    //   Mas para construir queries dinâmicas (WHERE condicional), usamos
    //   strings com parâmetros posicionais do PostgreSQL ($1, $2).
    //   Os valores são passados no array `values` — o PostgreSQL faz o
    //   escaping seguro automaticamente. Isso PREVINE SQL INJECTION.
    const values: unknown[] = [onlyActive];
    let whereClause = "WHERE is_active = $1";

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      whereClause += ` AND LOWER(name) LIKE $${values.length}`;
    }

    // Busca os produtos com paginação
    values.push(limit, offset);
    const products = await tx.$queryRawUnsafe<Product[]>(
      `SELECT id, name, description, price::float, quantity, sku,
              is_active AS "isActive",
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM products
       ${whereClause}
       ORDER BY name ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      ...values,
    );

    // Conta o total de registros (para calcular paginação no frontend)
    const countValues = values.slice(0, values.length - 2); // remove limit e offset
    const countResult = await tx.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM products ${whereClause}`,
      ...countValues,
    );

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });
}

// =============================================================================
// FUNÇÃO: findProductById
// =============================================================================
export async function findProductById(
  schemaName: string,
  id: string,
): Promise<Product | null> {
  return withTenantSchema(schemaName, async (tx) => {
    // $1 é o placeholder seguro para o valor `id`.
    // O PostgreSQL garante que este valor é tratado como DADO, não como SQL.
    // Isso previne: id = "'; DROP TABLE products; --"
    const results = await tx.$queryRaw<Product[]>`
      SELECT id, name, description, price::float, quantity, sku,
             is_active AS "isActive",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM products
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: createProduct
// =============================================================================
export async function createProduct(
  schemaName: string,
  data: CreateProductInput,
): Promise<Product> {
  return withTenantSchema(schemaName, async (tx) => {
    const results = await tx.$queryRaw<Product[]>`
      INSERT INTO products (name, description, price, quantity, sku)
      VALUES (
        ${data.name},
        ${data.description ?? null},
        ${data.price},
        ${data.quantity},
        ${data.sku ?? null}
      )
      RETURNING id, name, description, price::float, quantity, sku,
                is_active AS "isActive",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
    `;
    // RETURNING é uma cláusula do PostgreSQL que retorna o registro
    // recém-inserido. Evita um segundo SELECT após o INSERT.
    return results[0];
  });
}

// =============================================================================
// FUNÇÃO: updateProduct
// =============================================================================
export async function updateProduct(
  schemaName: string,
  id: string,
  data: UpdateProductInput,
): Promise<Product | null> {
  return withTenantSchema(schemaName, async (tx) => {
    // Constrói o SET dinamicamente: só atualiza os campos enviados.
    // Evita sobrescrever campos com NULL quando o campo não foi enviado.
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      values.push(data.name);
      setClauses.push(`name = $${values.length}`);
    }
    if (data.description !== undefined) {
      values.push(data.description);
      setClauses.push(`description = $${values.length}`);
    }
    if (data.price !== undefined) {
      values.push(data.price);
      setClauses.push(`price = $${values.length}`);
    }
    if (data.quantity !== undefined) {
      values.push(data.quantity);
      setClauses.push(`quantity = $${values.length}`);
    }
    if (data.sku !== undefined) {
      values.push(data.sku);
      setClauses.push(`sku = $${values.length}`);
    }

    if (setClauses.length === 0) {
      // Nenhum campo foi enviado — retorna o produto atual sem alterar
      return findProductById(schemaName, id);
    }

    // Sempre atualiza updated_at para rastrear quando a última mudança ocorreu
    setClauses.push(`updated_at = NOW()`);

    values.push(id);
    const idPosition = values.length;

    const results = await tx.$queryRawUnsafe<Product[]>(
      `UPDATE products
       SET ${setClauses.join(", ")}
       WHERE id = $${idPosition}::uuid
       RETURNING id, name, description, price::float, quantity, sku,
                 is_active AS "isActive",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      ...values,
    );

    return results[0] ?? null;
  });
}

// =============================================================================
// FUNÇÃO: deleteProduct (soft delete)
// =============================================================================
// O QUE FAZ:
//   Realiza um SOFT DELETE: em vez de apagar o registro do banco, apenas
//   marca `is_active = false`.
//
// POR QUE SOFT DELETE E NÃO DELETE REAL?
//   1. Auditoria: mantém histórico de produtos que existiram
//   2. Recuperação: produto pode ser reativado sem precisar de backup
//   3. Integridade referencial: outros registros podem referenciar este produto
//      (ex: itens de pedido históricos)
//   Para apagamento definitivo, use hardDeleteProduct() (não implementado aqui
//   propositalmente — requer permissão especial de admin).
// =============================================================================
export async function deleteProduct(
  schemaName: string,
  id: string,
): Promise<boolean> {
  return withTenantSchema(schemaName, async (tx) => {
    const result = await tx.$queryRaw<[{ id: string }]>`
      UPDATE products
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}::uuid AND is_active = true
      RETURNING id
    `;
    // Se `result` tem pelo menos um elemento, o produto foi encontrado e
    // desativado. Se estiver vazio, o produto não existia ou já estava inativo.
    return result.length > 0;
  });
}
