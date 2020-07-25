module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/offline-config.html',
        replace: true,
        scope: {
            title: "@offlineTitle",
            program: "=program",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            scope.showPlexLibrary = false;
            scope.showFallbackPlexLibrary = false;
            scope.finished = (prog) => {
                if (
                    prog.channelOfflineMode != 'pic'
                    && (prog.fallback.length == 0)
                ) {
                    scope.error = { fallback: 'Either add a fallback clip or change the fallback mode to Picture.' }
                }
                if (isNaN(prog.durationSeconds) || prog.durationSeconds < 0 ) {
                    scope.error = { duration: 'Duration must be a positive integer' }
                }
                if (scope.error != null) {
                    $timeout(() => {
                        scope.error = null
                    }, 3500)
                    return
                }

                scope.onDone(JSON.parse(angular.toJson(prog)))
                scope.program = null
            }
            scope.importPrograms = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l; i++) {
                    selectedPrograms[i].commercials = []
                }
                scope.program.filler = scope.program.filler.concat(selectedPrograms);
            }

            scope.importFallback = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l && i < 1; i++) {
                    selectedPrograms[i].commercials = []
                }
                scope.program.fallback = [];
                if (selectedPrograms.length > 0) {
                    scope.program.fallback = [ selectedPrograms[0] ];
                }
            }


            scope.durationString = (duration) => {
                var date = new Date(0);
                date.setSeconds( Math.floor(duration / 1000) ); // specify value for SECONDS here
                return date.toISOString().substr(11, 8);
            }
        }
    };
}
