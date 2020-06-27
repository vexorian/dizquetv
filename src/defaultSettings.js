module.exports = {

    ffmpeg: () => {
        return {
            //a record of the config version will help migrating between versions
            // in the future. Always increase the version when new ffmpeg configs
            // are added.
            //
            // configVersion 3: First versioned config.
            //
            configVersion: 3,
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
            errorScreen: "pic",
            errorAudio: "silent",
            normalizeVideoCodec: false,
            normalizeAudioCodec: false,
            normalizeResolution: false,
            alignAudio: false,
        }
    }
}
