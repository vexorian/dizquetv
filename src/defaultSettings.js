    function ffmpeg() {
        return {
            //a record of the config version will help migrating between versions
            // in the future. Always increase the version when new ffmpeg configs
            // are added.
            //
            // configVersion 3: First versioned config.
            //
            configVersion: 4,
            ffmpegPath: "/usr/bin/ffmpeg",
            threads: 4,
            concatMuxDelay: "0",
            logFfmpeg: false,
            enableFFMPEGTranscoding: false,
            audioVolumePercent: 100,
            videoEncoder: "mpeg2video",
            audioEncoder: "ac3",
            targetResolution: "1920x1080",
            videoBitrate: 10000,
            videoBufSize: 2000,
            audioBitrate: 192,
            audioBufSize: 50,
            audioSampleRate: 48,
            audioChannels: 2,
            errorScreen: "pic",
            errorAudio: "silent",
            normalizeVideoCodec: false,
            normalizeAudioCodec: false,
            normalizeResolution: false,
            normalizeAudio: false,
        }
    }

    function repairFFmpeg(existingConfigs) {
        var hasBeenRepaired = false;
        var currentConfig = {};
        var _id = null;
        if (existingConfigs.length === 0) {
            currentConfig = {};
        } else {
            currentConfig = existingConfigs[0];
            _id = currentConfig._id;
        }
        if (
            (typeof(currentConfig.configVersion) === 'undefined')
            || (currentConfig.configVersion < 3)
        ) {
            hasBeenRepaired = true;
            currentConfig = ffmpeg();
            currentConfig._id = _id;
        }
        if (currentConfig.configVersion == 3) {
            //migrate from version 3 to 4
            hasBeenRepaired = true;
            //new settings:
            currentConfig.audioBitrate = 192;
            currentConfig.audioBufSize = 50;
            currentConfig.audioChannels = 2;
            currentConfig.audioSampleRate = 48;
            //this one has been renamed:
            currentConfig.normalizeAudio = currentConfig.alignAudio;
            currentConfig.configVersion = 4;
        }
        return {
            hasBeenRepaired: hasBeenRepaired,
            fixedConfig : currentConfig,
        };
    }

module.exports = {
    ffmpeg: ffmpeg,
    repairFFmpeg: repairFFmpeg,
}