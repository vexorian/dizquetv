module.exports = function (pseudotv, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/hdhr-settings.html',
        replace: true,
        scope: {
        },
        link: function (scope, element, attrs) {
            pseudotv.getHdhrSettings().then((settings) => {
                scope.settings = settings
            })
            scope.updateSettings = (settings) => {
                if (settings.tunerCount == null) {
                    scope.error = { tunerCount: "Please enter a valid number of tuners." }
                } else if (settings.tunerCount <= 0) {
                    scope.error = { tunerCount: "Tuner count must be greater than 0." }
                }
                if (scope.error != null)
                    $timeout(() => {
                        scope.error = null
                    }, 3500)
                pseudotv.updateHdhrSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.resetSettings = (settings) => {
                pseudotv.resetHdhrSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
        }
    }
}