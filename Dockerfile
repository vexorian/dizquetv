FROM node:12.16
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install -g browserify
RUN npm run build
RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg
EXPOSE 8000
CMD [ "npm", "start"]
