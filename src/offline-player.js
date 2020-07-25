/******************
 * Offline player is for special screens, like the error
 * screen or the Flex Fallback screen.
 *
 * This module has to follow the program-player contract.
 * Asynchronous call to return a stream. Then the stream
 * can be used to play the program.
 **/
const EventEmitter = require('events');
const FFMPEG = require('./ffmpeg')

class OfflinePlayer {
    constructor(error, context) {
        this.context = context;
        this.error = error;
        this.ffmpeg = new FFMPEG(context.ffmpegSettings, context.channel);
    }

    cleanUp() {
        this.ffmpeg.kill();
    }

    async play() {
        try {
            let emitter = new EventEmitter();
            let ffmpeg = this.ffmpeg;
            let lineupItem = this.context.lineupItem;
            let duration = lineupItem.streamDuration - lineupItem.start;
            if (this.error) {
                ffmpeg.spawnError(duration);
            } else {
                ffmpeg.spawnOffline(duration);
            }

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
                throw Error("Error when attempting to play offline screen: " + JSON.stringify(err) );
            }
        }
    }


}

module.exports = OfflinePlayer;
