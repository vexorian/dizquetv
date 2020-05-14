This is a fork from the official gitlab at https://gitlab.com/DEFENDORe/pseudotv-plex


# pseudotv-plex

PseudoTV is a Plex DVR plugin. It allows you to host your own fake live tv service by dynamically streaming media from your Plex servers(s). Your channels and settings are all manged throught the PseudoTV Web UI.

PseudoTV will show up as a HDHomeRun device within Plex. When configuring your Plex Tuner, simply use the generatered `./.pseudotv/xmltv.xml` file for EPG data. PseudoTV will automatically refresh your Plex server's EPG data and channel mappings (if specified to do so in settings) when configuring channels via the Web UI. Ensure your FFMPEG path is set correctly via the Web UI, and enjoy!

## Features
- Docker support and prepackage binaries for Windows, Linux and Mac
- Web UI for channel configuration and app settings
- Select media across multiple Plex servers
- Ability to auto update Plex EPG and channel mappings
- Auto Update the xmltv.xml file at a set interval (in hours). You can also set the amount EPG cache (in hours).
- Continuous playback support
- Commercial support
- Media track selection (video, audio, subtitle)
- Subtitle Support (some subtitle formats may cause a delay when starting an ffmpeg session)
    - Internal Subs Supported
        - ASS (slow, I would avoid unless you got a bitchin cpu)
        - SRT (slow, I would avoid unless you got a bitchin cpu)
        - PGS (fast)
    - External Subs Supported
        - ASS (moderate)
        - SRT (moderate)
- Ability to overlay channel icon over stream
- Auto deinterlace any Plex media not marked `"scanType": "progressive"`

## Recent Bug Fixes and Notes
- Removed FFPROBE requirment. Use Plex API for stream selection
- Fixed issue with bulk imports fucking up season, episode order
- Fixed an issue where Safari (and probably other browsers) couldn't load the web UI fully.
- Plex accounts linked to google, facebook, etc can now sign in
- PseudoTV will now host a dummy channel (Channel 1) when no channels configured. This makes setup a bit easier, no longer have to create a channel first..
- No longer required to specify host address. I'm a fucking idiot and made shit more complicated than it needed to be. `channels.m3u` and `lineup.json` will now generate URLs based on the incoming http request.
- Removed --host, and --xmltv arguments altogether
- Added channel/app info to ts stream

## Useful Tips

- Internal SRT/ASS subtitle may cause a delay when starting stream
- Utilize your hardware accelerated encoders, or use mpeg2 instead of h264 by changing the default video encoder in FFMPEG settings. *Note that some encoders may not be capable of handling every transcoding scenario, libx264 and mpeg2video seem to be the most stable.*
    - Intel Quick Sync: `h265_qsv`, `mpeg2_qsv`
    - NVIDIA GPU: `h264_nvenc`
    - MPEG2 `mpeg2video`
    - H264 `libx264` (default)
- Host your own images for channel icons, program icons, etc.. Simply add your image to `.pseudotv/images` and reference them via `http://pseudotv-ip:8000/images/myImage.png`

## Installation

*Please delete your old `.pseudotv` directory before using the new version. I'm sorry but it'd take more effort than its worth to convert the old databases..*

Unless your are using the Docker image, you must download and install **ffmpeg** to your system and set the correct path in the PseudoTV Web UI.

By default, pseudotv will create the directory `.pseudotv` wherever pseudotv is launched from. Your `xmltv.xml` file and config databases are stored here. An M3U can also be downloaded via the Web UI (useful if using xTeVe).

**Do not use the Web UI XMLTV URL when feeding Plex the xmltv.xml file. Plex fails to update it's EPG from a URL for some reason (at least on Windows). Use the local file path to `.pseudotv/xmltv.xml`**

#### Binary Release
[Download](https://gitlab.com/DEFENDORe/pseudotv-plex/-/releases) and run the PseudoTV executable (argument defaults below)
```
./pseudotv-win.exe --port 8000 --database ./pseudotv
```

#### Docker Image
```
git clone https://gitlab.com/DEFENDORe/pseudotv-plex.git
cd pseudotv-plex
docker build -t pseudotv .
docker run --name pseudotv -p 8000:8000 -v C:\.pseudotv:/home/node/app/.pseudotv pseudotv
```

#### Unraid Install
Add
```
https://github.com/DEFENDORe/pseudotv
```
to your "Template repositories" in the Docker tab.
Click the "Add Container" button
Select either the pseudotv template or the pseudotv-nvidia template if you want nvidia hardware accelerated transcoding.
Make sure you have the Unraid Nvidia plugin installed and change your video encoder to h264_nvenc in the pseudotv ffmpeg settings.

#### Source
```
git clone https://gitlab.com/DEFENDORe/pseudotv-plex.git
cd pseudotv-plex
npm install
npm run build
npm run start
```

## Development
Building Binaries: (uses `babel` and `pkg`)
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
