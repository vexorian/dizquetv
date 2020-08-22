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
        if (context.isLoading === true) {
            context.channel = JSON.parse( JSON.stringify(context.channel) );
            context.channel.offlinePicture = `http://localhost:${process.env.PORT}/images/loading-screen.png`;
            context.channel.offlineSoundtrack = undefined;
        }
        this.ffmpeg = new FFMPEG(context.ffmpegSettings, context.channel);
    }

    cleanUp() {
        this.ffmpeg.kill();
    }

    async play(outStream) {
        try {
            let emitter = new EventEmitter();
            let ffmpeg = this.ffmpeg;
            let lineupItem = this.context.lineupItem;
            let duration = lineupItem.streamDuration - lineupItem.start;
            let ff;
            if (this.error) {
                ff = await ffmpeg.spawnError(duration);
            } else {
                ff = await ffmpeg.spawnOffline(duration);
            }
            ff.pipe(outStream);

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
