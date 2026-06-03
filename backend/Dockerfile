FROM node:20-alpine AS builder
WORKDIR /app
# OpenSSL necessário para o Prisma gerar os engines
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL necessário para o Prisma em runtime
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/dist          ./dist
COPY                prisma             ./prisma
COPY                package.json       ./
COPY                entrypoint.sh      ./
RUN chmod +x entrypoint.sh

# Garantir que o usuário node (já existe no node:alpine) tem acesso total
RUN chown -R node:node /app
USER node

EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]
