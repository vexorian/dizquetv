const spawn = require('child_process').spawn
const events = require('events')

//they can customize this by modifying the picture in .pseudotv folder
const ERROR_PICTURE_PATH = 'http://localhost:8000/images/generic-error-screen.png'

const MAXIMUM_ERROR_DURATION_MS = 60000;

class FFMPEG extends events.EventEmitter {
    constructor(opts, channel) {
        super()
        this.opts = opts
        this.channel = channel
        this.ffmpegPath = opts.ffmpegPath

        var parsed = parseResolutionString(opts.targetResolution);
        this.wantedW = parsed.w;
        this.wantedH = parsed.h;

        this.sentData = false;
        this.alignAudio = this.opts.alignAudio;
        this.ensureResolution = this.opts.normalizeResolution;
        this.volumePercent =  this.opts.audioVolumePercent;
    }
    async spawnConcat(streamUrl) {
        this.spawn(streamUrl, undefined, undefined, undefined, false, false, undefined, true)
    }
    async spawnStream(streamUrl, streamStats, startTime, duration, enableIcon, type) {
        this.spawn(streamUrl, streamStats, startTime, duration, true, enableIcon, type, false);
    }
    async spawnError(title, subtitle, streamStats, enableIcon, type) {
        if (! this.opts.enableFFMPEGTranscoding || this.opts.errorScreen == 'kill') {
            console.log("error: " + title + " ; " + subtitle);
            this.emit('error', { code: -1, cmd: `error stream disabled` })
            return;
        }
        // since this is from an error situation, streamStats may have issues.
        if ( (streamStats == null) || (typeof(streamStats) === 'undefined') ) {
            streamStats = {};
        }
        streamStats.videoWidth = this.wantedW;
        streamStats.videoHeight = this.wantedH;
        if ( (typeof(streamStats.duration) === 'undefined') || isNaN(streamStats.duration) || (streamStats.duration > MAXIMUM_ERROR_DURATION_MS)  )  {
            // it's possible that whatever issue there was when attempting to download the video from plex
            // could be temporary, so it'd be better to retry after a minute
            streamStats.duration = MAXIMUM_ERROR_DURATION_MS;
        }
        this.spawn({ errorTitle: title , subtitle: subtitle }, streamStats, undefined, `${streamStats.duration}ms`, true, enableIcon, type, false)
    }
    async spawn(streamUrl, streamStats, startTime, duration, limitRead, enableIcon, type, isConcatPlaylist) {
        let ffmpegArgs = [
             `-threads`, this.opts.threads,
                          `-fflags`, `+genpts+discardcorrupt+igndts`];
        
        if (limitRead === true)
            ffmpegArgs.push(`-re`)
        

        if (typeof startTime !== 'undefined')
            ffmpegArgs.push(`-ss`, startTime)
        
        if (isConcatPlaylist == true)
            ffmpegArgs.push(`-f`, `concat`, 
                            `-safe`, `0`,
                            `-protocol_whitelist`, `file,http,tcp,https,tcp,tls`)

        // Map correct audio index. '?' so doesn't fail if no stream available.
        let audioIndex = (typeof streamStats === 'undefined') ? 'a' : `${streamStats.audioIndex}`;

        //TODO: Do something about missing audio stream
        if (!isConcatPlaylist) {
            // When we have an individual stream, there is a pipeline of possible
            // filters to apply.
            //
            var doOverlay = (enableIcon && type === 'program');
            var iW =  streamStats.videoWidth;
            var iH =  streamStats.videoHeight;

            // (explanation is the same for the video and audio streams)
            // The initial stream is called '[video]'
            var currentVideo = "[video]";
            var currentAudio = "[audio]";
            // Initially, videoComplex does nothing besides assigning the label
            // to the input stream
            var videoIndex = 'v';
            var audioComplex = `;[0:${audioIndex}]anull[audio]`;
            var videoComplex = `;[0:${videoIndex}]null[video]`;
            // Depending on the options we will apply multiple filters
            // each filter modifies the current video stream. Adds a filter to
            // the videoComplex variable. The result of the filter becomes the 
            // new currentVideo value.
            //
            // When adding filters, make sure that
            // videoComplex always begins wiht ; and doesn't end with ;

            // prepare input streams
            if ( typeof(streamUrl.errorTitle) !== 'undefined') {
                doOverlay = false; //never show icon in the error screen
                // for error stream, we have to generate the input as well
                this.alignAudio = false; //all of these generate audio correctly-aligned to video so there is no need for apad

                if (this.ensureResolution) {
                    //all of the error strings already choose the resolution to
                    //match iW x iH , so with this we save ourselves a second
                    // scale filter
                    iW = this.wantedW;
                    iH = this.wantedH;
                }

                ffmpegArgs.push("-r" , "24");
                if (this.opts.errorScreen == 'static') {
                    ffmpegArgs.push(
                        '-f', 'lavfi',
                        '-i', `nullsrc=s=64x36`);
                    videoComplex = `;geq=random(1)*255:128:128[videoz];[videoz]scale=${iW}:${iH}[videoy];[videoy]realtime[videox]`;
                } else if (this.opts.errorScreen == 'testsrc') {
                    ffmpegArgs.push(
                        '-f', 'lavfi',
                        '-i', `testsrc=size=${iW}x${iH}`,
                        '-pix_fmt' , 'yuv420p'
                    );
                    videoComplex = `;realtime[videox]`;
                } else if (this.opts.errorScreen == 'text') {
                    var sz2 = Math.ceil( (iH) / 33.0);
                    var sz1 = Math.ceil( sz2 * 3. / 2. );
                    var sz3 = 2*sz2;
                  
                    ffmpegArgs.push(
                        '-f', 'lavfi',
                        '-i', `color=c=black:s=${iW}x${iH}`
                    );

                    videoComplex = `;drawtext=fontfile=${process.env.DATABASE}/font.ttf:fontsize=${sz1}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${streamUrl.errorTitle}',drawtext=fontfile=${process.env.DATABASE}/font.ttf:fontsize=${sz2}:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+${sz3})/2:text='${streamUrl.subtitle}'[videoy];[videoy]realtime[videox]`;
                } else if (this.opts.errorScreen == 'blank') {
                    ffmpegArgs.push(
                        '-f', 'lavfi',
                        '-i', `color=c=black:s=${iW}x${iH}`
                    );
                    videoComplex = `;realtime[videox]`;
                } else {//'pic'
                    ffmpegArgs.push(
                        '-loop', '1',
                        '-i', `${ERROR_PICTURE_PATH}`,
                        '-pix_fmt' , 'yuv420p'
                    );
                    videoComplex = `;[0:0]scale=${iW}:${iH}[videoy];[videoy]realtime[videox]`;
                }
                let durstr = `duration=${streamStats.duration}ms`;
                if (this.opts.errorAudio == 'whitenoise') {
                    audioComplex = `;aevalsrc=-2+0.1*random(0):${durstr}[audioy]`;
                } else if (this.opts.errorAudio == 'sine') {
                    audioComplex = `;sine=f=440:${durstr}[audiox];[audiox]volume=-65dB[audioy]`;
                } else { //silent
                    audioComplex = `;aevalsrc=0:${durstr}[audioy]`;
                }
                audioComplex += ';[audioy]arealtime[audiox]';
                currentVideo = "[videox]";
                currentAudio = "[audiox]";
            } else {
                ffmpegArgs.push(`-i`, streamUrl);
            }
            if (doOverlay) {
                ffmpegArgs.push(`-i`, `${this.channel.icon}` );
            }

            // Resolution fix: Add scale filter, current stream becomes [siz]
            if (this.ensureResolution && (iW != this.wantedW || iH != this.wantedH) ) {
                //Maybe the scaling algorithm could be configurable. bicubic seems good though
                videoComplex += `;${currentVideo}scale=${this.wantedW}:${this.wantedH}:flags=bicubic:force_original_aspect_ratio=decrease,pad=${this.wantedW}:${this.wantedH}:(ow-iw)/2:(oh-ih)/2[siz]`
                currentVideo = "[siz]";
                iW = this.wantedW;
                iH = this.wantedH;
            }

            // Channel overlay:
            if (doOverlay) {
                if (process.env.DEBUG) console.log('Channel Icon Overlay Enabled')

                let posAry = [ '20:20', 'W-w-20:20', '20:H-h-20', 'W-w-20:H-h-20'] // top-left, top-right, bottom-left, bottom-right (with 20px padding)
                let icnDur = ''
    
                if (this.channel.iconDuration > 0)
                    icnDur = `:enable='between(t,0,${this.channel.iconDuration})'`
    
                videoComplex += `;[1:v]scale=${this.channel.iconWidth}:-1[icn];${currentVideo}[icn]overlay=${posAry[this.channel.iconPosition]}${icnDur}[comb]`
                currentVideo = '[comb]';
            }

            if (this.volumePercent != 100) {
                var f = this.volumePercent / 100.0;
                audioComplex += `;${currentAudio}volume=${f}[boosted]`;
                currentAudio = '[boosted]';
            }
            // Align audio is just the apad filter applied to audio stream
            if (this.alignAudio) {
                audioComplex += `;${currentAudio}apad=whole_dur=${streamStats.duration}ms[padded]`;
                currentAudio = '[padded]';
            }

            // If no filters have been applied, then the stream will still be
            // [video] , in that case, we do not actually add the video stuff to
            // filter_complex and this allows us to avoid transcoding.
            var changeVideoCodec = (this.opts.normalizeVideoCodec &&  isDifferentVideoCodec( streamStats.videoCodec, this.opts.videoEncoder) );
            var changeAudioCodec = (this.opts.normalizeAudioCodec &&  isDifferentAudioCodec( streamStats.audioCodec, this.opts.audioEncoder) );
            var filterComplex = '';
            if (currentVideo != '[video]') {
                changeVideoCodec = true; //this is useful so that it adds some lines below
                filterComplex += videoComplex;
            } else {
                currentVideo = `0:${videoIndex}`;
            }
            // same with audio:
            if (currentAudio != '[audio]') {
                changeAudioCodec = true;
                filterComplex += audioComplex;
            } else {
                currentAudio = `0:${audioIndex}`;
            }

            //If there is a filter complex, add it.
            if (filterComplex != '') {
                ffmpegArgs.push(`-filter_complex` , filterComplex.slice(1) );
                if (this.alignAudio) {
                    ffmpegArgs.push('-shortest');
                }
            }

            ffmpegArgs.push(
                            '-map', currentVideo,
                            '-map', currentAudio,
                            `-c:v`, (changeVideoCodec ? this.opts.videoEncoder : 'copy'),
                            `-flags`, `cgop+ilme`,
                            `-sc_threshold`, `1000000000`
            );
            if ( changeVideoCodec ) {
                // add the video encoder flags
                ffmpegArgs.push(
                            `-b:v`, `${this.opts.videoBitrate}k`,
                            `-minrate:v`, `${this.opts.videoBitrate}k`,
                            `-maxrate:v`, `${this.opts.videoBitrate}k`,
                            `-bufsize:v`, `${this.opts.videoBufSize}k`
                );
            }
            ffmpegArgs.push(
                            `-c:a`,  (changeAudioCodec ? this.opts.audioEncoder : 'copy'),
                            `-muxdelay`, `0`,
                            `-muxpreload`, `0`
            );
        } else {
            //Concat stream is simpler and should always copy the codec
            ffmpegArgs.push(
                            `-probesize`, `25000000`,
                            `-i`, streamUrl,
                            `-map`, `0:v`,
                            `-map`, `0:${audioIndex}`,
                            `-c`, `copy`,
                            `-muxdelay`,  this.opts.concatMuxDelay, 
                            `-muxpreload`, this.opts.concatMuxDelay);
        }

        ffmpegArgs.push(`-metadata`,
                        `service_provider="PseudoTV"`,
                        `-metadata`,
                        `service_name="${this.channel.name}`,
                        `-f`, `mpegts`);

        //t should be before output
        if (typeof duration !== 'undefined') {
            ffmpegArgs.push(`-t`, duration)
        }
            
        ffmpegArgs.push(`pipe:1`)

        this.ffmpeg = spawn(this.ffmpegPath, ffmpegArgs)
        this.ffmpeg.stdout.on('data', (chunk) => {
            this.sentData = true;
            this.emit('data', chunk)
        })
        if (this.opts.logFfmpeg) {
            this.ffmpeg.stderr.on('data', (chunk) => {
                process.stderr.write(chunk)
            })
        }
        this.ffmpeg.on('close', (code) => {
            if (code === null) {
                this.emit('close', code)
            } else if (code === 0) {
                this.emit('end')
            } else if (code === 255) {
                if (! this.sentData) {
                    this.emit('error', { code: code, cmd: `${this.opts.ffmpegPath} ${ffmpegArgs.join(' ')}` })
                }
                this.emit('close', code)
            } else {
                this.emit('error', { code: code, cmd: `${this.opts.ffmpegPath} ${ffmpegArgs.join(' ')}` })
            }
        })
    }
    kill() {
        if (typeof this.ffmpeg != "undefined") {
            this.ffmpeg.kill()
        }
    }
}

function isDifferentVideoCodec(codec, encoder) {
    if (codec == 'mpeg2video') {
        return ! encoder.includes("mpeg2");
    } else if (codec == 'h264') {
        return ! encoder.includes("264");
    } else if (codec == 'hevc') {
        return !( encoder.includes("265") || encoder.includes("hevc") );
    }
    // if the encoder/codec combinations are unknown, always encode, just in case
    return true;
}

function isDifferentAudioCodec(codec, encoder) {

    if (codec == 'mp3') {
        return !( encoder.includes("mp3") || encoder.includes("lame") );
    } else if (codec == 'aac') {
        return !encoder.includes("aac");
    } else if (codec == 'ac3') {
        return !encoder.includes("ac3");
    } else if (codec == 'flac') {
        return !encoder.includes("flac");
    }
    // if the encoder/codec combinations are unknown, always encode, just in case
    return true;
}

function parseResolutionString(s) {
    var i = s.indexOf('x');
    if (i == -1) {
        return {w:1920, h:1080}
    }
    return {
        w: parseInt( s.substring(0,i) , 10 ),
        h: parseInt( s.substring(i+1) , 10 ),
    }
}

module.exports = FFMPEG
