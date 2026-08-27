# Stage 1 — Build TypeScript
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl fonts-liberation && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2 — Runtime léger (pas de devDependencies)
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl fonts-liberation && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Copier le client Prisma généré et le build compilé
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Créer les dossiers uploads (le volume Docker les montera)
RUN mkdir -p uploads/logos uploads/fiches-techniques uploads/field-reports

EXPOSE 3000

# Migrate en premier, puis démarrer
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
