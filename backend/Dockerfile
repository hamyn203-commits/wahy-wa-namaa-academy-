FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY . .
RUN chmod -R a-w /app && mkdir -p /tmp/wahy-uploads && chown -R node:node /tmp/wahy-uploads

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
