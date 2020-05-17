    module.exports = function (pseudotv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/ffmpeg-settings.html',
        replace: true,
        scope: {
        },
        link: function (scope, element, attrs) {
            pseudotv.getFfmpegSettings().then((settings) => {
                scope.settings = settings
                if (typeof scope.settings.args === 'undefined')
                    scope.createArgString()
            })
            scope.updateSettings = (settings) => {
                pseudotv.updateFfmpegSettings(settings).then((_settings) => {
                    scope.settings = _settings
                    if (typeof scope.settings.args === 'undefined')
                        scope.createArgString()
                })
            }
            scope.resetSettings = (settings) => {
                pseudotv.resetFfmpegSettings(settings).then((_settings) => {
                    scope.settings = _settings
                    if (typeof scope.settings.args === 'undefined')
                        scope.createArgString()
                })
            }
            scope.createArgString = () => {
            if (scope.settings.videoStreamMode == 'transcodeVideo') {
                scope.settings.videoArgs = `-c:v ${ scope.settings.videoEncoder }
-b:v ${ scope.settings.videoBitrate }k
-s ${ scope.settings.videoResolution }
-r ${ scope.settings.videoFrameRate }
-flags cgop+ilme
-sc_threshold 1000000000
-minrate:v ${ scope.settings.videoBitrate }k
-maxrate:v ${ scope.settings.videoBitrate }k
-bufsize:v ${ scope.settings.videoBufSize }k
-flags cgop+ilme
-sc_threshold 1000000000
-minrate:v ${ scope.settings.videoBitrate }k
-maxrate:v ${ scope.settings.videoBitrate }k
-bufsize:v ${ scope.settings.videoBufSize }k`
            } else {
                scope.settings.videoArgs = `-c:v copy`
            }

            if (scope.settings.audioStreamMode == 'transcodeAudio') {
                scope.settings.audioArgs = `-c:a ${ scope.settings.audioEncoder }
-ac ${ scope.settings.audioChannels }
-ar ${ scope.settings.audioRate }
-b:a ${ scope.settings.audioBitrate }k`
            } else if (scope.settings.audioStreamMode == 'transcodeAudioBestMatch') {
                scope.settings.audioArgs = `-c:a AUDIOBESTMATCHSETTINGS`
            } else {
                scope.settings.audioArgs = `-c:a copy`
            }

            scope.settings.args =  `-threads ${ scope.settings.threads }
-ss STARTTIME
-t DURATION
-re
-i INPUTFILE${ scope.settings.deinterlace ? `\n-vf yadif` : `` }
-map VIDEOSTREAM
-map AUDIOSTREAM
${scope.settings.videoArgs}
${scope.settings.audioArgs}
-metadata service_provider="PseudoTV"
-metadata CHANNELNAME
-f mpegts
-output_ts_offset TSOFFSET
-muxdelay 0
-muxpreload 0
OUTPUTFILE`             
            }
            scope.videoStreamOptions=[
                {id:"transcodeVideo",description:"Transcode"},
                {id:"directStreamVideo",description:"Direct Stream"}
            ];
            scope.hideIfNotTranscodeVideo = () => {
                return scope.settings.videoStreamMode != 'transcodeVideo'
            };
            scope.hideIfNotDirectStreamVideo = () => {
                return scope.settings.videoStreamMode != 'directStreamVideo'
            };
            scope.audioStreamOptions=[
                {id:"transcodeAudio",description:"Transcode"},
                {id:"transcodeAudioBestMatch",description:"Transcode based on source channels"},
                {id:"directStreamAudio",description:"Direct Stream"}
            ];
            scope.hideIfNotTranscodeAudio2ch = () => {
                return scope.settings.audioStreamMode != 'transcodeAudio'
            };
            scope.hideIfNotTranscodeAudioBestMatch = () => {
                return scope.settings.audioStreamMode != 'transcodeAudioBestMatch'
            };
            scope.hideIfNotDirectStreamAudio = () => {
                return scope.settings.audioStreamMode != 'directStreamAudio'
            };
        }
    }
}