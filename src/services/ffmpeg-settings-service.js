const databaseMigration = require('../database-migration');
const DAY_MS = 1000 * 60 * 60 * 24;
const path = require('path');
const fs = require('fs');

class FfmpegSettingsService {
    constructor(db, unlock) {
        this.db = db;
        if (unlock) {
            this.unlock();
        }
    }

    get() {
        let ffmpeg = this.getCurrentState();
        if (isLocked(ffmpeg)) {
            ffmpeg.lock = true;
        }
        // Hid this info from the API
        delete ffmpeg.ffmpegPathLockDate;
        return ffmpeg;
    }

    unlock() {
        let ffmpeg = this.getCurrentState();
        console.log("ffmpeg path UI unlocked for another day...");
        ffmpeg.ffmpegPathLockDate = new Date().getTime() + DAY_MS;
        this.db['ffmpeg-settings'].update({ _id: ffmpeg._id }, ffmpeg)
    }


    update(attempt) {
        let ffmpeg = this.getCurrentState();
        attempt.ffmpegPathLockDate = ffmpeg.ffmpegPathLockDate;
        if (isLocked(ffmpeg)) {
            console.log("Note: ffmpeg path is not being updated since it's been locked for your security.");
            attempt.ffmpegPath = ffmpeg.ffmpegPath;
            if (typeof(ffmpeg.ffmpegPathLockDate) === 'undefined') {
                // make sure to lock it even if it was undefined
                attempt.ffmpegPathLockDate = new Date().getTime() - DAY_MS;
            }
        } else if (attempt.addLock === true) {
            // lock it right now
            attempt.ffmpegPathLockDate = new Date().getTime() - DAY_MS;
        } else {
            attempt.ffmpegPathLockDate = new Date().getTime() + DAY_MS;
        }
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
        // Even if reseting, it's impossible to unlock the ffmpeg path
        let ffmpeg = databaseMigration.defaultFFMPEG() ;
        this.update(ffmpeg);
        return this.get();
    }

    getCurrentState() {
        return this.db['ffmpeg-settings'].find()[0]
    }


}

function fixupFFMPEGSettings(ffmpeg) {
    if (typeof(ffmpeg.ffmpegPath) !== 'string') {
        return "ffmpeg path is required."
    }
    if (! isValidFilePath(ffmpeg.ffmpegPath)) {
        return "ffmpeg path must be a valid file path."
    }

    if (typeof(ffmpeg.maxFPS) === 'undefined') {
      ffmpeg.maxFPS = 60;
      return null;
    } else if ( isNaN(ffmpeg.maxFPS) ) {
      return "maxFPS should be a number";
    }
}

//These checks are good but might not be enough, as long as we are letting the
//user choose any path and we are making dizqueTV execute, it is too risky,
//hence why we are also adding the lock feature on top of these checks.
function isValidFilePath(filePath) {
    const normalizedPath = path.normalize(filePath);
  
    if (!path.isAbsolute(normalizedPath)) {
      return false;
    }
  
    try {
      const stats = fs.statSync(normalizedPath);
      return stats.isFile();
    } catch (err) {
      // Handle potential errors (e.g., file not found, permission issues)
      if (err.code === 'ENOENT') {
        return false; // File does not exist
      } else {
        throw err; // Re-throw other errors for debugging
      }
    }
}

function isLocked(ffmpeg) {
    return isNaN(ffmpeg.ffmpegPathLockDate) || ffmpeg.ffmpegPathLockDate < new Date().getTime();
}



module.exports =FfmpegSettingsService;