# Stage 1 -> Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npm run build

RUN npx prisma generate

# Stage 2 -> Prod image
FROM node:20-alpine as production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

RUN addgroup -g 1001 -S modejs && adduser -S nestjs -u 1001 -G nodejs
USER nestjs

EXPOSE 3000

CMD [ "node", "dist/apps/order-service/main" ]