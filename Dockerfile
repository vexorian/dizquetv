FROM node:12.18-alpine3.12
# Should be ffmpeg v4.2.3
RUN apk add --no-cache ffmpeg && ffmpeg -version

# Remove the previous line and uncommenting the following lines will allow the
# ffmpeg version to support draw_text filter, but it makes the docker build take
# a long time and it's only used for minor features at the moment.
#RUN apk add --update \
#  curl yasm build-base gcc zlib-dev libc-dev openssl-dev yasm-dev lame-dev libogg-dev x264-dev libvpx-dev libvorbis-dev x265-dev freetype-dev libass-dev libwebp-dev rtmpdump-dev libtheora-dev opus-dev && \
#  DIR=$(mktemp -d) && cd ${DIR} && \
#  curl -s http://ffmpeg.org/releases/ffmpeg-4.2.3.tar.gz | tar zxvf - -C . && \
#  cd ffmpeg-4.2.3 && \
#  ./configure \
#  --enable-version3 \
#  --enable-gpl \
#  --enable-nonfree \
#  --enable-small \
#  --enable-libmp3lame \
#  --enable-libx264 \
#  --enable-libx265 \
#  --enable-libvpx \
#  --enable-libtheora \
#  --enable-libvorbis \
#  --enable-libopus \
#  --enable-libass \
#  --enable-libwebp \
#  --enable-librtmp \
#  --enable-postproc \
#  --enable-avresample \
#  --enable-libfreetype \
#  --enable-openssl \
#  --enable-filter=drawtext \
#  --disable-debug && \
#  make && \
#  make install && \
#  make distclean && \
#  rm -rf ${DIR} && \
#  mv /usr/local/bin/ffmpeg /usr/bin/ffmpeg && \
#  apk del build-base curl tar bzip2 x264 openssl nasm openssl xz gnupg && rm -rf /v
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
RUN npm install -g browserify
EXPOSE 8000
CMD [ "npm", "start"]
COPY . .
RUN npm run build
