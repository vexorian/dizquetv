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
            scope.showTools = false;
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
            scope.showList = () => {
                return ! scope.showPlexLibrary && ! scope.showFallbackPlexLibrary;
            }
            scope.sortFillers = () => {
                scope.program.filler.sort( (a,b) => { return a.duration - b.duration } );
            }
            scope.fillerRemoveAllFiller = () => {
                scope.program.filler = [];
            }
            scope.fillerRemoveDuplicates = () => {
                function getKey(p) {
                    return p.serverKey + "|" + p.plexFile;
                }
                let seen = {};
                let newFiller = [];
                for (let i = 0; i < scope.program.filler.length; i++) {
                    let p = scope.program.filler[i];
                    let k = getKey(p);
                    if ( typeof(seen[k]) === 'undefined') {
                        seen[k] = true;
                        newFiller.push(p);
                    }
                }
                scope.program.filler = newFiller;
            }
            scope.importPrograms = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l; i++) {
                    selectedPrograms[i].commercials = []
                }
                scope.program.filler = scope.program.filler.concat(selectedPrograms);
                scope.showPlexLibrary = false;
            }

            scope.importFallback = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l && i < 1; i++) {
                    selectedPrograms[i].commercials = []
                }
                scope.program.fallback = [];
                if (selectedPrograms.length > 0) {
                    scope.program.fallback = [ selectedPrograms[0] ];
                }
                scope.showFallbackPlexLibrary = false;
            }


            scope.durationString = (duration) => {
                var date = new Date(0);
                date.setSeconds( Math.floor(duration / 1000) ); // specify value for SECONDS here
                return date.toISOString().substr(11, 8);
            }

            scope.programSquareStyle = (program, dash) => {
                let background = "rgb(255, 255, 255)";
                let ems = Math.pow( Math.min(60*60*1000, program.duration), 0.7 );
                ems = ems / Math.pow(1*60*1000., 0.7);
                ems = Math.max( 0.25 , ems);
                let top = Math.max(0.0, (1.75 - ems) / 2.0) ;
                if (top == 0.0) {
                    top = "1px";
                }
                let solidOrDash = (dash? 'dashed' : 'solid');

                return {
                    'width': '0.5em',
                    'height': ems + 'em',
                    'margin-right': '0.50em',
                    'background': background,
                    'border': `1px ${solidOrDash} black`,
                    'margin-top': top,
                    'margin-bottom': '1px',
                };
            }

        }
    };
}
