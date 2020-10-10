const constants = require("../constants");

const MINUTE = 60*1000;
const DAY = 24*60*MINUTE;
const LIMIT = 40000;


//This is a triplicate code, but maybe it doesn't have to be?
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


function shuffle(array, lo, hi ) {
    if (typeof(lo) === 'undefined') {
        lo = 0;
        hi = array.length;
    }
    let currentIndex = hi, temporaryValue, randomIndex
    while (lo !== currentIndex) {
        randomIndex = lo + Math.floor(Math.random() * (currentIndex -lo) );
        currentIndex -= 1
        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }
    return array
}

function _wait(t) {
    return new Promise((resolve) => {
      setTimeout(resolve, t);
    });
}

function getProgramId(program) {
    let s = program.serverKey;
    if (typeof(s) === 'undefined') {
        s = 'unknown';
    }
    let p = program.key;
    if (typeof(p) === 'undefined') {
        p = 'unknown';
    }
    return s + "|" + p;
}

function addProgramToShow(show, program) {
    if ( (show.id == 'flex.') || show.id.startsWith("redirect.")  ) {
        //nothing to do
        return;
    }
    let id = getProgramId(program)
    if(show.programs[id] !== true) {
        show.programs.push(program);
        show.programs[id] = true
    }
}

function getShowOrderer(show) {
    if (typeof(show.orderer) === 'undefined') {

        let sortedPrograms = JSON.parse( JSON.stringify(show.programs) );
        sortedPrograms.sort((a, b) => {
            if (a.season === b.season) {
                if (a.episode > b.episode) {
                    return 1
                } else {
                    return -1
                }
            } else if (a.season > b.season) {
                return 1;
            } else if (b.season > a.season) {
                return -1;
            } else {
                return 0
            }
        });

        let position = 0;
        while (
            (position + 1 < sortedPrograms.length )
            &&
            (
                show.founder.season !== sortedPrograms[position].season
                ||
                show.founder.episode !== sortedPrograms[position].episode
            )
        ) {
            position++;
        }


        show.orderer = {

            current : () => {
                return sortedPrograms[position];
            },

            next: () => {
                position = (position + 1) % sortedPrograms.length;
            },

        }
    }
    return show.orderer;
}


function getShowShuffler(show) {
    if (typeof(show.shuffler) === 'undefined') {
        if (typeof(show.programs) === 'undefined') {
            throw Error(show.id + " has no programs?")
        }

        let randomPrograms = JSON.parse( JSON.stringify(show.programs) );
        let n = randomPrograms.length;
        shuffle( randomPrograms, 0, n);
        let position = 0;

        show.shuffler  = {

            current : () => {
                return randomPrograms[position];
            },

            next: () => {
                position++;
                if (position == n) {
                    let a = Math.floor(n / 2);
                    shuffle(randomPrograms, 0, a );
                    shuffle(randomPrograms, a, n );
                    position = 0;
                }
            },

        }
    }
    return show.shuffler;
}

module.exports = async( programs, schedule  ) => {
    if (! Array.isArray(programs) ) {
        return { userError: 'Expected a programs array' };
    }
    if (typeof(schedule) === 'undefined') {
        return { userError: 'Expected a schedule' };
    }
    if (typeof(schedule.timeZoneOffset) === 'undefined') {
        return { userError: 'Expected a time zone offset' };
    }
    //verify that the schedule is in the correct format
    if (! Array.isArray(schedule.slots) ) {
        return { userError: 'Expected a "slots" array in schedule' };
    }
    for (let i = 0; i < schedule.slots.length; i++) {
        if (typeof(schedule.slots[i].time) === 'undefined') {
            return { userError: "Each slot should have a time" };
        }
        if (typeof(schedule.slots[i].showId) === 'undefined') {
            return { userError: "Each slot should have a showId" };
        }
        if (
            (schedule.slots[i].time < 0)
            || (schedule.slots[i].time >= DAY)
            || (Math.floor(schedule.slots[i].time) != schedule.slots[i].time)
        ) {
            return { userError: "Slot times should be a integer number of milliseconds since the start of the day." };
        }
        schedule.slots[i].time = ( schedule.slots[i].time  + 10*DAY + schedule.timeZoneOffset*MINUTE) % DAY;
    }
    schedule.slots.sort( (a,b) => {
        return (a.time - b.time);
    } );
    for (let i = 1; i < schedule.slots.length; i++) {
        if (schedule.slots[i].time == schedule.slots[i-1].time) {
            return { userError: "Slot times should be unique."};
        }
    }
    if (typeof(schedule.pad) === 'undefined') {
        return { userError: "Expected schedule.pad" };
    }

    if (typeof(schedule.lateness) == 'undefined') {
        return { userError: "schedule.lateness must be defined." };
    }
    if (typeof(schedule.maxDays) == 'undefined') {
        return { userError: "schedule.maxDays must be defined." };
    }

    // throttle so that the stream is not affected negatively
    let steps = 0;
    let throttle = async() => {
        if (steps++ == 10) {
            steps = 0;
            await _wait(1);
        }
    }

    let showsById = {};
    let shows = [];

    function getNextForSlot(slot, remaining) {
        if (slot.showId === "flex.") {
            return {
                isOffline: true,
                duration: remaining,
            }
        }
        let show = shows[ showsById[slot.showId] ];
        if (slot.showId.startsWith("redirect.")) {
            return {
                isOffline: true,
                type: "redirect",
                duration: remaining,
                channel: show.channel,
            }
        } else if (slot.order === 'shuffle') {
            return getShowShuffler(show).current();
        } else if (slot.order === 'next') {
            return getShowOrderer(show).current();
        }
    }
    
    function advanceSlot(slot) {
        if ( (slot.showId === "flex.") || (slot.showId.startsWith("redirect") ) ) {
            return;
        }
        let show = shows[ showsById[slot.showId] ];
        if (slot.order === 'shuffle') {
            return getShowShuffler(show).next();
        } else if (slot.order === 'next') {
            return getShowOrderer(show).next();
        }
    }

    // load the programs
    for (let i = 0; i < programs.length; i++) {
        let p = programs[i];
        let show = getShow(p);
        if (show != null) {
            if (typeof(showsById[show.id] ) === 'undefined') {
                showsById[show.id] = shows.length;
                shows.push( show );
                show.founder = p;
                show.programs = [];
            } else {
                show = shows[ showsById[show.id] ];
            }
            addProgramToShow( show, p );
        }
    }

    let s = schedule.slots;
    let d = (new Date() );
    d.setUTCMilliseconds(0);
    d.setUTCSeconds(0);
    d.setUTCMinutes(0);
    d.setUTCHours(0);
    d.setUTCMilliseconds( s[0].time );
    let t0 = d.getTime();
    let p = [];
    let t = t0;
    let previous = null;
    let hardLimit = t0 + schedule.maxDays * DAY;

    let pushFlex = (d) => {
        if (d > 0) {
            t += d;
            if ( (p.length > 0) && p[p.length-1].isOffline && (p[p.length-1].type != 'redirect') ) {
                p[p.length-1].duration += d;
            } else {
                p.push( {
                    duration: d,
                    isOffline : true,
                } );
            }
        }
    }

    for (let i = 0; i < LIMIT; i++) {
        await throttle();
        let dayTime = t % DAY;
        let slot = null;
        let remaining = null;
        for (let i = 0; i < s.length; i++) {
            let endTime;
            if (i == s.length - 1) {
                endTime = s[0].time + DAY;
            } else {
                endTime = s[i+1].time;
            }

            if ((s[i].time <= dayTime) && (dayTime < endTime)) {
                slot = s[i];
                remaining = endTime - dayTime;
                break;
            }
            if ((s[i].time <= dayTime + DAY) && (dayTime + DAY < endTime)) {
                slot = s[i];
                dayTime += DAY;
                remaining = endTime - dayTime;
                break;
            }
        }
        if (slot == null) {
            throw Error("Unexpected. Unable to find slot for time of day " + t + " " + dayTime);
        }

        let first = (previous !== slot.showId);
        let skip = false; //skips to the next one
        if (first) {
            //check if it's too late
            let d = dayTime  - slot.time;
            if (d >= schedule.lateness + constants.SLACK) {
                skip = true;
            }
        }
        let item = getNextForSlot(slot, remaining);
        if ( (item.duration >= remaining + constants.SLACK) && !first) {
            skip = true;
        }

        if (t + item.duration - constants.SLACK >= hardLimit) {
            pushFlex( hardLimit - t );
            break;
        }
        if (item.isOffline && item.type != 'redirect') {
            //it's the same, really
            skip = true;
        }
        if (skip) {
            pushFlex(remaining);
        } else {
            previous = slot.showId;
            let clone = JSON.parse( JSON.stringify(item) );
            clone.$index = p.length;
            p.push( clone );
            t += clone.duration;

            advanceSlot(slot);
        }
        let nt = t;
        let m = t % schedule.pad;
        if (m != 0) {
            nt = t - m + schedule.pad;
            let remaining = nt - t;
            if (remaining >= constants.SLACK) {
                pushFlex(remaining);
            }
        }
    }

    return {
        programs: p,
        startTime: (new Date(t0)).toISOString(),
    }

}




