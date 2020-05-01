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
                scope.settings.args =  `-threads ${ scope.settings.threads }
-ss STARTTIME
-t DURATION
-re
-i INPUTFILE${ scope.settings.deinterlace ? `\n-vf yadif` : `` }
-map 0:v
-map AUDIOSTREAM
-c:v ${ scope.settings.videoEncoder}
-c:a ${ scope.settings.audioEncoder}
-ac ${ scope.settings.audioChannels}
-ar ${ scope.settings.audioRate}
-b:a ${ scope.settings.audioBitrate}
-b:v ${ scope.settings.videoBitrate}
-s ${ scope.settings.videoResolution}
-r ${ scope.settings.videoFrameRate}
-flags cgop+ilme
-sc_threshold 1000000000
-minrate:v ${ scope.settings.videoBitrate}
-maxrate:v ${ scope.settings.videoBitrate}
-bufsize:v ${ scope.settings.bufSize}
-f mpegts
-output_ts_offset TSOFFSET
OUTPUTFILE`
                
            }
        }
    }
}