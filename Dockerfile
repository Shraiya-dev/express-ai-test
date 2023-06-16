FROM node:alpine

COPY . ./app

WORKDIR /app

RUN npm install --omit=dev

EXPOSE 3000

CMD ["npm", "run", "start"]
