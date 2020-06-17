FROM node:12.18-alpine3.12
# Should be ffmpeg v4.2.3
RUN apk add --no-cache ffmpeg && ffmpeg -version
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
RUN npm install -g browserify
EXPOSE 8000
CMD [ "npm", "start"]
COPY . .
RUN npm run build
