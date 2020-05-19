const spawn = require('child_process').spawn
const events = require('events')
const fs = require('fs')

class FFMPEG extends events.EventEmitter {
    constructor(opts, channel) {
        super()
        this.offset = 0
        this.args = []
        this.opts = opts
        this.channel = channel
        this.ffmpegPath = opts.ffmpegPath
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
    // This is used to generate ass subtitles from text subs to be used with the ass filter in ffmpeg.
    createSubsFromStream(file, startTime, duration, streamIndex, output) {
        if (process.env.DEBUG) console.log('Generating .ass subtitles')
        let exe = spawn(this.ffmpegPath, [
            '-threads', this.opts.threads,
            '-ss', startTime,
            '-i', file,
            '-t', duration,
            '-map', `0:${streamIndex}`,
            '-f', 'ass',
            output
        ])
        return new Promise((resolve, reject) => {
            if (this.opts.logFfmpeg) {
                exe.stderr.on('data', (chunk) => {
                    process.stderr.write(chunk)
                })
            }
            exe.on('close', (code) => {
                if (code === 0) {
                    if (process.env.DEBUG) console.log('Successfully generated .ass subtitles')
                    resolve()
                } else {
                    console.log('Failed generating .ass subtitles.')
                    reject()
                }
            })
        })
    }
    async spawn(lineupItem) {
        let videoIndex = lineupItem.opts.videoIndex
        let audioIndex = lineupItem.opts.audioIndex
        let subtitleIndex = lineupItem.opts.subtitleIndex
        let uniqSubFileName = Date.now().valueOf().toString()

        for (let i = 0, l = lineupItem.streams.length; i < l; i++) {
            if (videoIndex === '-1' && lineupItem.streams[i].streamType === 1)
                if (lineupItem.streams[i].default)
                    videoIndex = i
            if (audioIndex === '-1' && lineupItem.streams[i].streamType === 2)
                if (lineupItem.streams[i].default || lineupItem.streams[i].selected)
                    audioIndex = i
            if (subtitleIndex === '-1' && lineupItem.streams[i].streamType === 3)
                if (lineupItem.streams[i].default || lineupItem.streams[i].forced)
                    subtitleIndex = i
        }

        // if for some reason we didn't find a default track, let ffmpeg decide..
        if (videoIndex === '-1')
            videoIndex = 'v'
        if (audioIndex === '-1')
            audioIndex = 'a'

        let sub = (subtitleIndex === '-1' || subtitleIndex === '-2') ? null : lineupItem.streams[subtitleIndex]

        let tmpargs = JSON.parse(JSON.stringify(this.args))
        let startTime = tmpargs.indexOf('STARTTIME')
        let dur = tmpargs.indexOf('DURATION')
        let input = tmpargs.indexOf('INPUTFILE')
        let vidStream = tmpargs.indexOf('VIDEOSTREAM')
        let output = tmpargs.indexOf('OUTPUTFILE')
        let tsoffset = tmpargs.indexOf('TSOFFSET')
        let audStream = tmpargs.indexOf('AUDIOSTREAM')
        let chanName = tmpargs.indexOf('CHANNELNAME')

        tmpargs[startTime] = lineupItem.start / 1000
        tmpargs[dur] = lineupItem.duration / 1000
        tmpargs[input] = lineupItem.file
        tmpargs[audStream] = `0:${audioIndex}`
        tmpargs[chanName] = `service_name="${this.channel.name}"`
        tmpargs[tsoffset] = this.offset
        tmpargs[output] = 'pipe:1'

        let iconOverlay = `[0:${videoIndex}]null`
        let deinterlace = 'null'
        let posAry = [ '20:20', 'W-w-20:20', '20:H-h-20', 'W-w-20:H-h-20'] // top-left, top-right, bottom-left, bottom-right (with 20px padding)
        let icnDur = ''
        if (this.channel.iconDuration > 0)
            icnDur = `:enable='between(t,0,${this.channel.iconDuration})'`
        if (this.channel.icon !== '' && this.channel.overlayIcon && lineupItem.type === 'program') {
            iconOverlay = `[1:v]scale=${this.channel.iconWidth}:-1[icn];[0:${videoIndex}][icn]overlay=${posAry[this.channel.iconPosition]}${icnDur}`
            if (process.env.DEBUG) console.log('Channel Icon Overlay Enabled')
        }

        if (videoIndex !== 'v') {
            if (typeof lineupItem.streams[videoIndex].scanType === 'undefined' || lineupItem.streams[videoIndex].scanType !== 'progressive') {
                deinterlace = 'yadif'
                if (process.env.DEBUG) console.log('Deinterlacing Video')
            }
        }

        if (sub === null || lineupItem.type === 'commercial') { // No subs or icon overlays for Commercials
            tmpargs[vidStream] = '[v]'
            tmpargs.splice(vidStream - 1, 0, "-filter_complex", `${iconOverlay}[v1];[v1]${deinterlace}[v]`)
            console.log("No Subtitles")
        } else if (sub.codec === 'pgs') { // If program has PGS subs
            tmpargs[vidStream] = '[v]'
            if (typeof sub.index === 'undefined') { // If external subs
                console.log("PGS SUBS (external) - Not implemented..")
                tmpargs.splice(vidStream - 1, 0, "-filter_complex", `${iconOverlay}[v1];[v1]${deinterlace}[v]`)
            } else {                    // Otherwise, internal/embeded pgs subs
                console.log("PGS SUBS (embeded)")
                tmpargs.splice(vidStream - 1, 0, "-filter_complex", `${iconOverlay}[v2];[v2]${deinterlace}[v1];[v1][0:${sub.index}]overlay[v]`)
            }
        } else if (sub.codec === 'srt' || sub.codec === 'ass') {
            tmpargs[vidStream] = '[v]'
            if (typeof sub.index === 'undefined') {
                console.log("SRT SUBS (external)")
                await this.createSubsFromStream(sub.key, lineupItem.start / 1000, lineupItem.duration / 1000, 0, `${process.env.DATABASE}/${uniqSubFileName}.ass`)
                tmpargs.splice(vidStream - 1, 0, "-filter_complex", `${iconOverlay}[v1];[v1]${deinterlace},ass=${process.env.DATABASE}/${uniqSubFileName}.ass[v]`)
            } else {
                console.log("SRT SUBS (embeded) - This may take a few seconds..")
                await this.createSubsFromStream(lineupItem.file, lineupItem.start / 1000, lineupItem.duration / 1000, sub.index, `${process.env.DATABASE}/${uniqSubFileName}.ass`)
                tmpargs.splice(vidStream - 1, 0, "-filter_complex", `${iconOverlay}[v1];[v1]${deinterlace},ass=${process.env.DATABASE}/${uniqSubFileName}.ass[v]`)
            }
        } else { // Can't do VobSub's as plex only hosts the .idx file, there is no access to the .sub file.. Who the fuck uses VobSubs anyways.. SRT/ASS FTW
            tmpargs[vidStream] = '[v]'
            tmpargs.splice(vidStream - 1, 0, "-filter_complex", `${iconOverlay}[v1];[v1]${deinterlace}[v]`)
            console.log("No Compatible Subtitles")
        }

        if (this.channel.icon !== '' && this.channel.overlayIcon && lineupItem.type === 'program') // Add the channel icon to ffmpeg input if enabled
            tmpargs.splice(vidStream - 1, 0, '-i', this.channel.icon)

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
            if (fs.existsSync(`${process.env.DATABASE}/${uniqSubFileName}.ass`))
                fs.unlinkSync(`${process.env.DATABASE}/${uniqSubFileName}.ass`)
            if (code === null)
                this.emit('close', code)
            else if (code === 0)
                this.emit('end')
            else if (code === 255)
                this.emit('close', code)
            else
                this.emit('error', { code: code, cmd: `${this.opts.ffmpegPath} ${tmpargs.join(' ')}` })
        })
    }
    kill() {
        this.ffmpeg.kill()
    }
}

module.exports = FFMPEG
