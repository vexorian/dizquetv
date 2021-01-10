const express = require('express')
const helperFuncs = require('./helperFuncs')
const FFMPEG = require('./ffmpeg')
const FFMPEG_TEXT = require('./ffmpegText')
const PlexTranscoder = require('./plexTranscoder')
const fs = require('fs')
const ProgramPlayer = require('./program-player');
const channelCache  = require('./channel-cache')
const wereThereTooManyAttempts = require('./throttler');

module.exports = { router: video }

let StreamCount = 0;

function video( channelDB , fillerDB, db) {
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
    router.get('/video', async (req, res) => {
        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(500).send("No Channel Specified")
            return
        }
        let number = parseInt(req.query.channel, 10);
        let channel =  await channelCache.getChannelConfig(channelDB, number);
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
        let ff = await ffmpeg.spawnConcat(`http://localhost:${process.env.PORT}/playlist?channel=${channelNum}`);
        ff.pipe(res );
    })
    // Stream individual video to ffmpeg concat above. This is used by the server, NOT the client
    router.get('/stream', async (req, res) => {
        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(400).send("No Channel Specified")
            return
        }
        let session = parseInt(req.query.session);
        let m3u8 = (req.query.m3u8 === '1');
        let number = parseInt(req.query.channel);
        let channel = await channelCache.getChannelConfig(channelDB, number);

        if (channel.length === 0) {
            res.status(404).send("Channel doesn't exist")
            return
        }
        let isLoading = false;
        if ( (typeof req.query.first !== 'undefined') && (req.query.first=='0') ) {
            isLoading = true;
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
      let prog = null;
      let brandChannel = channel;
      let redirectChannels = [];
      let upperBounds = [];

      if (isLoading) {
          lineupItem = {
             type: 'loading',
             streamDuration: 40,
             duration: 40,
             start: 0,
          };
      } else if (lineupItem == null) {
        prog = helperFuncs.getCurrentProgramAndTimeElapsed(t0, channel);
        
        while (true) {
            redirectChannels.push( brandChannel );
            upperBounds.push( prog.program.duration - prog.timeElapsed );

            if ( !(prog.program.isOffline) || (prog.program.type != 'redirect') ) {
                break;
            }
            channelCache.recordPlayback( brandChannel.number, t0, {
                /*type: 'offline',*/
                title: 'Error',
                err: Error("Recursive channel redirect found"),
                duration : 60000,
                start: 0,
            });



            let newChannelNumber= prog.program.channel;
            let newChannel = await channelCache.getChannelConfig(channelDB, newChannelNumber);

            if (newChannel.length == 0) {
                let err = Error("Invalid redirect to a channel that doesn't exist");
                console.error("Invalid redirect to channel that doesn't exist.", err);
                prog = {
                    program: {
                        isOffline: true,
                        err: err,
                        duration : 60000,
                    },
                    timeElapsed: 0,
                }
                continue;
            }
            newChannel = newChannel[0];
            brandChannel = newChannel;
            lineupItem = channelCache.getCurrentLineupItem( newChannel.number, t0);
            if (lineupItem != null) {
                lineupItem = JSON.parse( JSON.stringify(lineupItem)) ;
                break;
            } else {
                prog = helperFuncs.getCurrentProgramAndTimeElapsed(t0, newChannel);
            }
        }
      }
      if (lineupItem == null) {
        if (prog == null) {
            res.status(500).send("server error");
            throw Error("Shouldn't prog be non-null?");
        }
        if (prog.program.isOffline && channel.programs.length == 1 && prog.programIndex != -1) {
            //there's only one program and it's offline. So really, the channel is
            //permanently offline, it doesn't matter what duration was set
            //and it's best to give it a long duration to ensure there's always
            //filler to play (if any)
            let t = 365*24*60*60*1000;
            prog.program = {
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
        let fillers = await fillerDB.getFillersFromChannel(brandChannel);
        let lineup = helperFuncs.createLineup(prog, brandChannel, fillers, isFirst)
        lineupItem = lineup.shift()
      }

        if ( !isLoading && (lineupItem != null) ) {
            let upperBound = 1000000000;
            //adjust upper bounds and record playbacks
            for (let i = redirectChannels.length-1; i >= 0; i--) {
                lineupItem = JSON.parse( JSON.stringify(lineupItem ));
                let u = upperBounds[i];
                if (typeof(u) !== 'undefined') {
                    let u2 = upperBound;
                    if ( typeof(lineupItem.streamDuration) !== 'undefined') {
                        u2 = Math.min(u2, lineupItem.streamDuration);
                    }
                    lineupItem.streamDuration = Math.min(u2, u);
                    upperBound = lineupItem.streamDuration;
                }
                channelCache.recordPlayback( redirectChannels[i].number, t0, lineupItem );
            }
        }
 

        console.log("=========================================================");
        console.log("! Start playback");
        console.log(`! Channel: ${channel.name} (${channel.number})`);
        if (typeof(lineupItem.title) === 'undefined') {
            lineupItem.title = 'Unknown';
        }
        console.log(`! Title: ${lineupItem.title}`);
        if ( typeof(lineupItem.streamDuration) === 'undefined') {
            console.log(`! From : ${lineupItem.start}`);
        } else {
            console.log(`! From : ${lineupItem.start} to: ${lineupItem.start + lineupItem.streamDuration}`);
        }
        console.log("=========================================================");

        if (! isLoading) {
            channelCache.recordPlayback(channel.number, t0, lineupItem);
        }
        if (wereThereTooManyAttempts(session, lineupItem)) {
            lineupItem = {
                isOffline: true,
                err: Error("Too many attempts, throttling.."),
                duration : 60000,
            };
        }
        
        let combinedChannel = JSON.parse( JSON.stringify(brandChannel) );
        combinedChannel.transcoding = channel.transcoding;

        let playerContext = {
            lineupItem : lineupItem,
            ffmpegSettings : ffmpegSettings,
            channel: combinedChannel,
            db: db,
            m3u8: m3u8,
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
        res.writeHead(200, {
            'Content-Type': 'video/mp2t'
        });
        try {
            playerObj = await player.play(res);
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


        let stream = playerObj;



        //res.write(playerObj.data);


        stream.on("end", () => {
            stop();
        });
        res.on("close", () => {
            console.log("Client Closed");
            stop();
        });
    });


    router.get('/m3u8',  async (req, res) => {
        let sessionId = StreamCount++;

        //res.type('application/vnd.apple.mpegurl')
        res.type("application/x-mpegURL");

        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(500).send("No Channel Specified")
            return
        }

        let channelNum = parseInt(req.query.channel, 10)
        let channel =  await channelCache.getChannelConfig(channelDB, channelNum );
        if (channel.length === 0) {
            res.status(500).send("Channel doesn't exist")
            return
        }

        // Maximum number of streams to concatinate beyond channel starting
        // If someone passes this number then they probably watch too much television
        let maxStreamsToPlayInARow = 100;

        var data = "#EXTM3U\n"

        data += `#EXT-X-VERSION:3
        #EXT-X-MEDIA-SEQUENCE:0
        #EXT-X-ALLOW-CACHE:YES
        #EXT-X-TARGETDURATION:60
        #EXT-X-PLAYLIST-TYPE:VOD\n`;

        let ffmpegSettings = db['ffmpeg-settings'].find()[0]

        cur ="59.0";

        if ( ffmpegSettings.enableFFMPEGTranscoding === true) {
            //data += `#EXTINF:${cur},\n`;
            data += `${req.protocol}://${req.get('host')}/stream?channel=${channelNum}&first=0&m3u8=1&session=${sessionId}\n`;
        }
        //data += `#EXTINF:${cur},\n`;
        data += `${req.protocol}://${req.get('host')}/stream?channel=${channelNum}&first=1&m3u8=1&session=${sessionId}\n`
        for (var i = 0; i < maxStreamsToPlayInARow - 1; i++) {
            //data += `#EXTINF:${cur},\n`;
            data += `${req.protocol}://${req.get('host')}/stream?channel=${channelNum}&m3u8=1&session=${sessionId}\n`
        }

        res.send(data)
    })
    router.get('/playlist', async (req, res) => {
        res.type('text')

        // Check if channel queried is valid
        if (typeof req.query.channel === 'undefined') {
            res.status(500).send("No Channel Specified")
            return
        }

        let channelNum = parseInt(req.query.channel, 10)
        let channel = await channelCache.getChannelConfig(channelDB, channelNum );
        if (channel.length === 0) {
            res.status(500).send("Channel doesn't exist")
            return
        }

        // Maximum number of streams to concatinate beyond channel starting
        // If someone passes this number then they probably watch too much television
        let maxStreamsToPlayInARow = 100;

        var data = "ffconcat version 1.0\n"

        let ffmpegSettings = db['ffmpeg-settings'].find()[0]

        let sessionId = StreamCount++;

        if (
               (ffmpegSettings.enableFFMPEGTranscoding === true)
            && (ffmpegSettings.normalizeVideoCodec === true)
            && (ffmpegSettings.normalizeAudioCodec === true)
            && (ffmpegSettings.normalizeResolution === true)
            && (ffmpegSettings.normalizeAudio === true)
        ) {
            data += `file 'http://localhost:${process.env.PORT}/stream?channel=${channelNum}&first=0&session=${sessionId}'\n`;
        }
        data += `file 'http://localhost:${process.env.PORT}/stream?channel=${channelNum}&first=1&session=${sessionId}'\n`
        for (var i = 0; i < maxStreamsToPlayInARow - 1; i++) {
            data += `file 'http://localhost:${process.env.PORT}/stream?channel=${channelNum}&session=${sessionId}'\n`
        }

        res.send(data)
    })

    router.get('/media-player/:number.m3u', async (req, res) => {
        try {
            let channelNum = parseInt(req.params.number, 10);
            let channel = await channelCache.getChannelConfig(channelDB, channelNum );
            if (channel.length === 0) {
                res.status(404).send("Channel not found.");
                return;
            }
            res.type('video/x-mpegurl');
            let path ="video";
            if (req.query.fast==="1") {
                path ="m3u8";
            }
            res.status(200).send(`#EXTM3U\n${req.protocol}://${req.get('host')}/${path}?channel=${channelNum}\n\n`);
        } catch(err) {
            console.error(err);
            res.status(500).send("There was an error.");
        }
    });

    return router
}
