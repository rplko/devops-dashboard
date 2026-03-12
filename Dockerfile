FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install
RUN apt-get update && apt-get install -y docker.io

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
