const spawn = require('child_process').spawn
const events = require('events')
const fs = require('fs')

// For now these options can be enabled with constants, must also enable overlay in settings:

// Normalize resoltion to WxH:
const FIX_RESOLUTION = false;
    const W = 1920;
    const H = 1080;
// Normalize codecs, video codec is in ffmpeg settings:
const FIX_CODECS = false;

// Align audio and video channels
const ALIGN_AUDIO = false;

// What audio encoder to use:
const AUDIO_ENCODER = 'aac';

const ERROR_PICTURE_PATH = 'http://localhost:8000/images/generic-error-screen.png'

class FFMPEG extends events.EventEmitter {
    constructor(opts, channel) {
        super()
        this.opts = opts
        this.channel = channel
        this.ffmpegPath = opts.ffmpegPath
        this.alignAudio = ALIGN_AUDIO;
    }
    async spawnConcat(streamUrl) {
        this.spawn(streamUrl, undefined, undefined, undefined, false, false, undefined, true)
    }
    async spawnStream(streamUrl, streamStats, startTime, duration, enableIcon, type) {
        this.spawn(streamUrl, streamStats, startTime, duration, true, enableIcon, type, false);
    }
    async spawnError(title, subtitle, streamStats, enableIcon, type) {
            // currently the error stream feature is not implemented
            console.log("error: " + title + " ; " + subtitle);
            this.emit('error', { code: -1, cmd: `error stream disabled` })
            return;
    }
    async spawn(streamUrl, streamStats, startTime, duration, limitRead, enableIcon, type, isConcatPlaylist) {
        let ffmpegArgs = [`-threads`, this.opts.threads,
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
            var audioComplex = `;[0:${audioIndex}]anull[audio]`;
            var videoComplex = `;[0:v]null[video]`;
            // Depending on the options we will apply multiple filters
            // each filter modifies the current video stream. Adds a filter to
            // the videoComplex variable. The result of the filter becomes the 
            // new currentVideo value.
            //
            // When adding filters, make sure that
            // videoComplex always begins wiht ; and doesn't end with ;

            // prepare input files, overlay adds another input file
            ffmpegArgs.push(`-i`, streamUrl);
            if (doOverlay) {
                ffmpegArgs.push(`-i`, `${this.channel.icon}` );
            }

            // Resolution fix: Add scale filter, current stream becomes [siz]
            if (FIX_RESOLUTION && (iW != W || iH != H) ) {
                //Maybe the scaling algorithm could be configurable. bicubic seems good though
                videoComplex += `;${currentVideo}scale=${W}:${H}:flags=bicubic:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2[siz]`
                currentVideo = "[siz]";
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

            // Align audio is just the apad filter applied to audio stream
            if (this.alignAudio) {
                audioComplex += `;${currentAudio}apad=whole_dur=${streamStats.duration}ms[padded]`;
                currentAudio = '[padded]';
            }

            // If no filters have been applied, then the stream will still be
            // [video] , in that case, we do not actually add the video stuff to
            // filter_complex and this allows us to avoid transcoding.
            var changeVideoCodec = FIX_CODECS;
            var changeAudioCodec = FIX_CODECS;
            var filterComplex = '';
            if (currentVideo != '[video]') {
                changeVideoCodec = true;
                filterComplex += videoComplex;
            } else {
                currentVideo = '0:v';
            }
            // same with audi:
            if (currentAudio != '[audio]') {
                changeAudioCodec = true; //this is useful for some more flags later
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
                            `-c:a`,  (changeAudioCodec ? AUDIO_ENCODER : 'copy'),
                            `-muxdelay`, `0`,
                            `-muxpreload`, `0`
            );
        } else {
            //Concat stream is simpler and should always copy the codec
            ffmpegArgs.push(
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
            this.emit('data', chunk)
        })
        if (this.opts.logFfmpeg) {
            this.ffmpeg.stderr.on('data', (chunk) => {
                process.stderr.write(chunk)
            })
        }
        this.ffmpeg.on('close', (code) => {
            if (code === null)
                this.emit('close', code)
            else if (code === 0)
                this.emit('end')
            else if (code === 255)
                this.emit('close', code)
            else
                this.emit('error', { code: code, cmd: `${this.opts.ffmpegPath} ${ffmpegArgs.join(' ')}` })
        })
    }
    kill() {
        if (typeof this.ffmpeg != "undefined") {
            this.ffmpeg.kill()
        }
    }
}

module.exports = FFMPEG
