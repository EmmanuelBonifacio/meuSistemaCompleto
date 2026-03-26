-- =============================================================================
-- docker/postgres/init-scripts/01-init.sql
-- =============================================================================
-- O QUE FAZ:
--   Este script é executado AUTOMATICAMENTE pelo PostgreSQL na primeira vez
--   que o container sobe (quando o volume de dados está vazio).
--
-- POR QUE PRECISAMOS DISTO?
--   Precisamos garantir que certas extensões do PostgreSQL estejam habilitadas
--   antes de qualquer migration do Prisma rodar. Isso não pode ser feito via
--   Prisma migrations porque requer privilégios de superusuário.
--
-- COMO FUNCIONA:
--   O Docker executa todos os arquivos .sql desta pasta em ordem alfabética
--   durante a inicialização. Por isso o arquivo se chama "01-init.sql"
--   (para controlar a ordem de execução).
-- =============================================================================

-- Habilita a extensão pgcrypto para geração de UUIDs seguros no banco
-- (Usada como fallback, embora o Prisma gerencie UUIDs no nível da aplicação)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Habilita a extensão uuid-ossp (alternativa para geração de UUID v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- LOG DE INICIALIZAÇÃO
-- =============================================================================
-- Este RAISE NOTICE aparecerá nos logs do container durante a inicialização,
-- facilitando o diagnóstico de problemas.
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'Banco de dados SaaS Multitenant inicializado com sucesso!';
  RAISE NOTICE 'Extensões pgcrypto e uuid-ossp habilitadas.';
  RAISE NOTICE '======================================================';
END $$;
