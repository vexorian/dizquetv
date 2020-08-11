module.exports = function (dizquetv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/xmltv-settings.html',
        replace: true,
        scope: {
        },
        link: function (scope, element, attrs) {
            dizquetv.getXmltvSettings().then((settings) => {
                scope.settings = settings
            })
            scope.updateSettings = (settings) => {
                dizquetv.updateXmltvSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.resetSettings = (settings) => {
                dizquetv.resetXmltvSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
        }
    }
}