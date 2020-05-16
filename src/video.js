const express = require('express')
const helperFuncs = require('./helperFuncs')
const FFMPEG = require('./ffmpeg')
const FFMPEG_TEXT = require('./ffmpegText')
const fs = require('fs')

module.exports = { router: video }

function video(db) {
    var router = express.Router()

    router.get('/setup', (req, res) => {
        let ffmpegSettings = db['ffmpeg-settings'].find()[0]
        // Check if ffmpeg path is valid
        if (!fs.existsSync(ffmpegSettings.ffmpegPath)) {
            res.status(500).send("FFMPEG path is invalid. The file (executable) doesn't exist.")
            console.error("The FFMPEG Path is invalid. Please check your configuration.")
            return
        }

        console.log(`\r\nStream starting. Channel: 1 (PseudoTV)`)

        let ffmpeg = new FFMPEG_TEXT(ffmpegSettings, 'PseudoTV (No Channels Configured)', 'Configure your channels using the PseudoTV Web UI')

        ffmpeg.on('data', (data) => { res.write(data) })

        ffmpeg.on('error', (err) => {
            console.error("FFMPEG ERROR", err)
            res.status(500).send("FFMPEG ERROR")
            return
        })
        ffmpeg.on('close', () => {
            res.send()
        })

        res.on('close', () => { // on HTTP close, kill ffmpeg
            ffmpeg.kill()
            console.log(`\r\nStream ended. Channel: 1 (PseudoTV)`)
        })
    })

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
        let prog = helperFuncs.getCurrentProgramAndTimeElapsed(Date.now(), channel)
        let lineup = helperFuncs.createLineup(prog)
        let ffmpegSettings = db['ffmpeg-settings'].find()[0]

        // Check if ffmpeg path is valid
        if (!fs.existsSync(ffmpegSettings.ffmpegPath)) {
            res.status(500).send("FFMPEG path is invalid. The file (executable) doesn't exist.")
            console.error("The FFMPEG Path is invalid. Please check your configuration.")
            return
        }

        console.log(`\r\nStream starting. Channel: ${channel.number} (${channel.name})`)

        let ffmpeg = new FFMPEG(ffmpegSettings, channel)  // Set the transcoder options

        ffmpeg.on('data', (data) => { res.write(data) })

        ffmpeg.on('error', (err) => {
            console.error("FFMPEG ERROR", err)
            res.status(500).send("FFMPEG ERROR")
            return
        })

        ffmpeg.on('close', () => {
            res.send()
        })

        ffmpeg.on('end', () => { // On finish transcode - END of program or commercial...
            if (lineup.length === 0) { // refresh the expired program/lineup
                prog = helperFuncs.getCurrentProgramAndTimeElapsed(Date.now(), channel)
                lineup = helperFuncs.createLineup(prog)
            }
            ffmpeg.spawn(lineup.shift(), prog.program) // Spawn the next ffmpeg process
        })

        res.on('close', () => { // on HTTP close, kill ffmpeg
            ffmpeg.kill()
            console.log(`\r\nStream ended. Channel: ${channel.number} (${channel.name})`)
        })

        ffmpeg.spawn(lineup.shift(), prog.program) // Spawn the ffmpeg process, fire this bitch up

    })
    return router
}
