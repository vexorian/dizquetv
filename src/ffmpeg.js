const spawn = require('child_process').spawn
var events = require('events')

class ffmpeg extends events.EventEmitter {
    constructor(opts) {
        super()
        this.offset = 0
        this.args = []
        this.opts = opts
        this.ffmpegPath = opts.ffmpegPath
        this.ffprobePath = opts.ffprobePath
        let lines = opts.args.split('\n')
        for (let i = 0, l = lines.length; i < l; i++) {
            let x = lines[i].indexOf(' ')
            if (x === -1)
                this.args.push(lines[i])
            else {
                this.args.push(lines[i].substring(0, x))
                this.args.push(lines[i].substring(x + 1, lines[i].length))
            }
        }
    }
    getStreams(file) {
        return new Promise((resolve, reject) => {
            let ffprobe = spawn(this.ffprobePath, [ '-v', 'quiet', '-show_streams', '-of', 'json', file ])
            let str = ""
            ffprobe.stdout.on('data', (chunk) => {
                str += chunk
            })
            ffprobe.on('close', () => {
                resolve(str)
            })
        })
    }
    async spawn(lineupItem) {
        let audioIndex = -1
        if (this.opts.preferAudioLanguage === 'true') {
            let streams = JSON.parse(await this.getStreams(lineupItem.file)).streams
            for (let i = 0, l = streams.length; i < l; i++) {
                if (streams[i].codec_type === 'audio') {
                    if (streams[i].tags.language === this.opts.audioLanguage) {
                        audioIndex = i
                        break;
                    }
                }
            }
        }

        let tmpargs = JSON.parse(JSON.stringify(this.args))
        let startTime = tmpargs.indexOf('STARTTIME')
        let dur = tmpargs.indexOf('DURATION')
        let input = tmpargs.indexOf('INPUTFILE')
        let output = tmpargs.indexOf('OUTPUTFILE')
        let tsoffset = tmpargs.indexOf('TSOFFSET')
        let audStream = tmpargs.indexOf('AUDIOSTREAM')

        tmpargs[startTime] = lineupItem.start / 1000
        tmpargs[dur] = lineupItem.duration / 1000
        tmpargs[input] = lineupItem.file
        tmpargs[audStream] = `0:${audioIndex === -1 ? 'a' : audioIndex}`
        tmpargs[tsoffset] = this.offset
        tmpargs[output] = 'pipe:1'
        this.offset += lineupItem.duration / 1000
        this.ffmpeg = spawn(this.ffmpegPath, tmpargs)
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
            else
                this.emit('error', { code: code, cmd: `${tmpargs.join(' ')}` })
        })
    }
    kill() {
        this.ffmpeg.kill()
    }
}

module.exports = ffmpeg