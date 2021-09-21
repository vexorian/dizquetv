let constants = require('./constants');

let cache = {}


function equalItems(a, b) {
    if (  (typeof(a) === 'undefined') || a.isOffline || b.isOffline ) {
        return false;
    }
    return ( a.type === b.type);

}


function wereThereTooManyAttempts(sessionId, lineupItem) {

    let t1 =  (new Date()).getTime();

    let previous = cache[sessionId];
    if (typeof(previous) === 'undefined') {
        previous = cache[sessionId] = {
            t0: t1 - constants.TOO_FREQUENT * 5,
            lineupItem: null,
        };
    }
    
    let result = false;
    if (t1 - previous.t0 < constants.TOO_FREQUENT) {
        //certainly too frequent
        result = equalItems( previous.lineupItem, lineupItem );
    }

    cache[sessionId] = {
        t0: t1,
        lineupItem : lineupItem,
    };

    setTimeout( () => {
        if (
            (typeof(cache[sessionId]) !== 'undefined')
            &&
            (cache[sessionId].t0 === t1)
        ) {
            delete cache[sessionId];
        }
    }, constants.TOO_FREQUENT * 5 );

    return result;
    
}

module.exports = wereThereTooManyAttempts;