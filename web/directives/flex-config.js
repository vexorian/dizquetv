const dizquetv = require("../services/dizquetv");

module.exports = function ($timeout, dizquetv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/flex-config.html',
        replace: true,
        scope: {
            title: "@offlineTitle",
            program: "=program",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            scope.fillerOptions = [];
            let updateNext = true;
            scope.$watch('program', () => {
                try {
                    if  ( (typeof(scope.program) === 'undefined') || (scope.program == null) ) {
                        updateNext = true;
                        return;
                    } else if (! updateNext) {
                        return;
                    }
                    updateNext = false;
                    let filler = scope.program.filler;
                    if (typeof(filler) === 'undefined') {
                        filler = [];
                    }
                    scope.program.filler = filler;
                    scope.showFallbackPlexLibrary = false;
                    scope.fillerOptions = filler.map( (f) => {
                        return {
                            id: f.id,
                            name: `(${f.id})`,
                        }
                    });
                    
                    $timeout( () => {
                        refreshFillerOptions();
                    }, 0);
                } catch(err) {
                    console.error("$watch error", err);
                }
            })

            let fillerOptionsFor = (index) => {
                let used = {};
                let added = {};
                for (let i = 0; i < scope.program.filler.length; i++) {
                    if (scope.program.filler[i].id != 'none' && i != index) {
                        used[ scope.program.filler[i].id ] = true;
                    }
                }
                let options = [];
                for (let i = 0; i < scope.fillerOptions.length; i++) {
                    if ( used[scope.fillerOptions[i].id] !== true) {
                        added[scope.fillerOptions[i].id] = true;
                        options.push( scope.fillerOptions[i] );
                    }
                }
                if (scope.program.filler[index].id == 'none') {
                    added['none'] = true;
                    options.push( {
                        id: 'none',
                        name: 'Add a filler list...',
                    } );
                }
                if ( added[scope.program.filler[index].id] !== true ) {
                    options.push( {
                        id: scope.program.filler[index].id,
                        name: `[${f.id}]`,
                    } );
                }
                return options;
            }

            scope.refreshFillerStuff = () => {
                if (typeof(scope.program) === 'undefined') {
                    return;
                }
                addAddFiller();
                updatePercentages();
                refreshIndividualOptions();
            }

            let updatePercentages = () => {
                let w = 0;
                for (let i = 0; i < scope.program.filler.length; i++) {
                    if (scope.program.filler[i].id !== 'none') {
                        w += scope.program.filler[i].weight;
                    }
                }
                for (let i = 0; i < scope.program.filler.length; i++) {
                    if (scope.program.filler[i].id !== 'none') {
                        scope.program.filler[i].percentage = (scope.program.filler[i].weight * 100 / w).toFixed(2) + "%";
                    }
                }

            };
            

            let addAddFiller = () => {
                if ( (scope.program.filler.length == 0) || (scope.program.filler[scope.program.filler.length-1].id !== 'none') ) {
                    scope.program.filler.push ( {
                        'id': 'none',
                        'weight': 300,
                        'cooldown': 0,
                    } );
                }
            }


            let refreshIndividualOptions = () => {
                for (let i = 0; i < scope.program.filler.length; i++) {
                    scope.program.filler[i].options = fillerOptionsFor(i);
                }
            }

            let refreshFillerOptions = async() => {

                try {
                    let r = await dizquetv.getAllFillersInfo();
                    scope.fillerOptions = r.map( (f) => {
                        return {
                            id: f.id,
                            name: f.name,
                        };
                    } );
                    scope.refreshFillerStuff();
                    scope.$apply();
                } catch(err) {
                    console.error("Unable to get filler info", err);
                }
            };
            scope.refreshFillerStuff();
            refreshFillerOptions();

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
                    }, 30000)
                    return
                }
                prog.filler = prog.filler.filter( (f) => { return f.id != 'none'; } );
                scope.onDone(JSON.parse(angular.toJson(prog)))
                scope.program = null
            }
            scope.showList = () => {
                return ! scope.showFallbackPlexLibrary;
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


            scope.deleteFillerList =(index) => {
                scope.program.filler.splice(index, 1);
                scope.refreshFillerStuff();
            }



            scope.durationString = (duration) => {
                var date = new Date(0);
                date.setSeconds( Math.floor(duration / 1000) ); // specify value for SECONDS here
                return date.toISOString().substr(11, 8);
            }

        }
    };
}
