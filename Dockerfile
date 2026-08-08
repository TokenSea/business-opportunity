FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN sed -i 's|http://deb.debian.org|http://mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::http::Timeout=30 -o Acquire::Retries=3 update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

FROM dependencies AS builder

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN sed -i 's|http://deb.debian.org|http://mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::http::Timeout=30 -o Acquire::Retries=3 update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
