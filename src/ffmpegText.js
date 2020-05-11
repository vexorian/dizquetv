const spawn = require('child_process').spawn
const events = require('events')
const fs = require('fs')
const path = require('path')

class FFMPEG_TEXT extends events.EventEmitter {
    constructor (opts, title, subtitle) {
        super()
        this.ffmpegPath = opts.ffmpegPath

        this.args = [
            '-threads', opts.threads,
            '-f', 'lavfi',
            '-re',
            '-stream_loop', '-1',
            '-i', 'color=c=black:s=1280x720',
            '-f', 'lavfi',
            '-i', 'anullsrc',
            '-vf', `drawtext=fontfile=${process.env.DATABASE}/font.ttf:fontsize=30:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${title}',drawtext=fontfile=${process.env.DATABASE}/font.ttf:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+20)/2:text='${subtitle}'`,
            '-c:v', 'libx264',
            '-c:a', 'ac3',
            '-f', 'mpegts',
            'pipe:1'
        ]

        this.ffmpeg = spawn(opts.ffmpegPath, this.args)

        this.ffmpeg.stdout.on('data', (chunk) => {
            this.emit('data', chunk)
        })

        if (opts.logFfmpeg) {
            this.ffmpeg.stderr.on('data', (chunk) => {
                process.stderr.write(chunk)
            })
        }

        this.ffmpeg.on('close', (code) => {
            if (code === null)
                this.emit('close', code)
            else
                this.emit('error', { code: code, cmd: `${this.args.join(' ')}` })
        })
    }
    kill() {
        this.ffmpeg.kill()
    }
}

module.exports = FFMPEG_TEXT