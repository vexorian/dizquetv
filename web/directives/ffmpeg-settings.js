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
            })
            scope.updateSettings = (settings) => {
                pseudotv.updateFfmpegSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.resetSettings = (settings) => {
                pseudotv.resetFfmpegSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.isTranscodingNotNeeded = () => {
                return ! (scope.settings.enableFFMPEGTranscoding)
            };
            scope.hideIfNotAutoPlay = () => {
                return scope.settings.enableAutoPlay != true
            };
            scope.resolutionOptions=[
                {id:"420x420",description:"420x420 (1:1)"},
                {id:"576x320",description:"576x320 (18:10)"},
                {id:"640×360",description:"640×360 (nHD 16:9)"},
                {id:"720x480",description:"720x480 (WVGA 3:2)"},
                {id:"800x600",description:"800x600 (SVGA 4:3)"},
                {id:"1024x768",description:"1024x768 (WXGA 4:3)"},
                {id:"1280x720",description:"1280x720 (HD 16:9)"},
                {id:"1920x1080",description:"1920x1080 (FHD 16:9)"},
                {id:"3840x2160",description:"3840x2160 (4K 16:9)"},
            ];
            scope.muxDelayOptions=[
                {id:"0",description:"0 Seconds"},
                {id:"1",description:"1 Seconds"},
                {id:"2",description:"2 Seconds"},
                {id:"3",description:"3 Seconds"},
                {id:"4",description:"4 Seconds"},
                {id:"5",description:"5 Seconds"},
                {id:"10",description:"10 Seconds"},
            ];
            scope.errorScreens = [
                {value:"pic", description:"images/generic-error-screen.png"},
                {value:"blank", description:"Blank Screen"},
                {value:"static", description:"Static"},
                {value:"testsrc", description:"Test Pattern (color bars + timer)"},
                {value:"text", description:"Detailed error (requires ffmpeg with drawtext)"},
                {value:"kill", description:"Stop stream, show errors in logs"},
            ]
            scope.errorAudios = [
                {value:"whitenoise", description:"White Noise"},
                {value:"sine", description:"Beep"},
                {value:"silent", description:"No Audio"},
            ]
        }
    }
}