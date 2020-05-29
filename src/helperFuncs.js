module.exports = {
    getCurrentProgramAndTimeElapsed: getCurrentProgramAndTimeElapsed,
    createLineup: createLineup,
    isChannelIconEnabled: isChannelIconEnabled
}

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
            break
        } else {
            timeElapsed -= program.duration
        }
    }
    if (currentProgramIndex === -1)
        throw new Error("No program found; find algorithm fucked up")
    return { program: channel.programs[currentProgramIndex], timeElapsed: timeElapsed, programIndex: currentProgramIndex }
}

function createLineup(obj) {
    let timeElapsed = obj.timeElapsed
    // Start time of a file is never consistent unless 0. Run time of an episode can vary. 
    // When within 30 seconds of start time, just make the time 0 to smooth things out
    // Helps prevents loosing first few seconds of an episode upon lineup change
    if (timeElapsed < 30000) {
        timeElapsed = 0
    }
    let activeProgram = obj.program
    let lineup = []
    let programStartTimes = [0, activeProgram.actualDuration * .25, activeProgram.actualDuration * .50, activeProgram.actualDuration * .75, activeProgram.actualDuration]
    let commercials = [[], [], [], [], []]
    for (let i = 0, l = activeProgram.commercials.length; i < l; i++) // Sort the commercials into their own commerical "slot" array
        commercials[activeProgram.commercials[i].commercialPosition].push(activeProgram.commercials[i])

    let foundFirstVideo = false
    let progTimeElapsed = 0
    for (let i = 0, l = commercials.length; i < l; i++) { // Foreach commercial slot
        for (let y = 0, l2 = commercials[i].length; y < l2; y++) {  // Foreach commercial in that slot
            if (!foundFirstVideo && timeElapsed - commercials[i][y].duration < 0) { // If havent already found the starting video AND the this is a the starting video
                foundFirstVideo = true // We found the fucker
                lineup.push({
                    type: 'commercial',
                    key: commercials[i][y].key,
                    ratingKey: commercials[i][y].ratingKey,
                    start: timeElapsed, // start time will be the time elapsed, cause this is the first video
                    streamDuration: commercials[i][y].duration - timeElapsed, // stream duration set accordingly
                    duration: commercials[i][y].duration,
                    server: commercials[i][y].server
                })
            } else if (foundFirstVideo) {   // Otherwise, if weve already found the starting video
                lineup.push({   // just add the video, starting at 0, playing the entire duration
                    type: 'commercial',
                    key: commercials[i][y].key,
                    ratingKey: commercials[i][y].ratingKey,
                    start: 0,
                    streamDuration: commercials[i][y].actualDuration,
                    duration: commercials[i][y].actualDuration,
                    server: commercials[i][y].server
                })
            } else {    // Otherwise, this bitch has already been played.. Reduce the time elapsed by its duration
                timeElapsed -= commercials[i][y].actualDuration
            }
        }
        if (i < l - 1) { // The last commercial slot is END, so dont write a program..
            if (!foundFirstVideo && timeElapsed - (programStartTimes[i + 1] - programStartTimes[i]) < 0) { // same shit as above..
                foundFirstVideo = true
                lineup.push({
                    type: 'program',
                    key: activeProgram.key,
                    ratingKey: activeProgram.ratingKey,
                    start: progTimeElapsed + timeElapsed, // add the duration of already played program chunks to the timeElapsed
                    streamDuration: (programStartTimes[i + 1] - programStartTimes[i]) - timeElapsed,
                    duration: activeProgram.actualDuration,
                    server: activeProgram.server
                })
            } else if (foundFirstVideo) {
                if (lineup[lineup.length - 1].type === 'program') { // merge consecutive programs..
                    lineup[lineup.length - 1].streamDuration += (programStartTimes[i + 1] - programStartTimes[i])
                } else {
                    lineup.push({
                        type: 'program',
                        key: activeProgram.key,
                        ratingKey: activeProgram.ratingKey,
                        start: programStartTimes[i],
                        streamDuration: (programStartTimes[i + 1] - programStartTimes[i]),
                        duration: activeProgram.actualDuration,
                        server: activeProgram.server
                    })
                }
            } else {
                timeElapsed -= (programStartTimes[i + 1] - programStartTimes[i])
                progTimeElapsed += (programStartTimes[i + 1] - programStartTimes[i]) // add the duration of already played program chunks together
            }
        }
    }
    return lineup
}

function isChannelIconEnabled(enableChannelOverlay, icon, overlayIcon, type) {
    return enableChannelOverlay == true && icon !== '' && overlayIcon && type === 'program'
}