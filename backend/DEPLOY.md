# 🍈 Guia de Deploy — Pequi Digital na Hostinger VPS

## Pré-requisitos na VPS
- Ubuntu 22.04 LTS
- Acesso SSH root ou sudo

---

## 1. Instalar Dependências na VPS

```bash
# Atualizar pacotes
apt update && apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PM2 (gerenciador de processos Node)
npm install -g pm2

# Instalar Nginx
apt install -y nginx
```

> ℹ️ **PostgreSQL já instalado?** Pule para o passo 2.

---

## 2. Configurar PostgreSQL

```bash
# Acessar PostgreSQL
sudo -u postgres psql

# Dentro do psql:
CREATE DATABASE pequi_digital;
CREATE USER pequi WITH ENCRYPTED PASSWORD 'SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON DATABASE pequi_digital TO pequi;
\c pequi_digital
GRANT ALL ON SCHEMA public TO pequi;
\q
```

---

## 3. Subir o Código na VPS

```bash
# Na sua máquina local — enviar o backend para a VPS
scp -r /Volumes/externo/leadflow-automation-main/leadqui/backend root@IP_DA_VPS:/var/www/pequi-backend

# Na VPS
cd /var/www/pequi-backend

# Criar o .env
cp .env.example .env
nano .env
# Preencha: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, FRONTEND_URL
```

---

## 4. Instalar Dependências e Rodar Migrations

```bash
cd /var/www/pequi-backend

npm install

# Gerar o Prisma Client
npm run db:generate

# Aplicar as migrations no banco de dados
npm run db:push

# Criar o primeiro usuário Admin
ADMIN_EMAIL=seu@email.com ADMIN_PASSWORD=SuaSenha123 npm run seed
```

---

## 5. Build e Iniciar com PM2

```bash
# Build TypeScript
npm run build

# Iniciar com PM2
pm2 start dist/server.js --name "pequi-api" --env production

# Salvar para reiniciar automaticamente
pm2 save
pm2 startup
```

---

## 6. Configurar Nginx (Proxy Reverso)

```bash
nano /etc/nginx/sites-available/pequi-api
```

```nginx
server {
    listen 80;
    server_name api.seudominio.com.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/pequi-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 7. SSL com Certbot (HTTPS)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.seudominio.com.br
```

---

## 8. Deploy do Frontend (React)

```bash
# Na sua máquina local — fazer o build
cd /Volumes/externo/leadflow-automation-main/leadqui
npm run build

# Enviar o dist para a VPS
scp -r dist/ root@IP_DA_VPS:/var/www/pequi-frontend
```

**Configuração Nginx para o Frontend:**
```nginx
server {
    listen 80;
    server_name app.seudominio.com.br;
    root /var/www/pequi-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Comandos Úteis

```bash
pm2 logs pequi-api        # Ver logs em tempo real
pm2 restart pequi-api     # Reiniciar a API
pm2 status                # Ver status dos processos
```

---

## Variáveis .env Obrigatórias

| Variável | Exemplo |
|---|---|
| `DATABASE_URL` | `postgresql://pequi:SENHA_FORTE_AQUI@localhost:5432/pequi_digital` |
| `JWT_SECRET` | Chave aleatória longa (use: `openssl rand -hex 64`) |
| `RESEND_API_KEY` | Chave do resend.com |
| `RESEND_FROM_EMAIL` | `noreply@seudominio.com.br` |
| `FRONTEND_URL` | `https://app.seudominio.com.br` |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
