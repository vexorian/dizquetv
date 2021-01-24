module.exports = function (dizquetv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/cache-settings.html',
        replace: true,
        scope: {
        },
        link: function (scope, element, attrs) {
            dizquetv.getAllSettings().then((settings) => {
                console.warn(settings);
                scope.settings = settings;
                scope.$apply();
            });
            scope.updateSetting = (setting) => {
                const {key, value} = setting;
                dizquetv.putSetting(key, !value).then((response) => {
                    scope.settings = response;
                    scope.$apply();
                });
            };
        }
    }
}