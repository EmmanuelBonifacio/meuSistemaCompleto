# Boas Práticas Gerais de Desenvolvimento

1. **Organização de Código**:
   - Mantenha cada módulo em sua própria pasta.
   - Use nomes claros e descritivos para arquivos e funções.

2. **TypeScript**:
   - Sempre use tipagem forte.
   - Defina interfaces e tipos compartilhados em uma pasta `types`.

3. **SOLID**:
   - Cada arquivo deve ter uma única responsabilidade.

4. **Configurações**:
   - Nunca armazene credenciais ou URLs diretamente no código. Use variáveis de ambiente.

5. **Testes**:
   - Escreva testes unitários para middlewares e serviços.
   - Separe a criação do servidor (`buildServer`) do início (`start`) para facilitar testes.
