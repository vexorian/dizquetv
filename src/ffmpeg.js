const Router = require('express').Router
const spawn = require('child_process').spawn
const config = require('config-yml')
const xmltv = require('./xmltv')

module.exports = ffmpegRouter

function ffmpegRouter(client) {
    var router = Router()
    var inUse = false
    router.get('/video', (req, res) => {
        if (inUse)
            return res.status(409).send("Error: Another user is currently viewing a stream. One one active stream is allowed.")
        inUse = true
        var channel = req.query.channel
        if (!channel) {
            inUse = false
            res.status(400).send("Error: No channel queried")
            return
        }
        channel = channel.split('?')[0]
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-disposition': 'attachment; filename=video.ts'
        })
        startStreaming(channel, res)
    })

    return router

    function startStreaming(channel, res) {
        var programs = xmltv.readXMLPrograms()
        // Find the current program for channel, calculate video start position
        var startPos = -1
        var programIndex = -1
        var channelExists = false
        for (var i = 0; i < programs.length; i++) {
            var date = new Date()
            if (programs[i].channel == channel) {
                channelExists = true
                if (programs[i].start <= date && programs[i].stop >= date) {
                    startPos = date.getTime() - programs[i].start.getTime()
                    programIndex = i
                    break
                }
            }
        }
        // End session if any errors.
        if (!channelExists) {
            inUse = false
            res.status(403).send(`Error: Channel doesn't exist. Channel: ${channel}`)
            return
        }
        if (programIndex === -1) {
            inUse = false
            res.status(403).send(`Error: No scheduled programming available. Channel: ${channel}`)
            return
        }
        if (startPos === -1) {
            inUse = false
            res.status(403).send(`Error: How the fuck did you get here?. Channel: ${channel}`)
            return
        }
        
        // Query plex for current program
        client.Get(programs[programIndex].key, (result) => {
            if (result.err) {
                inUse = false
                res.status(403).send(`Error: Failed to fetch program info from Plex`)
                return
            }
            var fetchedItem = result.result.MediaContainer.Metadata[0]
            // Transcode it
            client.Transcode(fetchedItem, startPos, (result) => {
                if (result.err) {
                    inUse = false
                    res.status(403).send(`Error: Failed to add program to playQueue`)
                    return
                }
                // Update server timeline every 10 seconds
                var stream = result.result
                var msElapsed = startPos
                var timelineInterval = setInterval(() => {
                    stream.update(msElapsed)
                    msElapsed += 10000
                }, 10000)
                // Start transmuxing, pipe ffmpeg's output to stdout
                var args = [
                    '-re',                      // Live Stream
                    '-ss', startPos / 1000,     // Start Time (eg: 00:01:23.000 or 83 (seconds))
                    '-i', stream.url,           // Source
                    '-f', 'mpegts',             // Output Format
                    '-c', 'copy',               // Copy Video/Audio Streams
                    'pipe:1'                    // Output on stdout
                ]
                if (config.FFMPEG_OPTIONS.PREBUFFER)
                    args.shift()
                var ffmpeg = spawn(config.FFMPEG_OPTIONS.PATH, args)
                // Write the chunks to response
                ffmpeg.stdout.on('data', (chunk) => {
                    res.write(chunk)
                })
                // When the http session ends: kill ffmpeg
                var httpEnd = function () {
                    ffmpeg.kill()
                    inUse = false
                }
                res.on('close', httpEnd)
                // When ffmpeg closes: kill the timelineInterval, recurse to next program..  Since MPEGTS files can be concatenated together, this should work.....
                ffmpeg.on('close', (code) => {
                    clearInterval(timelineInterval)
                    // if ffmpeg closed because we hit the end of the video..
                    if (code === 0) { // stream the next episode
                        var end = programs[programIndex].stop
                        var now = new Date()
                        var timeUntilDone = end.valueOf() - now.valueOf()
                        timeUntilDone = timeUntilDone > 0 ? timeUntilDone : 0
                        setTimeout(() => {
                            stream.stop()
                            res.removeListener('close', httpEnd)
                            startStreaming(channel, res)
                        }, timeUntilDone) // wait until end of video before we start sending the stream
                    } else if (inUse && !res.headersSent) {
                        stream.stop()
                        res.status(400).send(`Error: FFMPEG closed unexpectedly`)
                        inUse = false
                    } else {
                        stream.stop()
                    }
                })
            })
        })
    }
}