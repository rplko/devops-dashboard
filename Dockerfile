FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install -g pm2
RUN npm install
RUN mkdir -p /app/logs
RUN echo "forced rebuild"
COPY . .

EXPOSE 3000

CMD ["pm2-runtime", "server.js"]
