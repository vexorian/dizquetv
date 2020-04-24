module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/channel-config.html',
        replace: true,
        scope: {
            channels: "=channels",
            channel: "=channel",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            if (typeof scope.channel === 'undefined' || scope.channel == null) {
                scope.channel = {}
                scope.channel.programs = []
                scope.isNewChannel = true
                scope.channel.icon = ""
                scope.channel.startTime = new Date()
                scope.channel.startTime.setMilliseconds(0)
                scope.channel.startTime.setSeconds(0)
                if (scope.channel.startTime.getMinutes() < 30)
                    scope.channel.startTime.setMinutes(0)
                else
                    scope.channel.startTime.setMinutes(30)
                if (scope.channels.length > 0) {
                    scope.channel.number = scope.channels[scope.channels.length - 1].number + 1
                    scope.channel.name = "Channel " + scope.channel.number
                } else {
                    scope.channel.number = 1
                    scope.channel.name = "Channel 1"
                }
            } else {
                scope.beforeEditChannelNumber = scope.channel.number
            }
            scope.finshedProgramEdit = (program) => {
                scope.channel.programs[scope.selectedProgram] = program
                scope._selectedProgram = null
                updateChannelDuration()
            }
            scope.$watch('channel.startTime', () => {
                updateChannelDuration()
            })
            scope.sortShows = () => {
                let shows = {}
                let movies = []
                let newProgs = []
                let progs = scope.channel.programs
                for (let i = 0, l = progs.length; i < l; i++) {
                    if (progs[i].type === 'movie') {
                        movies.push(progs[i])
                    } else {
                        if (typeof shows[progs[i].showTitle] === 'undefined')
                            shows[progs[i].showTitle] = []
                        shows[progs[i].showTitle].push(progs[i])
                    }
                }
                let keys = Object.keys(shows)
                for (let i = 0, l = keys.length; i < l; i++) {
                    shows[keys[i]].sort((a, b) => {
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
                    })
                    newProgs = newProgs.concat(shows[keys[i]])
                }
                scope.channel.programs = newProgs.concat(movies)
                updateChannelDuration()
            }
            scope.removeDuplicates = () => {
                let tmpProgs = {}
                let progs = scope.channel.programs
                for (let i = 0, l = progs.length; i < l; i++) {
                    if (progs[i].type === 'movie') {
                        tmpProgs[progs[i].title + progs[i].durationStr] = progs[i]
                    } else {
                        tmpProgs[progs[i].showTitle + '-' + progs[i].season + '-' + progs[i].episode] = progs[i]
                    }
                }
                let newProgs = []
                let keys = Object.keys(tmpProgs)
                for (let i = 0, l = keys.length; i < l; i++) {
                    newProgs.push(tmpProgs[keys[i]])
                }
                scope.channel.programs = newProgs
            }
            scope.blockShuffle = (blockCount, randomize) => {
                if (typeof blockCount === 'undefined' || blockCount == null)
                    return
                let shows = {}
                let movies = []
                let newProgs = []
                let progs = scope.channel.programs
                for (let i = 0, l = progs.length; i < l; i++) {
                    if (progs[i].type === 'movie') {
                        movies.push(progs[i])
                    } else {
                        if (typeof shows[progs[i].showTitle] === 'undefined')
                            shows[progs[i].showTitle] = []
                        shows[progs[i].showTitle].push(progs[i])
                    }
                }
                let keys = Object.keys(shows)
                let index = 0
                if (randomize)
                    index = getRandomInt(0, keys.length - 1)
                while (keys.length > 0) {
                    if (shows[keys[index]].length === 0) {
                        keys.splice(index, 1)
                        if (randomize) {
                            let tmp = index
                            index = getRandomInt(0, keys.length - 1)
                            while (keys.length > 1 && tmp == index)
                                index = getRandomInt(0, keys.length - 1)
                        } else {
                            if (index >= keys.length)
                                index = 0
                        }
                        continue
                    }
                    for (let i = 0, l = blockCount; i < l; i++) {
                        if (shows[keys[index]].length > 0)
                            newProgs.push(shows[keys[index]].shift())
                    }
                    if (randomize) {
                        let tmp = index
                        index = getRandomInt(0, keys.length - 1)
                        while (keys.length > 1 && tmp == index)
                            index = getRandomInt(0, keys.length - 1)
                    } else {
                        index++
                        if (index >= keys.length)
                            index = 0
                    }
                }

                scope.channel.programs = newProgs.concat(movies)
                updateChannelDuration()
            }
            scope.randomShuffle = () => {
                randomShuffle(scope.channel.programs)
                updateChannelDuration()
            }
            function getRandomInt(min, max) {
                min = Math.ceil(min)
                max = Math.floor(max)
                return Math.floor(Math.random() * (max - min + 1)) + min
            }
            function randomShuffle(a) {
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    [a[i], a[j]] = [a[j], a[i]]
                }
                return a
            }
            function updateChannelDuration() {
                scope.channel.duration = 0
                for (let i = 0, l = scope.channel.programs.length; i < l; i++) {
                    scope.channel.programs[i].start = new Date(scope.channel.startTime.valueOf() + scope.channel.duration)
                    scope.channel.duration += scope.channel.programs[i].duration
                    scope.channel.programs[i].stop = new Date(scope.channel.startTime.valueOf() + scope.channel.duration)
                }
            }
            scope.error = {}
            scope._onDone = (channel) => {
                if (typeof channel === 'undefined')
                    scope.onDone()
                else {
                    channelNumbers = []
                    for (let i = 0, l = scope.channels.length; i < l; i++) {
                        channelNumbers.push(scope.channels[i].number)
                    }
                    // validate
                    var now = new Date()
                    if (typeof channel.number === "undefined" || channel.number === null || channel.number === "") {
                        scope.error.number = "Select a channel number"
                    } else if (channelNumbers.indexOf(parseInt(channel.number, 10)) !== -1 && scope.isNewChannel) { // we need the parseInt for indexOf to work properly
                        scope.error.number = "Channel number already in use."
                    } else if (!scope.isNewChannel && channel.number !== scope.beforeEditChannelNumber && channelNumbers.indexOf(parseInt(channel.number, 10)) !== -1) {
                        scope.error.number = "Channel number already in use."
                    } else if (channel.number <= 0 || channel.number >= 2000) {
                        scope.error.name = "Enter a valid number (1-2000)"
                    } else if (typeof channel.name === "undefined" || channel.name === null || channel.name === "") {
                        scope.error.name = "Enter a channel name."
                    } else if (channel.icon !== "" && !validURL(channel.icon)) {
                        scope.error.icon = "Please enter a valid image URL. Or leave blank."
                    } else if (now < channel.startTime) {
                        scope.error.startTime = "Start time must not be set in the future."
                    } else if (channel.programs.length === 0) {
                        scope.error.programs = "No programs have been selected. Select at least one program."
                    } else {
                        // DONE.
                        scope.onDone(JSON.parse(angular.toJson(channel)))
                    }
                    $timeout(() => { scope.error = {} }, 3500)
                }
            }

            scope.importPrograms = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l; i++)
                    selectedPrograms[i].commercials = []
                scope.channel.programs = scope.channel.programs.concat(selectedPrograms)
                updateChannelDuration()
            }
            scope.selectProgram = (index) => {
                scope.selectedProgram = index
                scope._selectedProgram = JSON.parse(angular.toJson(scope.channel.programs[index]))
            }
            scope.removeItem = (x) => {
                scope.channel.programs.splice(x, 1)
                updateChannelDuration()
            }
        }
    }
}
function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}