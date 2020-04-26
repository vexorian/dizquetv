const os = require('os')

module.exports = {
    getLineup: getLineup,
    getCurrentProgramAndTimeElapsed: getCurrentProgramAndTimeElapsed,
    getIPAddresses: getIPAddresses
}

function getIPAddresses() {
    var ifaces = os.networkInterfaces();
    var addresses = []
    Object.keys(ifaces).forEach(function (ifname) {
        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                return
            }
            addresses.push(iface.address)
        })
    })
    return addresses
}

function getLineup(date, channel) {
    let _obj = getCurrentProgramAndTimeElapsed(date, channel)
    let lineup = createProgramStreamTimeline(_obj)
    return lineup
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

function createProgramStreamTimeline(obj) {
    
    let timeElapsed = obj.timeElapsed
    console.log(timeElapsed)
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
                    file: commercials[i][y].file,
                    start: timeElapsed, // start time will be the time elapsed, cause this is the first video
                    duration: commercials[i][y].duration - timeElapsed // duration set accordingly
                })
            } else if (foundFirstVideo) {   // Otherwise, if weve already found the starting video
                lineup.push({   // just add the video, starting at 0, playing the entire duration
                    type: 'commercial',
                    file: commercials[i][y].file,
                    start: 0,
                    duration: commercials[i][y].duration
                })
            } else {    // Otherwise, this bitch has already been played.. Reduce the time elapsed by its duration
                timeElapsed -= commercials[i][y].duration
            }
        }
        if (i < l - 1) { // The last commercial slot is END, so dont write a program..
            if (!foundFirstVideo && timeElapsed - (programStartTimes[i + 1] - programStartTimes[i]) < 0) { // same shit as above..
                foundFirstVideo = true
                lineup.push({
                    type: 'program',
                    file: activeProgram.file,
                    start: progTimeElapsed + timeElapsed,
                    duration: (programStartTimes[i + 1] - programStartTimes[i]) - timeElapsed
                })
            } else if (foundFirstVideo) {
                if (lineup[lineup.length - 1].type === 'program') { // merge consecutive programs..
                    lineup[lineup.length - 1].duration += (programStartTimes[i + 1] - programStartTimes[i])
                } else {
                    lineup.push({
                        type: 'program',
                        file: activeProgram.file,
                        start: programStartTimes[i],
                        duration: (programStartTimes[i + 1] - programStartTimes[i])
                    })
                }
            } else {
                timeElapsed -= (programStartTimes[i + 1] - programStartTimes[i])
                progTimeElapsed += (programStartTimes[i + 1] - programStartTimes[i])
            }
        }
    }
    return lineup
}