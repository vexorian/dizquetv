module.exports = {
    getCurrentProgramAndTimeElapsed: getCurrentProgramAndTimeElapsed,
    createLineup: createLineup,
    isChannelIconEnabled: isChannelIconEnabled,
}

let channelCache = require('./channel-cache');
const SLACK = require('./constants').SLACK;

function getCurrentProgramAndTimeElapsed(date, channel) {
    let channelStartTime = new Date(channel.startTime)
    if (channelStartTime > date)
        throw new Error("startTime cannot be set in the future. something fucked up..")
    let timeElapsed = (date.valueOf() - channelStartTime.valueOf()) % channel.duration
    let currentProgramIndex = -1
    for (let y = 0, l2 = channel.programs.length; y < l2; y++) {
        let program = channel.programs[y]
        if (timeElapsed - program.duration < 0) {
            currentProgramIndex = y
            if ( (program.duration > 2*SLACK) && (timeElapsed > program.duration - SLACK) ) {
                timeElapsed = 0;
                currentProgramIndex = (y + 1) % channel.programs.length;
            }
            break;
        } else {
            timeElapsed -= program.duration
        }
    }

    if (currentProgramIndex === -1)
        throw new Error("No program found; find algorithm fucked up")

    return { program: channel.programs[currentProgramIndex], timeElapsed: timeElapsed, programIndex: currentProgramIndex }
}

function createLineup(obj, channel, isFirst) {
    let timeElapsed = obj.timeElapsed
    // Start time of a file is never consistent unless 0. Run time of an episode can vary. 
    // When within 30 seconds of start time, just make the time 0 to smooth things out
    // Helps prevents loosing first few seconds of an episode upon lineup change
    let activeProgram = obj.program

    let lineup = []

    if ( typeof(activeProgram.err) !== 'undefined') {
        let remaining = activeProgram.duration - timeElapsed;
        lineup.push( {
            type: 'offline',
            title: 'Error',
            err: activeProgram.err,
            streamDuration: remaining,
            duration: remaining,
            start: 0
        })
        return lineup;
    }


    if (activeProgram.isOffline === true) {
        //offline case
        let remaining = activeProgram.duration - timeElapsed;
        //look for a random filler to play
        let filler = null;
        let special = null;
        if (typeof(channel.fillerContent) !== 'undefined') {
            if ( (channel.offlineMode === 'clip') && (channel.fallback.length != 0) ) {
                special = JSON.parse(JSON.stringify(channel.fallback[0]));
            }
            let randomResult = pickRandomWithMaxDuration(channel, channel.fillerContent, remaining + (isFirst? (24*60*60*1000) : 0) );
            filler = randomResult.filler;
            if (filler == null && (typeof(randomResult.minimumWait) !== undefined) && (remaining > randomResult.minimumWait) ) {
                remaining = randomResult.minimumWait;
            }
        }
        let isSpecial = false;
        if (filler == null) {
            filler = special;
            isSpecial = true;
        }
        if (filler != null) {
            let fillerstart = 0;
            if (isSpecial) {
                if (filler.duration > remaining) {
                    fillerstart = filler.duration - remaining;
                } else {
                    ffillerstart = 0;
                }
            } else if(isFirst) {
                fillerstart = Math.max(0, filler.duration - remaining);
                //it's boring and odd to tune into a channel and it's always
                //the start of a commercial.
                let more = Math.max(0, filler.duration - fillerstart - 15000 - SLACK);
                fillerstart += Math.floor(more * Math.random() );
            }
            lineup.push({   // just add the video, starting at 0, playing the entire duration
                type: 'commercial',
                title: filler.title,
                key: filler.key,
                plexFile: filler.plexFile,
                file: filler.file,
                ratingKey: filler.ratingKey,
                start: fillerstart,
                streamDuration: Math.max(1, Math.min(filler.duration - fillerstart, remaining) ),
                duration: filler.duration,
                serverKey: filler.serverKey
            });
            return lineup;
        }
        // pick the offline screen
        remaining = Math.min(remaining, 10*60*1000);
        //don't display the offline screen for longer than 10 minutes. Maybe the
        //channel's admin might change the schedule during that time and then
        //it would be better to start playing the content.
        lineup.push( {
            type: 'offline',
            title: 'Channel Offline',
            streamDuration: remaining,
            duration: remaining,
            start: 0
        })
        return lineup;
    }
    if (timeElapsed < 30000) {
        timeElapsed = 0
    }

    return [ {
                        type: 'program',
                        title: activeProgram.title,
                        key: activeProgram.key,
                        plexFile: activeProgram.plexFile,
                        file: activeProgram.file,
                        ratingKey: activeProgram.ratingKey,
                        start:  timeElapsed,
                        streamDuration: activeProgram.duration - timeElapsed,
                        duration: activeProgram.duration,
                        serverKey: activeProgram.serverKey
    } ];
}

function pickRandomWithMaxDuration(channel, list, maxDuration) {
    let pick1 = null;
    let pick2 = null;
    let n = 0;
    let m = 0;
    let t0 = (new Date()).getTime();
    let minimumWait = 1000000000;
    const D = 24*60*60*1000;
    if (typeof(channel.fillerRepeatCooldown) === 'undefined') {
        channel.fillerRepeatCooldown = 30*60*1000;
    }
    for (let i = 0; i < list.length; i++) {
        let clip = list[i];
        // a few extra milliseconds won't hurt anyone, would it? dun dun dun
        if (clip.duration <= maxDuration + SLACK ) {
            let t1 = channelCache.getProgramLastPlayTime( channel.number, clip );
            let timeSince = ( (t1 == 0) ?  D :  (t0 - t1) );


            if (timeSince < channel.fillerRepeatCooldown - SLACK) {
                let w = channel.fillerRepeatCooldown - timeSince;
                if (clip.duration + w <= maxDuration + SLACK) {
                    minimumWait = Math.min(minimumWait, w);
                }
                timeSince = 0;
                //30 minutes is too little, don't repeat it at all
            }
            if (timeSince >= D) {
                let w =  Math.pow(clip.duration, 1.0 / 4.0);
                n += w;
                if ( n*Math.random() < w) {
                    pick1 = clip;
                }
            } else {
                let adjust = Math.floor(timeSince / (60*1000));
                if (adjust > 0) {
                    adjust = adjust * adjust;
                    //weighted
                    m += adjust;
                    if ( Math.floor(m*Math.random()) < adjust) {
                        pick2 = clip;
                    }
                }
            }
        }
    }
    let pick = (pick1 == null) ? pick2: pick1;
    let pickTitle = "null";
    if (pick != null) {
        pickTitle = pick.title;
    }
   
    return {
        filler: pick,
        minimumWait : minimumWait,
    }
}

function isChannelIconEnabled(  ffmpegSettings, channel, type) {
    if (! ffmpegSettings.enableFFMPEGTranscoding || ffmpegSettings.disableChannelOverlay ) {
        return false;
    }
    let d = channel.disableFillerOverlay;
    if (typeof(d) === 'undefined') {
        d = true;
    }
    if ( (typeof type !== `undefined`) && (type == 'commercial') && d ) {
        return false;
    }
    if (channel.icon === '' || !channel.overlayIcon) {
        return false;
    }
    return true;
}
