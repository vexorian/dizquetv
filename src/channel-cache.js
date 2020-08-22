const SLACK = require('./constants').SLACK;

let cache = {};
let programPlayTimeCache = {};
let configCache = {};

async function getChannelConfig(channelDB, channelId) {
    //with lazy-loading
     
    if ( typeof(configCache[channelId]) === 'undefined') {
        let channel = await channelDB.getChannel(channelId)
        //console.log("channel=" + JSON.stringify(channel) );
        configCache[channelId] = [channel];
    }
    //console.log("channel=" + JSON.stringify(configCache[channelId]).slice(0,200) );
    return configCache[channelId];
}

function saveChannelConfig(number, channel ) {
    configCache[number] = [channel];
}

function getCurrentLineupItem(channelId, t1) {
    if (typeof(cache[channelId]) === 'undefined') {
        return null;
    }
    let recorded = cache[channelId];
    let lineupItem =  JSON.parse( JSON.stringify(recorded.lineupItem) );
    let diff = t1 - recorded.t0;
    if ( (diff <= SLACK) && (lineupItem.duration >= 2*SLACK) ) {
        //closed the stream and opened it again let's not lose seconds for
        //no reason
        return lineupItem;
    }
   
    lineupItem.start += diff;
    if (typeof(lineupItem.streamDuration)!=='undefined') {
        lineupItem.streamDuration -= diff;
        if (lineupItem.streamDuration < SLACK) { //let's not waste time playing some loose seconds
            return null;
        }
    }
    if(lineupItem.start + SLACK > lineupItem.duration) {
        return null;
    }
    return lineupItem;
}

function getKey(channelId, program) {
    let serverKey = "!unknown!";
    if (typeof(program.serverKey) !== 'undefined') {
        if (typeof(program.serverKey) !== 'undefined') {
            serverKey = "plex|" + program.serverKey;
        }
    }
    let programKey = "!unknownProgram!";
    if (typeof(program.key) !== 'undefined') {
        programKey = program.key;
    }
    return channelId + "|" + serverKey + "|" + programKey;

}


function recordProgramPlayTime(channelId, lineupItem, t0) {
    let remaining;
    if ( typeof(lineupItem.streamDuration) !== 'undefined') {
        remaining = lineupItem.streamDuration;
    } else {
        remaining = lineupItem.duration - lineupItem.start;
    }
    programPlayTimeCache[ getKey(channelId, lineupItem) ] = t0 + remaining;
}

function getProgramLastPlayTime(channelId, program) {
    let v = programPlayTimeCache[ getKey(channelId, program) ];
    if (typeof(v) === 'undefined') {
        return 0;
    } else {
        return v;
    }
}

function recordPlayback(channelId, t0, lineupItem) {
    recordProgramPlayTime(channelId, lineupItem, t0);
    
    cache[channelId] = {
        t0: t0,
        lineupItem: lineupItem,
    }
}

function clear() {
    //it's not necessary to clear the playback cache and it may be undesirable
    configCache = {};
    cache = {};
}

module.exports = {
    getCurrentLineupItem: getCurrentLineupItem,
    recordPlayback: recordPlayback,
    clear: clear,
    getProgramLastPlayTime: getProgramLastPlayTime,
    getChannelConfig: getChannelConfig,
    saveChannelConfig: saveChannelConfig,
}
