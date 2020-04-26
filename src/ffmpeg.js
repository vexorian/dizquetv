const spawn = require('child_process').spawn
var events = require('events')

class ffmpeg extends events.EventEmitter {
    constructor(opts) {
        super()
        this.offset = 0
        this.opts = opts
    }
    spawn(lineupItem) {
        let args = [
            '-headers', 'User-Agent: ffmpeg',
            '-threads', this.opts.threads,
            '-ss', lineupItem.start / 1000,
            '-t', lineupItem.duration / 1000,
            '-re',
            '-i', lineupItem.file,
            '-c:v', this.opts.videoEncoder,
            '-c:a', this.opts.audioEncoder,
            '-ac', this.opts.audioChannels,
            '-ar', this.opts.audioRate,
            '-b:a', this.opts.audioBitrate,
            '-b:v', this.opts.videoBitrate,
            '-s', this.opts.videoResolution,
            '-r', this.opts.videoFrameRate,
            '-flags', 'cgop+ilme',          // Dont know if this does fuck all
            '-sc_threshold', '1000000000',  // same here...
            '-minrate:v', this.opts.videoBitrate,
            '-maxrate:v', this.opts.videoBitrate,
            '-bufsize:v', this.opts.bufSize,
            '-f', 'mpegts',
            '-output_ts_offset', this.offset, // This actually helped.. VLC still shows "TS discontinuity" errors tho..
            'pipe:1'
        ]
        this.offset += lineupItem.duration / 1000
        this.ffmpeg = spawn(this.opts.ffmpegPath, args)
        this.ffmpeg.stdout.on('data', (chunk) => {
            this.emit('data', chunk)
        })
        this.ffmpeg.on('close', (code) => {
            if (code === null)
                this.emit('close', code)
            else if (code === 0)
                this.emit('end')
            else
                this.emit('error', { code: code, cmd: `${args.join(' ')}` })
        })
    }
    kill() {
        this.ffmpeg.kill()
    }
}

module.exports = ffmpeg