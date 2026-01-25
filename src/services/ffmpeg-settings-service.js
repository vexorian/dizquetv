const databaseMigration = require('../database-migration');
const DAY_MS = 1000 * 60 * 60 * 24;

class FfmpegSettingsService {
    constructor(db) {
        this.db = db;
    }

    get() {
        let ffmpeg = this.getCurrentState();
        // Hid this info from the API
        delete ffmpeg.ffmpegPathLockDate;
        return ffmpeg;
    }


    update(attempt) {
        let ffmpeg = this.getCurrentState();
        delete attempt.ffmpegPathLockDate;
        delete attempt.addLock;
        delete attempt.lock;

        let err = fixupFFMPEGSettings(attempt);
        if ( typeof(err) !== "undefined" ) {
            return {
                error: err
            }
        }

        this.db['ffmpeg-settings'].update({ _id: ffmpeg._id }, attempt)
        return {
            ffmpeg: this.get()
        }
    }

    reset() {
        let ffmpeg = databaseMigration.defaultFFMPEG() ;
        this.update(ffmpeg);
        return this.get();
    }

    getCurrentState() {
        return this.db['ffmpeg-settings'].find()[0]
    }


}

function fixupFFMPEGSettings(ffmpeg) {
 
    if (typeof(ffmpeg.maxFPS) === 'undefined') {
      ffmpeg.maxFPS = 60;
      return null;
    } else if ( isNaN(ffmpeg.maxFPS) ) {
      return "maxFPS should be a number";
    }
}




module.exports =FfmpegSettingsService;