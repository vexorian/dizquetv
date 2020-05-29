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
            scope.hideIfNotEnableChannelOverlay = () => {
                return scope.settings.enableChannelOverlay != true
            };
            scope.hideIfNotAutoPlay = () => {
                return scope.settings.enableAutoPlay != true
            };
            scope.resolutionOptions=[
                {id:"420",description:"420x420"},
                {id:"320",description:"576x320"},
                {id:"480",description:"720x480"},
                {id:"768",description:"1024x768"},
                {id:"720",description:"1280x720"},
                {id:"1080",description:"1920x1080"},
                {id:"2160",description:"3840x2160"},
                {id:"unchanged",description:"Same as source"}
            ];
        }
    }
}