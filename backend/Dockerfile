FROM node:24.20.0-bookworm
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY dist ./dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
