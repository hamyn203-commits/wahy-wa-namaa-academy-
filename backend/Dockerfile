FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

USER node

CMD ["node", "server.js"]
