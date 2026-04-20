# COMO FAZER DEPLOY NA HOSTINGER VPS
# ============================================================
# Guia completo para publicar atualizações do sistema
# no servidor da Hostinger usando o deploy.sh
# ============================================================

## O QUE É DEPLOY?

Deploy é o processo de pegar o código que você desenvolveu na
sua máquina e colocar no servidor para que os clientes vejam
as atualizações. Pense assim:

```
Seu computador (desenvolvimento)
        ↓  git push
     GitHub (repositório)
        ↓  git pull (no servidor)
  Servidor Hostinger (produção)
        ↓
   Clientes acessam
```

---

## PRÉ-REQUISITOS (fazer uma única vez, na primeira vez)

### 1. Conectar no servidor via SSH

SSH é a forma de acessar o terminal do servidor remotamente,
como se você estivesse digitando comandos diretamente nele.

```bash
ssh root@IP_DO_SEU_SERVIDOR
# Exemplo: ssh root@192.168.1.100
# A Hostinger te dá o IP e a senha no painel deles
```

### 2. Instalar o Node.js no servidor (se ainda não tiver)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # deve mostrar v20.x.x
```

### 3. Instalar o PM2 (gerenciador de processos)

O PM2 mantém seu sistema rodando 24h/dia. Se o servidor
reiniciar, ele sobe os processos automaticamente.

```bash
npm install -g pm2
pm2 --version   # confirma a instalação
```

### 4. Instalar o Git

```bash
sudo apt-get install -y git
git --version
```

### 5. Clonar o repositório no servidor (primeira vez)

```bash
cd /var/www
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git meuProjetoSistemaCompleto
```

### 6. Criar o arquivo .env no servidor

O arquivo .env NÃO vai para o GitHub (por segurança).
Você precisa criá-lo manualmente no servidor:

```bash
cd /var/www/meuProjetoSistemaCompleto/apps/backend
cp .env.example .env
nano .env   # abre o editor para você preencher os valores reais
```

Preencha com os dados reais de produção:
- DATABASE_URL com o PostgreSQL do servidor
- JWT_SECRET com uma string secreta longa
- FRONTEND_URL com o domínio real (ex: https://app.seudominio.com)
- XIBO_API_TOKEN_* para cada tenant
- NEXT_PUBLIC_WHATSAPP_MEDIA_BASE_URL com a URL pública da API
  (ex: https://api.seudominio.com) para previews de imagem no WhatsApp

### 7. Dar permissão de execução ao deploy.sh

```bash
cd /var/www/meuProjetoSistemaCompleto
chmod +x deploy.sh
```

### 8. Configurar PM2 para iniciar no boot do servidor

```bash
pm2 startup
# Esse comando vai mostrar um comando para você copiar e colar
# Execute o comando que ele mostrar, depois rode:
pm2 save
```

---

## FLUXO DE TRABALHO DO DIA A DIA

### No SEU computador (desenvolvimento):

```bash
# 1. Faz as alterações no código
# 2. Testa localmente
# 3. Commita e envia para o GitHub
git add .
git commit -m "feat: descrição do que foi feito"
git push origin main
```

### No SERVIDOR (para publicar para os clientes):

```bash
# 1. Conecta no servidor
ssh root@IP_DO_SEU_SERVIDOR

# 2. Vai para a pasta do projeto
cd /var/www/meuProjetoSistemaCompleto

# 3. Executa o script de deploy (faz tudo automaticamente)
./deploy.sh
```

**Pronto!** O script cuida de todo o resto sozinho.

---

## O QUE O deploy.sh FAZ POR DENTRO (passo a passo)

```
[1] Entra na pasta do projeto
[2] git pull origin main        → baixa o código novo do GitHub
[3] npm install                 → instala pacotes novos (se houver)
[4] Roda as migrações do banco  → atualiza estrutura do banco de dados
[5] npm run build (backend)     → compila TypeScript → JavaScript
[6] npm run build (frontend)    → compila Next.js → arquivos estáticos
[7] pm2 restart                 → reinicia os serviços com o código novo
```

### Por que a ordem importa?

A ordem é crítica, especialmente o passo 4 (migrações).
Se você reiniciar o código antes de migrar o banco, o novo
código vai tentar usar colunas ou tabelas que ainda não existem
no banco → o sistema quebra para todos os clientes.

```
ERRADO ❌:  restart → migrate
CORRETO ✅: migrate → build → restart
```

---

## COMO EDITAR O deploy.sh PARA SEU SERVIDOR

Abra o arquivo e altere as linhas de configuração no topo:

```bash
PROJECT_DIR="/var/www/meuProjetoSistemaCompleto"  # caminho real no servidor
PM2_BACKEND_NAME="saas-backend"                    # nome que você quiser
PM2_FRONTEND_NAME="saas-frontend"                  # nome que você quiser
GIT_BRANCH="main"                                  # branch do GitHub
```

---

## COMANDOS ÚTEIS DO DIA A DIA NO SERVIDOR

### Ver se o sistema está rodando:
```bash
pm2 list
# Mostra todos os processos: nome, status, CPU, memória
```

### Ver os logs em tempo real (para debugar erros):
```bash
pm2 logs saas-backend    # logs do backend
pm2 logs saas-frontend   # logs do frontend
pm2 logs                 # todos os logs
```

### Reiniciar manualmente um serviço:
```bash
pm2 restart saas-backend
pm2 restart saas-frontend
pm2 restart all          # reinicia todos
```

### Parar um serviço:
```bash
pm2 stop saas-backend
```

### Ver detalhes de um processo (memória, CPU, uptime):
```bash
pm2 show saas-backend
```

### Monitorar em tempo real (dashboard no terminal):
```bash
pm2 monit
```

---

## SE ALGO QUEBRAR DURANTE O DEPLOY

### Voltar para a versão anterior (rollback):

```bash
# Ver os commits anteriores
git log --oneline -10

# Voltar para um commit específico (substitua HASH pelo código do commit)
git checkout HASH_DO_COMMIT

# Recompilar e reiniciar
cd apps/backend && npm run build
cd ../frontend && npm run build
pm2 restart all
```

### Ver o que deu errado nos logs:

```bash
pm2 logs --lines 100   # últimas 100 linhas de log
```

---

## ESTRUTURA DOS PROCESSOS NO SERVIDOR

```
PM2
├── saas-backend   → roda em http://localhost:3000
│     └── apps/backend/dist/server.js
│
└── saas-frontend  → roda em http://localhost:3001
      └── apps/frontend/.next/
```

### NGINX (proxy reverso — recomendado):

Na Hostinger, você pode configurar o NGINX para receber
as requisições do domínio e redirecionar para as portas:

```
seudominio.com        → localhost:3001  (frontend)
api.seudominio.com    → localhost:3000  (backend)
```

Isso permite usar HTTPS e domínio personalizado.

---

## CHECKLIST ANTES DE CADA DEPLOY

- [ ] Testei localmente antes de fazer o push?
- [ ] O git push foi feito para a branch main?
- [ ] O .env do servidor tem todas as variáveis novas?
- [ ] Se tiver migração nova, ela está listada no deploy.sh?
- [ ] Avisei os clientes que o sistema ficará ~2 min fora?

---

## QUANTO TEMPO FICA FORA DO AR?

Durante o `pm2 restart`, o sistema fica aproximadamente:
- **Backend**: ~5 segundos fora do ar
- **Frontend**: ~10 segundos fora do ar

Se quiser zero downtime no futuro, é possível configurar
PM2 em modo cluster. Me peça quando chegar nesse ponto.
