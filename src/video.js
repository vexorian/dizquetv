const express = require('express')
const helperFuncs = require('./helperFuncs')
const FFMPEG = require('./ffmpeg')
const FFMPEG_TEXT = require('./ffmpegText')
const PlexTranscoder = require('./plexTranscoder')
const fs = require('fs')
const ProgramPlayer = require('./program-player');
const channelCache  = require('./channel-cache')

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

        console.log(`\r\nStream starting. Channel: 1 (dizqueTV)`)

        let ffmpeg = new FFMPEG_TEXT(ffmpegSettings, 'dizqueTV (No Channels Configured)', 'Configure your channels using the dizqueTV Web UI')

        ffmpeg.on('data', (data) => { res.write(data) })

        ffmpeg.on('error', (err) => {
            console.error("FFMPEG ERROR", err)
            res.status(500).send("FFMPEG ERROR")
            return
        })
        ffmpeg.on('close', () => {
            res.end()
        })

        res.on('close', () => { // on HTTP close, kill ffmpeg
            ffmpeg.kill()
            console.log(`\r\nStream ended. Channel: 1 (dizqueTV)`)
        })
    })
    // Continuously stream video to client. Leverage ffmpeg concat for piecing together videos
    router.get('/video', (req, res) => {
        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(500).send("No Channel Specified")
            return
        }
        let number = parseInt(req.query.channel, 10);
        let channel =  channelCache.getChannelConfig(db, number);
        if (channel.length === 0) {
            res.status(500).send("Channel doesn't exist")
            return
        }
        channel = channel[0]

        let ffmpegSettings = db['ffmpeg-settings'].find()[0]

        // Check if ffmpeg path is valid
        if (!fs.existsSync(ffmpegSettings.ffmpegPath)) {
            res.status(500).send("FFMPEG path is invalid. The file (executable) doesn't exist.")
            console.error("The FFMPEG Path is invalid. Please check your configuration.")
            return
        }

        res.writeHead(200, {
            'Content-Type': 'video/mp2t'
        })

        console.log(`\r\nStream starting. Channel: ${channel.number} (${channel.name})`)

        let lastWrite = (new Date()).getTime();
        let ffmpeg = new FFMPEG(ffmpegSettings, channel);  // Set the transcoder options
        let stopped = false;

        function stop() {
            if (! stopped) {
                stopped = true;
                try {
                    res.end();
                } catch (err) {}
                ffmpeg.kill();
            }
        }
        let watcher = () => {
            let t1 = (new Date()).getTime();
            if (t1 - lastWrite >= 30000) {
                console.log("Client timed out, stop stream.");
                //way too long without writes, time out
                stop();
            }
            if (! stopped) {
                setTimeout(watcher, 5000);
            }
        };
        setTimeout(watcher, 5000);



        ffmpeg.on('data', (data) => {
            if (! stopped) {
                lastWrite = (new Date()).getTime();
                res.write(data)
            }
        })

        ffmpeg.on('error', (err) => {
            console.error("FFMPEG ERROR", err);
            //status was already sent
            stop();
            return;
        })

        ffmpeg.on('close', stop)
        
        res.on('close', () => { // on HTTP close, kill ffmpeg
            console.log(`\r\nStream ended. Channel: ${channel.number} (${channel.name})`);
            stop();
        })

        ffmpeg.on('end', () => {
            console.log("Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.")
            stop();
        })

        let channelNum = parseInt(req.query.channel, 10)
        ffmpeg.spawnConcat(`http://localhost:${process.env.PORT}/playlist?channel=${channelNum}`);
    })
    // Stream individual video to ffmpeg concat above. This is used by the server, NOT the client
    router.get('/stream', async (req, res) => {
        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(400).send("No Channel Specified")
            return
        }

        let number = parseInt(req.query.channel);
        let channel =  channelCache.getChannelConfig(db, number);

        if (channel.length === 0) {
            res.status(404).send("Channel doesn't exist")
            return
        }
        let isFirst = false;
        if ( (typeof req.query.first !== 'undefined') && (req.query.first=='1') ) {
            isFirst = true;
        }
        channel = channel[0]

        let ffmpegSettings = db['ffmpeg-settings'].find()[0]

        // Check if ffmpeg path is valid
        if (!fs.existsSync(ffmpegSettings.ffmpegPath)) {
            res.status(500).send("FFMPEG path is invalid. The file (executable) doesn't exist.")
            console.error("The FFMPEG Path is invalid. Please check your configuration.")
            return
        }




        // Get video lineup (array of video urls with calculated start times and durations.)
      let t0 = (new Date()).getTime();
      let lineupItem = channelCache.getCurrentLineupItem( channel.number, t0);
      if (lineupItem == null) {
        let prog = helperFuncs.getCurrentProgramAndTimeElapsed(t0, channel)

        if (prog.program.isOffline && channel.programs.length == 1) {
            //there's only one program and it's offline. So really, the channel is
            //permanently offline, it doesn't matter what duration was set
            //and it's best to give it a long duration to ensure there's always
            //filler to play (if any)
            let t = 365*24*60*60*1000;
            prog.program = {
                actualDuration: t,
                duration: t,
                isOffline : true,
            };
        } else if (prog.program.isOffline && prog.program.duration - prog.timeElapsed <= 10000) {
            //it's pointless to show the offline screen for such a short time, might as well
            //skip to the next program
            prog.programIndex = (prog.programIndex + 1) % channel.programs.length;
            prog.program = channel.programs[prog.programIndex ];
            prog.timeElapsed = 0;
        }
        if ( (prog == null) || (typeof(prog) === 'undefined') || (prog.program == null) || (typeof(prog.program) == "undefined") ) {
            throw "No video to play, this means there's a serious unexpected bug or the channel db is corrupted."
        }
        let lineup = helperFuncs.createLineup(prog, channel, isFirst)
        lineupItem = lineup.shift()
      }
     

        console.log("=========================================================");
        console.log("! Start playback");
        console.log(`! Channel: ${channel.name} (${channel.number})`);
        if (typeof(lineupItem) === 'undefined') {
            lineupItem.title = 'Unknown';
        }
        console.log(`! Title: ${lineupItem.title}`);
        if ( typeof(lineupItem.streamDuration) === 'undefined') {
            console.log(`! From : ${lineupItem.start}`);
        } else {
            console.log(`! From : ${lineupItem.start} to: ${lineupItem.start + lineupItem.streamDuration}`);
        }
        console.log("=========================================================");

        channelCache.recordPlayback(channel.number, t0, lineupItem);

        let playerContext = {
            lineupItem : lineupItem,
            ffmpegSettings : ffmpegSettings,
            channel: channel,
            db: db,
        }
        
        let player = new ProgramPlayer(playerContext);
        let stopped = false;
        let stop = () => {
            if (!stopped) {
                stopped = true;
                player.cleanUp();
                player = null;
                res.end();
            }
        };
        var playerObj = null;
        try {
            playerObj = await player.play();
        } catch (err) {
            console.log("Error when attempting to play video: " +err.stack);
            try {
                res.status(500).send("Unable to start playing video.").end();
            } catch (err2) {
                console.log(err2.stack);
            }
            stop();
            return;
        }
        let lastWrite = (new Date()).getTime();
        let watcher = () => {
            let t1 = (new Date()).getTime();
            if (t1 - lastWrite >= 30000) {
                console.log("Demux ffmpeg timed out, stop stream.");
                //way too long without writes, time out
                stop();
            }
            if (! stopped) {
                setTimeout(watcher, 5000);
            }
        };
        setTimeout(watcher, 5000);

        let stream = playerObj.stream;
        res.writeHead(200, {
            'Content-Type': 'video/mp2t'
        });

        res.write(playerObj.data);

        stream.on("data", (data) => {
            try {
                if (! stopped) {
                    lastWrite = (new Date()).getTime();
                    res.write(data);
                }
            } catch (err) {
                console.log("I/O Error: " + err.stack);
                stop();
            }
        });
        stream.on("end", () => {
            stop();
        });
        res.on("close", () => {
            console.log("Client Closed");
            stop();
        });
    });

    router.get('/playlist', (req, res) => {
        res.type('text')

        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(500).send("No Channel Specified")
            return
        }

        let channelNum = parseInt(req.query.channel, 10)
        let channel =  channelCache.getChannelConfig(db, channelNum );
        if (channel.length === 0) {
            res.status(500).send("Channel doesn't exist")
            return
        }

        // Maximum number of streams to concatinate beyond channel starting
        // If someone passes this number then they probably watch too much television
        let maxStreamsToPlayInARow = 100;

        var data = "ffconcat version 1.0\n"

        data += `file 'http://localhost:${process.env.PORT}/stream?channel=${channelNum}&first=1'\n`
        for (var i = 0; i < maxStreamsToPlayInARow - 1; i++) {
            data += `file 'http://localhost:${process.env.PORT}/stream?channel=${channelNum}'\n`
        }

        res.send(data)
    })
    return router
}
