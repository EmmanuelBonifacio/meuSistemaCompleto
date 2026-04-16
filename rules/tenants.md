# Regras para Criação e Configuração de Tenants

1. **Checklist para Provisionamento de Tenants**:
   - [ ] Criar o schema do tenant no banco de dados.
   - [ ] Configurar os módulos habilitados para o tenant.
   - [ ] Adicionar o domínio do tenant à configuração de CORS no servidor.
   - [ ] Testar o acesso ao tenant com o domínio configurado.

2. **Automatização**:
   - Atualize o script de provisionamento para incluir automaticamente o domínio do novo tenant na configuração de CORS.

3. **Validação**:
   - Sempre valide o funcionamento do tenant após o provisionamento.
