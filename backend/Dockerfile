FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S pequi && adduser -S pequi -G pequi

COPY --from=deps    /app/node_modules            ./node_modules
COPY --from=builder /app/dist                    ./dist
COPY --from=builder /app/node_modules/.prisma    ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma    ./node_modules/@prisma
COPY                prisma                       ./prisma
COPY                package.json                 ./
COPY                entrypoint.sh                ./
RUN chmod +x entrypoint.sh

USER pequi
EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
