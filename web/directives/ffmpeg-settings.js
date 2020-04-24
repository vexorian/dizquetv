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
        }
    }
}