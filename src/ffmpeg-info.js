const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

class FFMPEGInfo {

    constructor(env, dbPath) {
        this.initialized = false;
        this.env = env;
        this.dbPath = dbPath;
        this.ffmpegPath = null;
        this.origin = "Not found";
    }

    async initialize() {
        let selectedPath = null;
        if (typeof(this.env.DIZQUETV_FFMPEG_PATH) === "string") {
            selectedPath = this.env.DIZQUETV_FFMPEG_PATH;
            this.origin = "env.DIZQUETV_FFMPEG_PATH";
        } else {
            selectedPath = await this.getPathFromFile(this.dbPath, 'ffmpeg-path.json');
            this.origin = "ffmpeg-path.json";
        }
        if (selectedPath == null) {
            //windows Path environment var
            let paths = this.env.Path;
            if (typeof(paths) === "string") {
                let maybe = paths.split(";").filter(
                    (str) => str.contains("ffmpeg" )
                )[0];
                if (typeof(maybe) === "string") {
                    selectedPath = path.join(maybe, "ffmpeg.exe");
                    this.origin = "Widnows Env. Path";
                }
            }
        }
        if (selectedPath == null) {
            //Default install path for ffmpeg in n*x OSes.
            // if someone has built ffmpeg manually or wants an alternate
            // path, they are most likely capable of configuring it manually.
            selectedPath = "/usr/bin/ffmpeg";
            this.origin = "Default";
        }

        if (selectedPath != null) {
            let version = await this.checkVersion(selectedPath);
            if (version == null) {
                selectedPath = null;
            } else {
                console.log(`FFmpeg found: ${selectedPath} from: ${this.origin}. version: ${version}`);
                this.ffmpegPath = selectedPath;
            }
        }
        this.initialized = true;

    }

    async getPath() {
        if (! this.initialized) {
            await this.initialize();
        }
        return this.ffmpegPath;
    }

    async getPathFromFile(folder, fileName) {
        let f = path.join(folder, fileName);
        try {
            let json = await new Promise( (resolve, reject) => {
                fs.readFile(f, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    try {
                        resolve( JSON.parse(data) )
                    } catch (err) {
                        reject(err);
                    }
                })
            });
            let ffmpeg = json["ffmpegPath"];
            if (typeof(ffmpeg) === "string") {
                return ffmpeg;
            } else {
                return null;
            }
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async checkVersion(ffmpegPath) {
        try {
            let s = await new Promise( (resolve, reject) => {
                exec( `"${ffmpegPath}" -version`, function(error, stdout, stderr){
                    if (error !== null) {
                        reject(error);
                    } else {
                        resolve(stdout);
                    }
                });
            });
            var m = s.match( /version\s+([^\s]+)\s+.*Copyright/ )
            if (m == null) {
                console.error("ffmpeg -version command output not in the expected format: " + s);
                return "Unknown";
            }
            return m[1];
        } catch (err) {
            console.error("Error getting ffmpeg version", err);
            return null;
        }
    }


    async getVersion() {
        if (! this.initialized) {
            await this.initialize();
        }
        let version = await this.checkVersion(this.ffmpegPath);
        if (version == null) {
            return "Error";
        } else {
            return version;
        }
    }
}

module.exports = FFMPEGInfo