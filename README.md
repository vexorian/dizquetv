# dizqueTV 0.0.69-prerelease
![Discord](https://img.shields.io/discord/711313431457693727?logo=discord&logoColor=fff&style=flat-square) ![GitHub top language](https://img.shields.io/github/languages/top/vexorian/dizquetv?logo=github&style=flat-square) ![Docker Pulls](https://img.shields.io/docker/pulls/vexorian/dizquetv?logo=docker&logoColor=fff&style=flat-square)

Create live TV channel streams from media on your Plex servers.

dizqueTV is a fork of the project previously-known as [pseudotv-plex](https://gitlab.com/DEFENDORe/pseudotv-plex) or [pseudotv](https://github.com/DEFENDORe/pseudotv). New repository because of lack of activity from the main repository and the name change is because projects with the old name already existed and were created long before this approach and it was causing confusion. You can migrate from pseudoTV 0.0.51 to dizqueTV by renaming the .pseudotv folder to .dizquetv and running the new executable (or doing a similar trick with the volumes used by the docker containers).

<img src="./resources/dizquetv.png" width="200">

Configure your channels, programs, commercials and settings using the dizqueTV web UI.

Access your channels by adding the spoofed dizqueTV HDHomerun tuner to Plex, or utilize the M3U Url with any 3rd party app.

EPG (Guide Information) data is stored to `.dizquetv/xmltv.xml`

## Features
- TV Channels are made available as an IPTV stream. There's a lot of IPTV clients and software that supports it.
- Ease of setup for xteve and Plex playback by mocking a HDHR server.
- Centralized server instance so that you need only configure your channels once.
- Customize your TV channels' programming including the specific air times.
- Supports multiple channels all available through a XMLTV tv guide.
- Docker image and prepackage binaries for Windows, Linux and Mac
- Web UI for channel configuration and app settings
- Select media (desired programs and commercials) across multiple Plex servers
- Sign into your Plex servers using any sign in method (Username, Email, Google, Facebook, etc.)
- Ability to auto update Plex DVR guide data and channel mappings
- Auto update the xmltv.xml file at a set interval (in hours). You can also set the amount EPG cache (in hours).
- Continuous playback support
- Media track selection (video, audio, subtitle). (subtitles disabled by default)
- Subtitle support.
- Ability to overlay channel icon over stream
- Auto deinterlace any Plex media not marked `"scanType": "progressive"`
- Can be configured to completely force Direct play.
- Can normalize video formats to prevent stream breaking.

## Limitations

- Plex Pass is required to unlock Plex Live TV/DVR feature
- Only one EPG source can be used with Plex server. This may cause an issue if you are adding the dizquetv tuner to a Plex server with Live TV/DVR already enabled/configured.

  * There are projects like xteve that allow you to unify multiple EPG sources into a single list which Plex can use.

- dizqueTV does not currently watch your Plex server for media updates/changes. You must manually remove and readd your programs for any changes to take effect. Same goes for Plex server changes (changing IP, port, etc).. all media will fail..
- Many IPTV players (including Plex) will break after switching episodes if video / audio format is too different between. dizqueTV can  be configured to use ffmpeg transcoding to prevent htis, but that costs resources. This is an intrinsic issue with the IPTV approach.
- Plex's IPTV player will be always recording the stream's playback for the purposes of allowing you to pause or rewind the stream. This is not necessarily an issue with other IPTV players.


## Useful Tips/Info

- dizqueTV can use both Plex and ffmpeg transcoding. Plex transcoding is advantageous in that there's access for many more features and formats than would be available.
- Audio track and subtitle choice depends on Plex configuraiton for that video/episode and user.
- Subtitles are transcoded by Plex before being delivered to dizqueTV.
- Can be configured to force a direct stream both from Plex and dizqueTV's side.
- Playing many different kinds of formats and resolutions in the same stream does ntpossible without transcoding them. So unless you are certain that all formats used in the same channel will be identical, your life will be easier if you let ffmpeg be used for normalization.
- If normalization is too heavy, try utilizing your hardware's transcoding features by picking the correct encoder in FFMPEG settings. *Note that some encoders may not be capable of handling every transcoding scenario, libx264 and mpeg2video seem to be the most stable.*
    - Intel Quick Sync: `h264_qsv`, `mpeg2_qsv`
    - NVIDIA GPU: `h264_nvenc`
    - MPEG2 `mpeg2video`
    - H264 `libx264` (default)
    - MacOS `h264_videotoolbox`
    - **Enable the option to log ffmpeg's stderr output directly to the dizquetv app console, for detecting issues**
- Host your own images for channel icons, program icons, etc.. Simply add your image to `.dizquetv/images` and reference them via `http://dizquetv-ip:8000/images/myImage.png`
- Use the Block Shuffle feature to play a specified number of TV episodes before advancing to the next available TV show in the channel. You can also specify to randomize the TV Show order. Any movies added to the channel will be pushed to the end of the program lineup, this is also applicable the "Sort TV Shows" option.
- Plex is smart enough not to open another stream if it currently is being viewed by another user. This allows only one transcode session for mulitple viewers if they are watching the same channel.
- Use the tools menu in the channel editor to access a lot of features to process your channel's programming, such as shuffling.
- Flex time is a useful feature that allows you to configure breaks between TV shows that play random content. This is useful if you want to simulate "commercials". A frequent use case is to use this filler to pad the starting times of TV shows (so that all TV shows start at :00 or :30 times, for example.
- Even if your Plex server is running on the same machine as the dizqueTV app, use your network address (not a loopback) when configuring your Plex Server(s) in the web UI.

## Installation

* *If you were a pseudotv user, please rename your old `.pseudotv` to `.dizquetv` before running. dizque tv will attempt to migrate your settings and channels to the new features.*

Unless your are using Docker/Unraid, you must download and install **ffmpeg** to your system and set the correct path in the dizqueTV Web UI.

By default, dizquetv will create the directory `.dizquetv` wherever dizquetv is launched from. Your `xmltv.xml` file and config databases are stored here.

#### Binary Release
[Download](https://github.com/vexorian/dizquetv/releases) and run the dizqueTV executable (argument defaults below)
```
./dizquetv-win-x64.exe --port 8000 --database ./dizquetv
```

#### Docker

The Docker repository can be viewed [here](https://hub.docker.com/r/vexorian/dizquetv).

Use Docker to fetch dizqueTV, then run the container.. (replace `C:\.dizquetv` with your desired config directory location)
```
docker pull vexorian/dizquetv:latest
docker run --name dizquetv -p 8000:8000 -v C:\.dizquetv:/home/node/app/.dizquetv vexorian/dizquetv:latest
```

If you were a pseudotv user, make sure to stop the pseudotv container and use the same folder you used for configuration in pseudotv as configuration for dizquetv.

#### Unraid

Template Repository: [https://github.com/vexorian/dizquetv/tree/main](https://github.com/vexorian/dizquetv/tree/main)


#### Building Docker image from source

Build docker image from source and run the container. (replace `C:\.dizquetv` with your desired config directory location)

```
git clone https://github.com/vexorian/dizquetv
cd dizquetv
git checkout version
#replace version with the version you want

docker build -t dizquetv .
docker run --name dizquetv -p 8000:8000 -v C:\.dizquetv:/home/node/app/.dizquetv dizquetv
```

#### Unraid Install
Add
```
https://github.com/vexorian/dizquetv/tree/main
```
to your "Template repositories" in the Docker tab.
Click the "Add Container" button
Select either the dizquetv template or the dizquetv-nvidia template if you want nvidia hardware accelerated transcoding.
Make sure you have the Unraid Nvidia plugin installed and change your video encoder to h264_nvenc in the dizquetv ffmpeg settings.

#### From Source

Install NodeJS and FFMPEG

```
git clone https://github.com/vexorian/dizquetv
cd dizquetv
npm install
npm run build
npm run start
```

## Plex Setup

Add the dizqueTV spoofed HDHomerun tuner to Plex via Plex Settings.

If the tuner isn't automatically listed, manually enter the network address of dizquetv. Example:
```
127.0.0.1:8000
```

When prompted for a Postal/Zip code, click the `"Have an XMLTV guide on your server? Click here to use that instead."` link.

Enter the location of the `.dizquetv/xmltv.xml` file. Example (Windows):
```
C:\.dizquetv\xmltv.xml
```

**Do not use the Web UI XMLTV URL when feeding Plex the xmltv.xml file. Plex fails to update it's EPG from a URL for some reason (at least on Windows). Use the local file path to `.dizquetv/xmltv.xml`**

## App Preview
<img src="./docs/channels.png" width="500">
<br/>
<img src="./docs/channel-config.png" width="500">
<br/>
<img src="./docs/plex-guide.png" width="500">
<br/>
<img src="./docs/plex-stream.png" width="500">

## Development
Building/Packaging Binaries: (uses `browserify`, `babel` and `pkg`)
```
npm run build
npm run compile
npm run package
```

Live Development: (using `nodemon` and `watchify`)
```
npm run dev-client
npm run dev-server
```
