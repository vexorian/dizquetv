/******************
 * This module has to follow the program-player contract.
 * Async call to get a stream.
 * * If connection to plex or the file entry fails completely before playing
 *   it rejects the promise and the error is an Error() class.
 * * Otherwise it returns a stream.
 **/
const PlexTranscoder = require('./plexTranscoder')
const EventEmitter = require('events');
const helperFuncs = require('./helperFuncs')
const FFMPEG = require('./ffmpeg')
const constants = require('./constants');

let USED_CLIENTS = {};

class PlexPlayer {

    constructor(context) {
        this.context = context;
        this.ffmpeg = null;
        this.plexTranscoder = null;
        this.killed = false;
        let coreClientId = this.context.db['client-id'].find()[0].clientId;
        let i = 0;
        while ( USED_CLIENTS[coreClientId+"-"+i]===true) {
            i++;
        }
        this.clientId = coreClientId+"-"+i;
        USED_CLIENTS[this.clientId] = true;
    }

    cleanUp() {
        USED_CLIENTS[this.clientId] = false;
        this.killed = true;
        if (this.plexTranscoder != null) {
            this.plexTranscoder.stopUpdatingPlex();
            this.plexTranscoder = null;
        }
        if (this.ffmpeg != null) {
            this.ffmpeg.kill();
            this.ffmpeg = null;
        }
    }

    async play(outStream) {
        let lineupItem = this.context.lineupItem;
        let ffmpegSettings = this.context.ffmpegSettings;
        let db = this.context.db;
        let channel = this.context.channel;
        let server = db['plex-servers'].find( { 'name': lineupItem.serverKey } );
        if (server.length == 0) {
            throw Error(`Unable to find server "${lineupItem.serverKey}" specified by program.`);
        }
        server = server[0];
        if (server.uri.endsWith("/")) {
            server.uri = server.uri.slice(0, server.uri.length - 1);
        }

        try {
            let plexSettings = db['plex-settings'].find()[0];
            let plexTranscoder = new PlexTranscoder(this.clientId, server, plexSettings, channel, lineupItem);
            this.plexTranscoder = plexTranscoder;
            let watermark = this.context.watermark;
            let ffmpeg = new FFMPEG(ffmpegSettings, channel);  // Set the transcoder options
            ffmpeg.setAudioOnly( this.context.audioOnly );
            this.ffmpeg = ffmpeg;
            
            // Get basic parameters
            let seek = typeof lineupItem.seekPosition === 'number' ? lineupItem.seekPosition : 0;
            let end = typeof lineupItem.endPosition === 'number' ? lineupItem.endPosition : null;
            let currentElapsed = typeof lineupItem.start === 'number' ? lineupItem.start : 0;
            let programEnd = end !== null ? end : lineupItem.duration;
            
            let deinterlace = ffmpegSettings.enableFFMPEGTranscoding;
            
            // Get stream first so we can handle direct play correctly
            let stream = await plexTranscoder.getStream(deinterlace);
            if (this.killed) {
                return;
            }
            
            // Calculate parameters differently for direct play vs transcoded mode
            let streamDuration;
            let streamStart;
            
            if (stream.directPlay) {
                // DIRECT PLAY:
                // 1. Calculate duration from endPos to currentElapsed (not from seek to endPos)
                streamDuration = Math.max(0, programEnd - currentElapsed) / 1000;
                
                // 2. Start should be ONLY currentElapsed 
                streamStart = currentElapsed / 1000;
                
                console.log(`[PLEX-PLAYER] Direct Play: Using duration=${streamDuration}s (from currentElapsed=${currentElapsed/1000}s to endPos=${programEnd/1000}s)`);
                
                // For direct play, ignore the streamDuration override with custom end times
                if (end !== null && typeof(lineupItem.streamDuration) !== 'undefined') {
                    // Store original value for reference
                    stream.streamStats.originalDuration = lineupItem.streamDuration;
                    stream.streamStats.duration = Math.max(streamDuration * 1000, 60000);
                    
                    console.log(`[PLEX-PLAYER] Direct Play: Custom end time detected, ignoring streamDuration override: ${lineupItem.streamDuration/1000}s`);
                    lineupItem.streamDuration = undefined;
                }
            } else {
                // TRANSCODED: Keep existing behavior
                streamStart = undefined; // Plex handles this internally for transcoded streams
                
                // Calculate duration based on programEnd and seek
                streamDuration = Math.max(0, programEnd - seek) / 1000;
                
                // Apply streamDuration override if present - only for transcoded streams
                if (typeof(lineupItem.streamDuration) !== 'undefined') {
                    streamDuration = lineupItem.streamDuration / 1000;
                    console.log(`[PLEX-PLAYER] Transcoding: Using override streamDuration: ${streamDuration}s`);
                }
                
                console.log(`[PLEX-PLAYER] Transcoding: Using duration=${streamDuration}s (seek=${seek/1000}s, end=${programEnd/1000}s)`);
            }
            
            let streamStats = stream.streamStats;
            
            // Ensure we have a valid duration for error handling
            if (!streamStats.duration) {
                streamStats.duration = Math.max(streamDuration * 1000, 60000);
            }

            let emitter = new EventEmitter();
            //setTimeout( () => {
                let ff = await ffmpeg.spawnStream(stream.streamUrl, stream.streamStats, streamStart, streamDuration, watermark, lineupItem.type); // Spawn the ffmpeg process
                ff.pipe(outStream,  {'end':false} );
            //}, 100);
            plexTranscoder.startUpdatingPlex();

            
            ffmpeg.on('end', () => {
                emitter.emit('end');
            });
            ffmpeg.on('close', () => {
                emitter.emit('close');
            });
            ffmpeg.on('error', async (err) => {
                console.log("Replacing failed stream with error stream");
                ff.unpipe(outStream);
                ffmpeg.removeAllListeners('data');
                ffmpeg.removeAllListeners('end');
                ffmpeg.removeAllListeners('error');
                ffmpeg.removeAllListeners('close');
                ffmpeg = new FFMPEG(ffmpegSettings, channel);  // Set the transcoder options
                ffmpeg.setAudioOnly(this.context.audioOnly);
                ffmpeg.on('close', () => {
                    emitter.emit('close');
                });
                ffmpeg.on('end', () => {
                    emitter.emit('end');
                });
                ffmpeg.on('error', (err) => {
                    emitter.emit('error', err );
                });

                ff = await ffmpeg.spawnError('oops', 'oops', Math.min(streamStats.duration, 60000) );
                ff.pipe(outStream);

                emitter.emit('error', err);
            });
            return emitter;

        } catch(err) {
            return Error("Error when playing plex program: " + JSON.stringify(err) );
        }
    }
}

module.exports = PlexPlayer;
