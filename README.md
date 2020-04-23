# pseudotv-plex

Create your own Live TV channels from media on your Plex Server(s).

Simply create your Channels, add the PseudoTV tuner to Plex, and enjoy your fake TV service.

## How it works

FFMPEG is used to transcode media on the fly to MPEG2/AC3 mpegts streams (with constant bitrate, resolution, framerate). Cool thing about the MPEG2 codec and MPEGTS format is that files can be concatenated together without messing up the file structure. This allows PseudoTV to support continous playback and commercials without having Plex trip balls when a new video segment is hit.

## Features

- Web UI for channel configuration and app settings
- Select media across multiple Plex servers
- Ability to auto update Plex EPG and channel mappings
- Continuous playback support
- Commercial support
- Docker and prepackage binaries for Windows, Linux and Mac

## Release Notes
- Channels are now created through the Web UI
- Plex Transcoding is disabled (media timeline updates are disabled too). If anybody can figure out how to get Plex to transcode to MPEG2, let me know.. If Plex could transcode to MPEG2/MPEGTS then we might not even need FFMPEG.
- Previous versions of pseudotv (I think it was the first build) had a bug where everytime the app was restarted, a new client ID was registered with Plex. Plex would fill up with authorized devices and in some case would crash Plex Server or cripple performance. Please check your authorized devices in Plex and clean up any PseudoTV duplicates. I'm sorry I didn't spot this sooner, this may be a headache cleaning up.
- Fixed the HDHR tuner count. You can now set the number of tuners availble to Plex.

## Installation

Unless your are using the Docker image, you must download and install **ffmpeg** to your system and set the correct path in the Web UI.

By default, pseudotv will create a directory (`.pseudotv`) where the app was lauched. Your xmltv.xml file and pseudotv databases are stored here.

**Do not use a URL when feeding Plex the xmltv.xml file, Plex fails to update it's EPG from a URL for some reason (at least on Windows)**

#### Binary Release
Download and run the PseudoTV executable (argument defaults below)
```
./pseudotv-win.exe --host 127.0.0.1 --port 8000 --database ./pseudotv --xmltv ./pseudotv/xmltv.xml
```
Use the WebUI to provide PseudoTV the path to FFMPEG

#### Docker Image
```
cd pseudotv-plex
docker build -t pseudotv .
docker run --name pseudotv -p 8000:8000 -v C:\.pseudotv:/home/node/app/.pseudotv pseudotv 
```

#### Source
```
cd pseudotv-plex
npm install
npm run build
npm run start
```



## Development
Building Binaries:
```
cd pseudotv-plex
npm install
npm run build
npm run compile
npm run package
```

Live Development:
```
cd pseudotv-plex
npm run dev-client
npm run dev-server
```