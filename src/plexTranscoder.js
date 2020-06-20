const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class PlexTranscoder {
    constructor(settings, lineupItem) {
        this.session = uuidv4()

        this.settings = settings

        this.log("Plex transcoder initiated")
        this.log("Debug logging enabled")

        this.key = lineupItem.key
        this.plexFile = `${lineupItem.server.uri}${lineupItem.plexFile}?X-Plex-Token=${lineupItem.server.accessToken}`
        this.file = lineupItem.file.replace(settings.pathReplace, settings.pathReplaceWith)
        this.transcodeUrlBase = `${lineupItem.server.uri}/video/:/transcode/universal/start.m3u8?`
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

    async getStream(deinterlace) {
        let stream = {directPlay: false}

        this.log("Getting stream")
        this.log(`  deinterlace:     ${deinterlace}`)
        this.log(`  streamPath:      ${this.settings.streamPath}`)
        this.log(`  forceDirectPlay: ${this.settings.forceDirectPlay}`)

        // direct play forced
        if (this.settings.streamPath === 'direct' || this.settings.forceDirectPlay) {
            this.log("Direct play forced or native paths enabled")
            stream.directPlay = true
            this.setTranscodingArgs(stream.directPlay, true, false)
            // Update transcode decision for session
            await this.getDecision(stream.directPlay);
            stream.streamUrl = (this.settings.streamPath === 'direct') ? this.file : this.plexFile;
        } else { // Set transcoding parameters based off direct stream params
            this.log("Setting transcoding parameters")
            this.setTranscodingArgs(stream.directPlay, true, deinterlace)

            await this.getDecision(stream.directPlay);

            if (this.isDirectPlay()) {
                this.log("Decision: File can direct play")
                stream.directPlay = true
                this.setTranscodingArgs(stream.directPlay, true, false)
                // Update transcode decision for session
                await this.getDecision(stream.directPlay);
                stream.streamUrl = this.plexFile;
            } else if (this.isVideoDirectStream() === false) {
                this.log("Decision: File can direct play")
                // Change transcoding arguments to be the user chosen transcode parameters
                this.setTranscodingArgs(stream.directPlay, false, deinterlace)
                // Update transcode decision for session
                await this.getDecision(stream.directPlay);
                stream.streamUrl = `${this.transcodeUrlBase}${this.transcodingArgs}`
            } else {
                this.log("Decision: Direct stream. Audio is being transcoded")
                stream.streamUrl = `${this.transcodeUrlBase}${this.transcodingArgs}`
            }
        }

        stream.streamStats = this.getVideoStats();

        // use correct audio stream if direct play
        let audioIndex = await this.getAudioIndex();
        stream.streamStats.audioIndex = (stream.directPlay) ? audioIndex : 'a'

        this.log(stream)

        return stream
    }

    setTranscodingArgs(directPlay, directStream, deinterlace) {   
        let resolution = (directStream) ? this.settings.maxPlayableResolution : this.settings.maxTranscodeResolution
        let bitrate = (directStream) ? this.settings.directStreamBitrate : this.settings.transcodeBitrate
        let mediaBufferSize = (directStream) ? this.settings.mediaBufferSize : this.settings.transcodeMediaBufferSize
        let subtitles = (this.settings.enableSubtitles) ? "burn" : "none" // subtitle options: burn, none, embedded, sidecar
        let streamContainer = "mpegts" // Other option is mkv, mkv has the option of copying it's subs for later processing
        let isDirectPlay = (directPlay) ? '1' : '0'
        
        let videoQuality=`100` // Not sure how this applies, maybe this works if maxVideoBitrate is not set
        let profileName=`Generic` // Blank profile, everything is specified through X-Plex-Client-Profile-Extra
        
        let resolutionArr = resolution.split("x")

        let clientProfile=`add-transcode-target(type=videoProfile&protocol=${this.settings.streamProtocol}&container=${streamContainer}&videoCodec=${this.settings.videoCodecs}&audioCodec=${this.settings.audioCodecs}&subtitleCodec=&context=streaming&replace=true)+\
add-transcode-target-settings(type=videoProfile&context=streaming&protocol=${this.settings.streamProtocol}&CopyMatroskaAttachments=true)+\
add-transcode-target-settings(type=videoProfile&context=streaming&protocol=${this.settings.streamProtocol}&BreakNonKeyframes=true)+\
add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.width&value=${resolutionArr[0]})+\
add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.height&value=${resolutionArr[1]})`
    
        // Set transcode settings per audio codec
        this.settings.audioCodecs.split(",").forEach(function (codec) {
            clientProfile+=`+add-transcode-target-audio-codec(type=videoProfile&context=streaming&protocol=${this.settings.streamProtocol}&audioCodec=${codec})`
            if (codec == "mp3") {
                clientProfile+=`+add-limitation(scope=videoAudioCodec&scopeName=${codec}&type=upperBound&name=audio.channels&value=2)`
            } else {
                clientProfile+=`+add-limitation(scope=videoAudioCodec&scopeName=${codec}&type=upperBound&name=audio.channels&value=${this.settings.maxAudioChannels})`
            }
          }.bind(this));

        // deinterlace video if specified, only useful if overlaying channel logo later
        if (deinterlace == true) {
            clientProfile+=`+add-limitation(scope=videoCodec&scopeName=*&type=notMatch&name=video.scanType&value=interlaced)`
        }

        let clientProfile_enc=encodeURIComponent(clientProfile)
        this.transcodingArgs=`X-Plex-Platform=${profileName}&\
X-Plex-Client-Platform=${profileName}&\
X-Plex-Client-Profile-Name=${profileName}&\
X-Plex-Platform=${profileName}&\
X-Plex-Token=${this.server.accessToken}&\
X-Plex-Client-Profile-Extra=${clientProfile_enc}&\
protocol=${this.settings.streamProtocol}&\
Connection=keep-alive&\
hasMDE=1&\
path=${this.key}&\
mediaIndex=0&\
partIndex=0&\
fastSeek=1&\
directPlay=${isDirectPlay}&\
directStream=1&\
directStreamAudio=1&\
copyts=1&\
audioBoost=${this.settings.audioBoost}&\
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
        try {
            return this.getVideoStats().videoDecision === "copy";
        } catch (e) {
            console.log("Error at decision:" + e);
            return false;
        }
    }

    isDirectPlay() {
        try {
            return this.getVideoStats().videoDecision === "copy" && this.getVideoStats().audioDecision === "copy";
        } catch (e) {
            console.log("Error at decision:" + e);
            return false;
        }
    }

    getVideoStats() {
        let ret = {}
        try {
            let streams = this.decisionJson.MediaContainer.Metadata[0].Media[0].Part[0].Stream

            streams.forEach(function (stream) {
                // Video
                if (stream["streamType"] == "1") {
                    ret.videoCodec = stream.codec;
                    ret.videoWidth = stream.width;
                    ret.videoHeight = stream.height;
                    ret.videoFramerate = Math.round(stream["frameRate"]);
                    // Rounding framerate avoids scenarios where
                    // 29.9999999 & 30 don't match.
                    ret.videoDecision = (typeof stream.decision === 'undefined') ? 'copy' : stream.decision;
                }
                // Audio. Only look at stream being used
                if (stream["streamType"] == "2" && stream["selected"] == "1") {
                    ret.audioChannels = stream["channels"];
                    ret.audioCodec = stream["codec"];
                    ret.audioDecision = (typeof stream.decision === 'undefined') ? 'copy' : stream.decision;
                }
            })
        } catch (e) {
            console.log("Error at decision:" + e);
        }

        this.log("Current video stats:")
        this.log(ret)

        return ret
    }

    async getAudioIndex() {
        let index = 'a'

        await axios.get(`${this.server.uri}${this.key}?X-Plex-Token=${this.server.accessToken}`, {
            headers: { Accept: 'application/json' }
        })
        .then((res) => {
            this.log(res.data)
            try {
                let streams = res.data.MediaContainer.Metadata[0].Media[0].Part[0].Stream

                streams.forEach(function (stream) {
                    // Audio. Only look at stream being used
                    if (stream["streamType"] == "2" && stream["selected"] == "1") {
                        index = stream.index
                    }
                })
            } catch (e) {
                console.log("Error at get media info:" + e);
            }
        })
        .catch((err) => {
            console.log(err);
        });

        this.log(`Found audio index: ${index}`)

        return index
    }

    async getDecision(directPlay) {
        await axios.get(`${this.server.uri}/video/:/transcode/universal/decision?${this.transcodingArgs}`, {
            headers: { Accept: 'application/json' }
        })
        .then((res) => {
            this.decisionJson = res.data;

            this.log("Recieved transcode decision:")
            this.log(res.data)

            // Print error message if transcode not possible
            // TODO: handle failure better
            let transcodeDecisionCode = res.data.MediaContainer.transcodeDecisionCode
            if (!(directPlay || transcodeDecisionCode == "1001")) {
                console.log(`IMPORTANT: Recieved transcode decision code ${transcodeDecisionCode}! Expected code 1001.`)
                console.log(`Error message: '${res.data.MediaContainer.transcodeDecisionText}'`)
            }
        })
        .catch((err) => {
            console.log(err);
        });
    }

    getStatusUrl() {
        let profileName=`Generic`;

        let containerKey=`/video/:/transcode/universal/decision?${this.transcodingArgs}`;
        let containerKey_enc=encodeURIComponent(containerKey);

        let statusUrl=`${this.server.uri}/:/timeline?\
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
X-Plex-Token=${this.server.accessToken}`;

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
        this.log("Updating plex status")
        axios.post(this.getStatusUrl());
        this.currTimeMs += this.updateInterval;
        if (this.currTimeMs > this.duration) {
            this.currTimeMs = this.duration;
        }
        this.currTimeS = this.duration / 1000;
    }

    log(message) {
        if (this.settings.debugLogging) {
            console.log(message)
        }
    }
}

module.exports = PlexTranscoder
