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

    async play() {
        let lineupItem = this.context.lineupItem;
        let ffmpegSettings = this.context.ffmpegSettings;
        let db = this.context.db;
        let channel = this.context.channel;

        try {
            let plexSettings = db['plex-settings'].find()[0];
            let plexTranscoder = new PlexTranscoder(this.clientId, plexSettings, channel, lineupItem);
            this.plexTranscoder = plexTranscoder;
            let enableChannelIcon = this.context.enableChannelIcon;
            let ffmpeg = new FFMPEG(ffmpegSettings, channel);  // Set the transcoder options
            this.ffmpeg = ffmpeg;
            let streamDuration;
            if (typeof(streamDuration)!=='undefined') {
                streamDuration = lineupItem.streamDuration / 1000;
            }
            let deinterlace = ffmpegSettings.enableFFMPEGTranscoding; //for now it will always deinterlace when transcoding is enabled but this is sub-optimal

            let stream = await plexTranscoder.getStream(deinterlace);
            if (this.killed) {
                return;
            }

            //let streamStart = (stream.directPlay) ? plexTranscoder.currTimeS : undefined;
            //let streamStart = (stream.directPlay) ? plexTranscoder.currTimeS : lineupItem.start;
            let streamStart = (stream.directPlay) ? plexTranscoder.currTimeS : undefined;
            let streamStats = stream.streamStats;
            streamStats.duration = lineupItem.streamDuration;

            let emitter = new EventEmitter();
            //setTimeout( () => {
                ffmpeg.spawnStream(stream.streamUrl, stream.streamStats, streamStart, streamDuration, enableChannelIcon, lineupItem.type); // Spawn the ffmpeg process
            //}, 100);
            plexTranscoder.startUpdatingPlex();

            ffmpeg.on('data', (data) => {
                emitter.emit('data', data);
            });
            ffmpeg.on('end', () => {
                emitter.emit('end');
            });
            ffmpeg.on('close', () => {
                emitter.emit('close');
            });
            ffmpeg.on('error', (err) => {
                emitter.emit('error', err);
            });
            return emitter;

        } catch(err) {
            if (err instanceof Error) {
                throw err;
            } else {
                return Error("Error when playing plex program: " + JSON.stringify(err) );
            }
        }
    }
}

module.exports = PlexPlayer;
