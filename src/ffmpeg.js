const spawn = require('child_process').spawn
const events = require('events')
const fs = require('fs')

class FFMPEG extends events.EventEmitter {
    constructor(opts, channel) {
        super()
        this.opts = opts
        this.channel = channel
        this.ffmpegPath = opts.ffmpegPath
    }
    async spawn(streamUrl, streamStats, duration, enableIcon, type, isConcatPlaylist) {
        let ffmpegArgs = [`-threads`, this.opts.threads,
                          `-re`,
                          `-fflags`, `+genpts+discardcorrupt+igndts`];
        
        if (duration > 0)
            ffmpegArgs.push(`-t`, duration)
        
        if (isConcatPlaylist == true)
            ffmpegArgs.push(`-f`, `concat`, 
                            `-safe`, `0`,
                            `-protocol_whitelist`, `file,http,tcp,https,tcp,tls`)

        ffmpegArgs.push(`-i`, streamUrl)

        // Overlay icon
        if (enableIcon && type === 'program') {
            if (process.env.DEBUG) console.log('Channel Icon Overlay Enabled')

            let posAry = [ '20:20', 'W-w-20:20', '20:H-h-20', 'W-w-20:H-h-20'] // top-left, top-right, bottom-left, bottom-right (with 20px padding)
            let icnDur = ''

            if (this.channel.iconDuration > 0)
                icnDur = `:enable='between(t,0,${this.channel.iconDuration})'`

            let iconOverlay = `[1:v]scale=${this.channel.iconWidth}:-1[icn];[0:v][icn]overlay=${posAry[this.channel.iconPosition]}${icnDur}[outv]`
            // Only scale video if specified, don't upscale video
            if (this.opts.videoResolutionHeight != "unchanged" && streamStats.videoHeight != `undefined` && parseInt(this.opts.videoResolutionHeight, 10) < parseInt(streamStats.videoHeight, 10)) {
                iconOverlay = `[0:v]scale=-2:${this.opts.videoResolutionHeight}[scaled];[1:v]scale=${this.channel.iconWidth}:-1[icn];[scaled][icn]overlay=${posAry[this.channel.iconPosition]}${icnDur}[outv]`
            }

            ffmpegArgs.push(`-i`, `${this.channel.icon}`,
                            `-filter_complex`, iconOverlay,
                            `-map`, `[outv]`,
                            `-c:v`, this.opts.videoEncoder,
                            `-flags`, `cgop+ilme`,
                            `-sc_threshold`, `1000000000`,
                            `-b:v`, `${this.opts.videoBitrate}k`,
                            `-minrate:v`, `${this.opts.videoBitrate}k`,
                            `-maxrate:v`, `${this.opts.videoBitrate}k`,
                            `-bufsize:v`, `${this.opts.videoBufSize}k`,
                            `-map`, `0:a`,
                            `-c:a`, `copy`,
                            `-muxdelay`, `0`,
                            `-muxpreload`, `0`);
        } else if (enableIcon && streamStats.videoCodec != this.opts.videoEncoder) { // Encode commercial if video codec does not match
            ffmpegArgs.push(`-map`, `0`,
                            `-c:v`, this.opts.videoEncoder,
                            `-flags`, `cgop+ilme`,
                            `-sc_threshold`, `1000000000`,
                            `-b:v`, `${this.opts.videoBitrate}k`,
                            `-minrate:v`, `${this.opts.videoBitrate}k`,
                            `-maxrate:v`, `${this.opts.videoBitrate}k`,
                            `-bufsize:v`, `${this.opts.videoBufSize}k`,
                            `-c:a`, `copy`,
                            `-muxdelay`, `0`,
                            `-muxpreload`, `0`);
        } else
            ffmpegArgs.push(`-map`, `0`, 
                            `-c`, `copy`,
                            `-muxdelay`,  this.opts.concatMuxDelay, 
                            `-muxpreload`, this.opts.concatMuxDelay);

        ffmpegArgs.push(`-metadata`,
                        `service_provider="PseudoTV"`,
                        `-metadata`,
                        `service_name="${this.channel.name}`,
                        `-f`, `mpegts`,
                        `pipe:1`)

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
