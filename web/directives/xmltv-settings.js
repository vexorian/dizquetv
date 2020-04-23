module.exports = function (pseudotv, $interval) {
    return {
        restrict: 'E',
        templateUrl: 'templates/xmltv-settings.html',
        replace: true,
        scope: {
        },
        link: function (scope, element, attrs) {
            pseudotv.getXmltvSettings().then((settings) => {
                scope.settings = settings
            })
            scope.updateSettings = (settings) => {
                pseudotv.updateXmltvSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.resetSettings = (settings) => {
                pseudotv.resetXmltvSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
        }
    }
}