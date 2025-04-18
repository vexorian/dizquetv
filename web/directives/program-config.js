module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/program-config.html',
        replace: true,
        scope: {
            program: "=program",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            // Format conversion functions
            scope.msToTimeString = function(ms) {
                if (ms === null || ms === undefined) return '';
                var totalSeconds = Math.floor(ms / 1000);
                var minutes = Math.floor(totalSeconds / 60);
                var seconds = totalSeconds % 60;
                return minutes + ':' + (seconds < 10 ? '0' + seconds : seconds);
            };
            
            scope.timeStringToMs = function(timeString) {
                if (!timeString) return 0;
                var parts = timeString.split(':');
                if (parts.length !== 2) return 0;
                
                var minutes = parseInt(parts[0], 10);
                var seconds = parseInt(parts[1], 10);
                
                if (isNaN(minutes) || isNaN(seconds)) return 0;
                return (minutes * 60 + seconds) * 1000;
            };
            
            // Initialize time string fields
            scope.seekPositionTime = '';
            scope.endPositionTime = '';
            
            // Watch for program changes to update time strings
            scope.$watch('program', function(newVal) {
                if (newVal) {
                    scope.seekPositionTime = scope.msToTimeString(newVal.seekPosition);
                    scope.endPositionTime = scope.msToTimeString(newVal.endPosition);
                }
            });
            
            // Update milliseconds when time strings change
            scope.$watch('seekPositionTime', function(newVal) {
                if (scope.program && newVal) {
                    scope.program.seekPosition = scope.timeStringToMs(newVal);
                }
            });
            
            scope.$watch('endPositionTime', function(newVal) {
                if (scope.program && newVal) {
                    scope.program.endPosition = scope.timeStringToMs(newVal);
                }
            });

            scope.finished = (prog) => {
                if (prog.title === "")
                    scope.error = { title: 'You must set a program title.' }
                else if (prog.type === "episode" && prog.showTitle == "")
                    scope.error = { showTitle: 'You must set a show title when the program type is an episode.' }
                else if (prog.type === "episode" && (prog.season == null))
                    scope.error = { season: 'You must set a season number when the program type is an episode.' }
                else if (prog.type === "episode" && prog.season <= 0)
                    scope.error = { season: 'Season number musat be greater than 0' }
                else if (prog.type === "episode" && (prog.episode == null))
                    scope.error = { episode: 'You must set a episode number when the program type is an episode.' }
                else if (prog.type === "episode" && prog.episode <= 0)
                    scope.error = { episode: 'Episode number musat be greater than 0' }

                // Validate seekPosition and endPosition
                if (typeof prog.endPosition === 'number' && typeof prog.seekPosition === 'number') {
                    if (prog.endPosition <= prog.seekPosition) {
                        scope.error = { endPosition: 'End position must be greater than start position (seek).' };
                    }
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
        }
    };
}
