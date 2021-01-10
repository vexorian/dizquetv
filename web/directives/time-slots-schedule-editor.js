

module.exports = function ($timeout, dizquetv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/time-slots-schedule-editor.html',
        replace: true,
        scope: {
            linker: "=linker",
            onDone: "=onDone"
        },
        
        link: function (scope, element, attrs) {
            scope.limit = 50000;
            scope.visible = false;
            scope.fake = { time: -1 };
            scope.timeOptions = []
            scope.badTimes = false;
            let showsById;
            let shows;


            function reset() {
                showsById = {};
                shows = [];
                scope.schedule = {
                    lateness : 0,
                    maxDays: 365,
                    flexPreference : "distribute",
                    slots : [],
                    pad: 1,
                    fake: { time: -1 },
                }
 
            }
            reset();

            function loadBackup(backup) {
                scope.schedule = JSON.parse( JSON.stringify(backup) );
                if (typeof(scope.schedule.pad) == 'undefined') {
                    scope.schedule.pad = 1;
                }
                let slots = scope.schedule.slots;
                for (let i = 0; i < slots.length; i++) {
                    let found = false;
                    for (let j = 0; j < scope.showOptions.length; j++) {
                        if (slots[i].showId == scope.showOptions[j].id) {
                            found = true;
                        }
                    }
                    if (! found) {
                        slots[i].showId  = "flex.";
                        slots[i].order = "shuffle";
                    }
                }
                if (typeof(scope.schedule.flexPreference) === 'undefined') {
                    scope.schedule.flexPreference = "distribute";
                }
                scope.schedule.fake = {
                    time: -1,
                }
            }

            for (let h = 0; h < 24; h++) {
                for (let m = 0; m < 60; m += 15) {
                    scope.timeOptions.push( {
                        id: (h * 60 + m) * 60 * 1000,
                        description: niceLookingTime(h,m),
                    } );
                }
            }
            scope.latenessOptions = [
                { id: 0 , description: "Do not allow" },
                { id: 5*60*1000, description:  "5 minutes" },
                { id: 10*60*1000 , description:  "10 minutes" },
                { id: 15*60*1000 , description:  "15 minutes" },
                { id: 1*60*60*1000 , description:  "1 hour" },
                { id: 2*60*60*1000 , description:  "2 hours" },
                { id: 3*60*60*1000 , description:  "3 hours" },
                { id: 4*60*60*1000 , description:  "4 hours" },
                { id: 8*60*60*1000 , description:  "8 hours" },
                { id: 24*60*60*1000 , description:  "I don't care about lateness" },
            ];
            scope.flexOptions = [
                { id: "distribute", description: "Between videos" },
                { id: "end", description: "End of the slot" },
            ]
            scope.fakeTimeOptions = JSON.parse( JSON.stringify( scope.timeOptions ) );
            scope.fakeTimeOptions.push( {id: -1, description: "Add slot"} );

            scope.padOptions = [
                {id: 1, description: "Do not pad" },
                {id: 5*60*1000, description: "0:00, 0:05, 0:10, ..., 0:55" },
                {id: 10*60*1000, description: "0:00, 0:10, 0:20, ..., 0:50" },
                {id: 15*60*1000, description: "0:00, 0:15, 0:30, ..., 0:45" },
                {id: 30*60*1000, description: "0:00, 0:30" },
                {id: 1*60*60*1000, description: "0:00" },
            ];

            scope.showOptions = [];
            scope.orderOptions = [
                { id: "next", description: "Play Next" },
                { id: "shuffle", description: "Shuffle" },
            ];

            let doIt = async() => {
                scope.schedule.timeZoneOffset =  (new Date()).getTimezoneOffset();
                let res = await dizquetv.calculateTimeSlots(scope.programs, scope.schedule  );
                res.schedule = scope.schedule;
                delete res.schedule.fake;
                return res;
            }



            
            let startDialog = (programs, limit, backup) => {
                scope.limit = limit;
                scope.programs = programs;

                reset();
                


                programs.forEach( (p) => {
                    let show = getShow(p);
                    if (show != null) {
                        if (typeof(showsById[show.id]) === 'undefined') {
                            showsById[show.id] = shows.length;
                            shows.push( show );
                        } else {
                            show = shows[ showsById[show.id] ];
                        }
                    }
                } );
                scope.showOptions = shows.map( (show) => { return show } );
                scope.showOptions.push( {
                    id: "flex.",
                    description: "Flex",
                } );
                if (typeof(backup) !== 'undefined') {
                    loadBackup(backup);
                }

                scope.visible = true;
            }


            scope.linker( {
                startDialog: startDialog,
            } );

            scope.finished = async (cancel) => {
                scope.error = null;
                if (!cancel) {
                    try {
                        scope.loading = true;
                        $timeout();
                        scope.onDone( await doIt() );
                        scope.visible = false;
                    } catch(err) {
                        console.error("Unable to generate channel lineup", err);
                        scope.error  = "There was an error processing the schedule";
                        return;
                    } finally {
                        scope.loading = false;
                        $timeout();
                    }
                } else {
                    scope.visible = false;
                }
            }

            scope.fakeTimeChanged = () => {

                if (scope.fake.time != -1) {
                    scope.schedule.slots.push( {
                        time: scope.fake.time,
                        showId: "flex.",
                        order: "next"
                    } )
                    scope.fake.time = -1;
                    scope.refreshSlots();
                }
            }

            scope.deleteSlot = (index) => {
                scope.schedule.slots.splice(index, 1);
            }

            scope.hasTimeError = (slot) => {
                return typeof(slot.timeError) !== 'undefined';
            }

            scope.disableCreateLineup = () => {
                if (scope.badTimes) {
                    return true;
                }
                if (typeof(scope.schedule.maxDays) === 'undefined') {
                    return true;
                }
                if (scope.schedule.slots.length == 0) {
                    return true;
                }
                return false;
            }

            scope.canShowSlot = (slot) => {
                return (slot.showId != 'flex.') && !(slot.showId.startsWith('redirect.'));
            }

            scope.refreshSlots = () => {
                scope.badTimes = false;
                //"Bubble sort ought to be enough for anybody"
                for (let i = 0; i < scope.schedule.slots.length; i++) {
                    for (let j = i+1; j < scope.schedule.slots.length; j++) {
                        if (scope.schedule.slots[j].time< scope.schedule.slots[i].time) {
                            let x = scope.schedule.slots[i];
                            scope.schedule.slots[i] = scope.schedule.slots[j];
                            scope.schedule.slots[j] = x;
                        }
                    }
                    if (scope.schedule.slots[i].showId == 'movie.') {
                        scope.schedule.slots[i].order = "shuffle";
                    }
                }
                for (let i = 0; i < scope.schedule.slots.length; i++) {
                    if (
                        (i > 0 && (scope.schedule.slots[i].time == (scope.schedule.slots[i-1].time) ) )
                        || ( (i+1 < scope.schedule.slots.length) && (scope.schedule.slots[i].time == (scope.schedule.slots[i+1].time) ) )
                    ) {
                        scope.badTimes = true;
                        scope.schedule.slots[i].timeError = "Please select a unique time.";
                    } else {
                        delete scope.schedule.slots[i].timeError;
                    }
                }
                $timeout();
            }



        }
    };
}

function niceLookingTime(h, m) {
    let d = new Date();
    d.setHours(h);
    d.setMinutes(m);
    d.setSeconds(0);
    d.setMilliseconds(0);

    return d.toLocaleTimeString();
}

//This is a duplicate code, but maybe it doesn't have to be?
function getShow(program) {
    //used for equalize and frequency tweak
    if (program.isOffline) {
        if (program.type == 'redirect') {
            return {
                description : `Redirect to channel ${program.channel}`,
                id: "redirect." + program.channel,
                channel: program.channel,
            }
        } else {
            return null;
        }
    } else if ( (program.type == 'episode') && ( typeof(program.showTitle) !== 'undefined' ) ) {
        return {
            description: program.showTitle,
            id: "tv." + program.showTitle,
        }
    } else {
        return {
            description: "Movies",
            id: "movie.",
        }
    }
}


