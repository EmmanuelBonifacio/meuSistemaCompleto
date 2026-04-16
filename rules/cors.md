# Regras para Configuração de CORS

1. **Configuração Padrão**:
   - Certifique-se de que o middleware `fastifyCors` esteja configurado corretamente no servidor.
   - Adicione os domínios permitidos à lista de origens (`allowedOrigins`).

2. **Checklist**:
   - [ ] Verificar se o domínio do tenant está incluído na configuração de CORS.
   - [ ] Testar requisições de diferentes origens para garantir que o CORS está funcionando.

3. **Erros Comuns**:
   - Origem não permitida: Certifique-se de que o domínio correto foi adicionado.
   - Cabeçalhos ausentes: Verifique se os cabeçalhos necessários estão configurados.