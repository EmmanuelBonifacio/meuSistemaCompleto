# 📝 Notas para Produção

Ideias e melhorias planejadas antes de subir o sistema para produção.
Este arquivo serve como rascunho técnico — não é código, é intenção.

---

## 🔐 Autenticação: Implementar Abordagem Híbrida de Tokens

**Status:** Pendente — implementar antes de ir a produção  
**Prioridade:** Alta  
**Contexto:** Atualmente o sistema usa um único JWT de longa duração (1h) gerado pela rota `/dev/token` sem verificação de credenciais. Isso funciona para desenvolvimento mas não é seguro para produção.

---

### A Ideia

Trocar o token único de 1 hora por dois tokens com responsabilidades separadas:

```
Token curto (5-15 minutos) + Refresh token longo no banco
    │
    ├── Acesso rápido (sem query) durante os 15 min
    │
    └── Ao renovar o refresh token:
        → Consulta banco
        → Verifica se tenant ativo, módulos atuais
        → Emite novo access token com estado real
        → Se suspenso → não emite novo token → bloqueio efetivo em até 15 min
```

---

### Como Funciona na Prática

**1. Login real (POST /auth/login)**

```
Usuário envia { email, senha }
    → Busca usuário na tabela users do tenant
    → Verifica senha com bcrypt.compare()
    → Gera dois tokens:
        access_token:  JWT curto (15 min), sem query para verificar
        refresh_token: string aleatória longa, salva no banco com validade de 7-30 dias
    → Retorna os dois tokens para o cliente
```

**2. Uso normal (todas as rotas protegidas)**

```
Cliente envia access_token no header Authorization: Bearer <token>
    → tenantMiddleware verifica a assinatura JWT (sem query)
    → Se válido e não expirado → prossegue normalmente (rápido)
    → Se expirado → cliente precisa renovar com o refresh token
```

**3. Renovação (POST /auth/refresh)**

```
Cliente envia { refresh_token: "string-longa-salva-no-banco" }
    → Busca o refresh token na tabela refresh_tokens
    → Verifica se não está expirado e não foi revogado
    → Consulta o banco: tenant ainda ativo? módulos ainda os mesmos?
    → Se tudo ok → emite novo access_token (15 min) + novo refresh_token
    → Se tenant suspenso → não emite → retorna 403
    → Invalida o refresh_token anterior (rotação de tokens)
```

**4. Logout (POST /auth/logout)**

```
Cliente envia o refresh_token
    → Marca como revogado no banco (is_revoked = true)
    → O access_token expira naturalmente em até 15 min
```

---

### O Que Precisa Ser Criado

#### Tabela nova: `users` (dentro de cada schema de tenant)

```sql
CREATE TABLE IF NOT EXISTS "{schemaName}".users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,   -- bcrypt hash, NUNCA texto puro
  name          VARCHAR(100),
  role          VARCHAR(50)  NOT NULL DEFAULT 'user',
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email)
);
```

#### Tabela nova: `refresh_tokens` (dentro de cada schema de tenant)

```sql
CREATE TABLE IF NOT EXISTS "{schemaName}".refresh_tokens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL,   -- hash do token (não salvar em texto puro)
  expires_at    TIMESTAMPTZ NOT NULL,
  is_revoked    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    VARCHAR(45),             -- opcional: para auditoria
  user_agent    TEXT                     -- opcional: para auditoria
);
```

#### Arquivo novo: `src/modules/auth/auth.routes.ts`

- `POST /auth/login` → verifica credenciais, emite os dois tokens
- `POST /auth/refresh` → valida refresh token, emite novo par
- `POST /auth/logout` → revoga o refresh token

#### Arquivo novo: `src/modules/auth/auth.service.ts`

- `hashPassword(senha)` → bcrypt com salt rounds = 12
- `verifyPassword(senha, hash)` → bcrypt.compare()
- `generateAccessToken(payload)` → JWT 15 minutos
- `generateRefreshToken()` → crypto.randomBytes(64).toString('hex')
- `hashRefreshToken(token)` → sha256 para salvar no banco

#### Pacotes a instalar

```bash
npm install bcrypt
npm install --save-dev @types/bcrypt
```

---

### Vantagens desta Abordagem

| Critério                 | Token único 1h (atual)   | Híbrido (planejado)        |
| ------------------------ | ------------------------ | -------------------------- |
| Revogação de acesso      | ❌ Aguarda 1h expirar    | ✅ Em até 15 minutos       |
| Suspensão de tenant      | ✅ Verificada no banco   | ✅ Verificada na renovação |
| Performance              | ✅ Sem query de auth     | ✅ Sem query nos 15 min    |
| Segurança de credenciais | ❌ Sem senha real        | ✅ bcrypt + hash           |
| Token roubado            | ❌ Válido por 1h inteira | ✅ Válido no máximo 15 min |
| Logout real              | ❌ Impossível            | ✅ Revoga refresh token    |

---

### Ordem de Implementação Sugerida

1. Adicionar tabelas `users` e `refresh_tokens` ao `tenant.provisioner.ts`
2. Criar `auth.service.ts` com bcrypt e geração de tokens
3. Criar `auth.repository.ts` com queries nas duas tabelas
4. Criar `auth.controller.ts` com os 3 handlers (login, refresh, logout)
5. Criar `auth.routes.ts` — rotas públicas, sem tenantMiddleware no login
6. Remover (ou manter apenas em DEV) a rota `/dev/token`
7. Ajustar `tenantMiddleware` para lidar com access tokens de curta duração
8. Criar script de seed para criar um usuário admin inicial por tenant

---

_Registrado em: 01/04/2026_  
_Contexto: discussão sobre segurança de tokens JWT vs banco de dados_
