const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

class PlexTranscoder {
    constructor(settings, lineupItem) {
        this.session = uuidv4()

        this.settings = settings

        this.key = lineupItem.key
        this.ratingKey = lineupItem.ratingKey
        this.currTimeMs = lineupItem.start
        this.currTimeS = this.currTimeMs / 1000
        this.duration = lineupItem.duration
        this.server = lineupItem.server

        this.transcodingArgs = undefined
        this.decisionJson = undefined

        this.updateInterval = 30000
        this.updatingPlex = undefined
        this.playState = "stopped"
    }

    async getStreamUrl(deinterlace) {
        // Set transcoding parameters based off direct stream params
        this.setTranscodingArgs(true, deinterlace)

        await this.getDecision();
        const videoIsDirectStream = this.isVideoDirectStream();

        // Change transcoding arguments to be the user chosen transcode parameters
        if (videoIsDirectStream == false) {
            this.setTranscodingArgs(false, deinterlace)
             // Update transcode decision for session
             await this.getDecision();
        }

        return `${this.server.protocol}://${this.server.host}:${this.server.port}/video/:/transcode/universal/start.m3u8?${this.transcodingArgs}`
    }

    setTranscodingArgs(directStream, deinterlace) {   
        let resolution = (directStream == true) ? this.settings.maxPlayableResolution : this.settings.maxTranscodeResolution
        let bitrate = (directStream == true) ? this.settings.directStreamBitrate : this.settings.transcodeBitrate
        let videoCodecs = (this.settings.enableHEVC == true) ? "h264,hevc" : "h264"
        let subtitles = (this.settings.enableSubtitles == true) ? "burn" : "none" // subtitle options: burn, none, embedded, sidecar
        
        let videoQuality=`100` // Not sure how this applies, maybe this works if maxVideoBitrate is not set
        let audioBoost=`100` // only applies when downmixing to stereo I believe, add option later?
        let mediaBufferSize=`30720` // Not sure what this should be set to
        let profileName=`Generic` // Blank profile, everything is specified through X-Plex-Client-Profile-Extra
        
        let resolutionArr = resolution.split("x")

        let clientProfileHLS=`add-transcode-target(type=videoProfile&protocol=hls&container=mpegts&videoCodec=${videoCodecs}&audioCodec=${this.settings.audioCodecs}&subtitleCodec=&context=streaming&replace=true)+\
add-transcode-target-settings(type=videoProfile&context=streaming&protocol=hls&CopyMatroskaAttachments=true)+\
add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.width&value=${resolutionArr[0]})+\
add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.height&value=${resolutionArr[1]})`
    
        // Set transcode settings per audio codec
        this.settings.audioCodecs.split(",").forEach(function (codec) {
            clientProfileHLS+=`+add-transcode-target-audio-codec(type=videoProfile&context=streaming&protocol=hls&audioCodec=${codec})`
            if (codec == "mp3") {
                clientProfileHLS+=`+add-limitation(scope=videoAudioCodec&scopeName=${codec}type=upperBound&name=audio.channels&value=2)`
            } else {
                clientProfileHLS+=`+add-limitation(scope=videoAudioCodec&scopeName=${codec}type=upperBound&name=audio.channels&value=${this.settings.maxAudioChannels})`
            }
          }.bind(this));

        // deinterlace video if specified, only useful if overlaying channel logo later
        if (deinterlace == true) {
            clientProfileHLS+=`+add-limitation(scope=videoCodec&scopeName=*&type=notMatch&name=video.scanType&value=interlaced)`
        }

        let clientProfileHLS_enc=encodeURIComponent(clientProfileHLS)
        this.transcodingArgs=`X-Plex-Platform=${profileName}&\
X-Plex-Client-Platform=${profileName}&\
X-Plex-Client-Profile-Name=${profileName}&\
X-Plex-Platform=${profileName}&\
X-Plex-Token=${this.server.token}&\
X-Plex-Client-Profile-Extra=${clientProfileHLS_enc}&\
protocol=hls&\
Connection=keep-alive&\
hasMDE=1&\
path=${this.key}&\
mediaIndex=0&\
partIndex=0&\
fastSeek=1&\
directPlay=0&\
directStream=1&\
directStreamAudio=1&\
copyts=1&\
audioBoost=${audioBoost}&\
mediaBufferSize=${mediaBufferSize}&\
session=${this.session}&\
offset=${this.currTimeS}&\
subtitles=${subtitles}&\
subtitleSize=${this.settings.subtitleSize}&\
maxVideoBitrate=${bitrate}&\
videoQuality=${videoQuality}&\
videoResolution=${resolution}&\
lang=en`
    }

    isVideoDirectStream() {
        return this.decisionJson["MediaContainer"]["Metadata"][0]["Media"][0]["Part"][0]["Stream"][0]["decision"] == "copy";
    }

    getResolutionHeight() {
        return this.decisionJson["MediaContainer"]["Metadata"][0]["Media"][0]["Part"][0]["Stream"][0]["height"];
    }

    getVideoStats(channelIconEnabled, ffmpegEncoderName) {
        let ret = []
        let streams = this.decisionJson["MediaContainer"]["Metadata"][0]["Media"][0]["Part"][0]["Stream"]

        streams.forEach(function (stream) {
            // Video
            if (stream["streamType"] == "1") {
                ret.push(stream["width"],
                    stream["height"],
                    Math.round(stream["frameRate"])) 
                    // Rounding framerate avoids scenarios where
                    // 29.9999999 & 30 don't match. Probably close enough
                    // to continue the stream as is.

                // Implies future transcoding
                if (channelIconEnabled == true)
                    if (ffmpegEncoderName.includes('mpeg2'))
                        ret.push("mpeg2video")
                    else if (ffmpegEncoderName.includes("264"))
                        ret.push("h264")
                    else if (ffmpegEncoderName.includes("hevc") || ffmpegEncoderName.includes("265"))
                        ret.push("hevc") 
                    else
                        ret.push("unknown")
                else
                    ret.push(stream["codec"])
            }
            // Audio. Only look at stream being used
            if (stream["streamType"] == "2" && stream["selected"] == "1")
                ret.push(stream["channels"], stream["codec"])
        })

        return ret
    }

    async getDecision() {
        const response = await fetch(`${this.server.protocol}://${this.server.host}:${this.server.port}/video/:/transcode/universal/decision?${this.transcodingArgs}`, { 
            method: 'GET', headers: {
                Accept: 'application/json'
            }
        });
        this.decisionJson = await response.json();
    }

    getStatusUrl() {
        let profileName=`Generic`;

        let containerKey=`/video/:/transcode/universal/decision?${this.transcodingArgs}`;
        let containerKey_enc=encodeURIComponent(containerKey);

        let statusUrl=`${this.server.protocol}://${this.server.host}:${this.server.port}/:/timeline?\
containerKey=${containerKey_enc}&\
ratingKey=${this.ratingKey}&\
state=${this.playState}&\
key=${this.key}&\
time=${this.currTimeMs}&\
duration=${this.duration}&\
X-Plex-Platform=${profileName}&\
X-Plex-Client-Platform=${profileName}&\
X-Plex-Client-Profile-Name=${profileName}&\
X-Plex-Device-Name=PseudoTV-Plex&\
X-Plex-Device=PseudoTV-Plex&\
X-Plex-Client-Identifier=${this.session}&\
X-Plex-Platform=${profileName}&\
X-Plex-Token=${this.server.token}`;

        return statusUrl;
    }

    startUpdatingPlex() {
        if (this.settings.updatePlayStatus == true) {
            this.playState = "playing";
            this.updatePlex(); // do initial update
            this.updatingPlex = setInterval(this.updatePlex.bind(this), this.updateInterval);
        }
    }

    stopUpdatingPlex() {
        if (this.settings.updatePlayStatus == true) {
            clearInterval(this.updatingPlex);
            this.playState = "stopped";
            this.updatePlex();
        }
    }

    updatePlex() {
        let postUrl = this.getStatusUrl();
        fetch(postUrl, { 
            method: 'POST'
        });
        this.currTimeMs += this.updateInterval;
        if (this.currTimeMs > this.duration) {
            this.currTimeMs = this.duration;
        }
        this.currTimeS = this.duration / 1000;
    }
}

module.exports = PlexTranscoder
