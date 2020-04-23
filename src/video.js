const express = require('express')
const helperFuncs = require('./helperFuncs')
const ffmpeg = require('./ffmpeg')
const fs = require('fs')

module.exports = { router: video }

function video(db) {
    var router = express.Router()
    router.get('/video', (req, res) => {
        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(500).send("No Channel Specified")
            return
        }
        let channel = db['channels'].find({ number: parseInt(req.query.channel, 10) })
        if (channel.length === 0) {
            res.status(500).send("Channel doesn't exist")
            return
        }
        channel = channel[0]

        // Get video lineup (array of video urls with calculated start times and durations.)
        let lineup = helperFuncs.getLineup(Date.now(), channel)
        let ffmpegSettings = db['ffmpeg-settings'].find()[0]

        // Check if ffmpeg path is valid
        if (!fs.existsSync(ffmpegSettings.ffmpegPath)) {
            res.status(500).send("FFMPEG path is invalid. The file (executable) doesn't exist.")
            console.error("The FFMPEG Path is invalid. Please check your configuration.")
            return
        }

        console.log(`Stream started. Channel: ${channel.number} (${channel.name})`)

        let ffmpeg2 = new ffmpeg(ffmpegSettings)  // Set the transcoder options

        ffmpeg2.on('data', (data) => { res.write(data) })

        ffmpeg2.on('error', (err) => { console.error("FFMPEG ERROR", err) })

        ffmpeg2.on('end', () => { // On finish transcode - END of program or commercial...
            if (lineup.length === 0) // refresh the expired program/lineup
                lineup = helperFuncs.getLineup(Date.now(), channel)
            ffmpeg2.spawn(lineup.shift()) // Spawn the next ffmpeg process
        })

        res.on('close', () => { // on HTTP close, kill ffmpeg
            ffmpeg2.kill()
            console.log(`Stream ended. Channel: ${channel.number} (${channel.name})`)
        })

        ffmpeg2.spawn(lineup.shift()) // Spawn the ffmpeg process, fire this bitch up


    })
    return router
}