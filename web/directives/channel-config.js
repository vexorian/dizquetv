module.exports = function ($timeout, $location) {
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
            scope.millisecondsOffset = 0;
            if (typeof scope.channel === 'undefined' || scope.channel == null) {
                scope.channel = {}
                scope.channel.programs = []
                scope.isNewChannel = true
                scope.channel.icon = `${$location.protocol()}://${location.host}/images/pseudotv.png`
                scope.channel.iconWidth = 120
                scope.channel.iconDuration = 60
                scope.channel.iconPosition = "2"
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
                scope.showRotatedNote = false;
            } else {
                scope.beforeEditChannelNumber = scope.channel.number
                let t = Date.now();
                let originalStart = scope.channel.startTime.getTime();
                let n = scope.channel.programs.length;
                let totalDuration = scope.channel.duration;
                let m = (t - originalStart) % totalDuration;
                let x = 0;
                let runningProgram = -1;
                let offset = 0;
                for (let i = 0; i < n; i++) {
                    let d = scope.channel.programs[i].duration;
                    if (x + d > m) {
                        runningProgram = i
                        offset = m - x;
                        break;
                    } else {
                        x += d;
                    }
                }
                scope.millisecondsOffset  = (t - offset) % 1000;
                scope.channel.startTime = new Date(t - offset - scope.millisecondsOffset);
                // move runningProgram to index 0
                scope.channel.programs = scope.channel.programs.slice(runningProgram, this.length)
                    .concat(scope.channel.programs.slice(0, runningProgram) );
                updateChannelDuration();
                setTimeout( () => { scope.showRotatedNote = true }, 1, 'funky');
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
                shuffle(scope.channel.programs)
                updateChannelDuration()
            }
            scope.cyclicShuffle = () => {
                cyclicShuffle(scope.channel.programs);
                updateChannelDuration();
            }
            scope.wipeSchedule = () => {
                wipeSchedule(scope.channel.programs);
                updateChannelDuration();
            }

            function getRandomInt(min, max) {
                min = Math.ceil(min)
                max = Math.floor(max)
                return Math.floor(Math.random() * (max - min + 1)) + min
            }
            function shuffle(array) {
                let currentIndex = array.length, temporaryValue, randomIndex
                while (0 !== currentIndex) {
                    randomIndex = Math.floor(Math.random() * currentIndex)
                    currentIndex -= 1
                    temporaryValue = array[currentIndex]
                    array[currentIndex] = array[randomIndex]
                    array[randomIndex] = temporaryValue
                }
                return array
            }
            function wipeSchedule(array) {
                array.splice(0, array.length)
                return array;
            }
            function cyclicShuffle(array) {
                let shows = {};
                let next = {};
                let counts = {};
                // some precalculation, useful to stop the shuffle from being quadratic...
                for (let i = 0; i < array.length; i++) {
                    var vid = array[i];
                    if (vid.type != 'movie' && vid.season != 0) {
                        let countKey = {
                            title: vid.showTitle,
                            s: vid.season,
                            e: vid.episode,
                        }
                        let key = JSON.stringify(countKey);
                        let c = ( (typeof(counts[key]) === 'undefined') ? 0 : counts[key] );
                        counts[key] = c + 1;
                        let showEntry = {
                            c: c,
                            it: array[i],
                        }
                        if ( typeof(shows[vid.showTitle]) === 'undefined') {
                            shows[vid.showTitle] = [];
                        }
                        shows[vid.showTitle].push(showEntry);
                    }
                }
                //this is O(|N| log|M|) where |N| is the total number of TV
                // episodes and |M| is the maximum number of episodes
                // in a single show. I am pretty sure this is a lower bound
                // on the time complexity that's possible here.
                Object.keys(shows).forEach(function(key,index) {
                    shows[key].sort( (a,b) => {
                        if (a.c == b.c) {
                            if (a.it.season == b.it.season) {
                                if (a.it.episode == b.it.episode) {
                                    return 0;
                                } else {
                                    return (a.it.episode < b.it.episode)?-1: 1;
                                }
                            } else {
                                return (a.it.season < b.it.season)?-1: 1;
                            }
                        } else {
                            return (a.c < b.c)? -1: 1;
                        }
                    });
                    next[key] = Math.floor( Math.random() * shows[key].length );
                });
                shuffle(array);
                for (let i = 0; i < array.length; i++) {
                    if (array[i].type !== 'movie' && array[i].season != 0) {
                        let title = array[i].showTitle;
                        var sequence = shows[title];
                        var j = next[title];
                        array[i] = sequence[j].it;
                        
                        next[title] = (j + 1) % sequence.length;
                    }
                }
                return array
            }

            scope.updateChannelDuration = updateChannelDuration
            function updateChannelDuration() {
                scope.showRotatedNote = false;
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
                    for (let i = 0, l = scope.channels.length; i < l; i++)
                        channelNumbers.push(scope.channels[i].number)
                    // validate
                    var now = new Date()
                    if (typeof channel.number === "undefined" || channel.number === null || channel.number === "")
                        scope.error.number = "Select a channel number"
                    else if (channelNumbers.indexOf(parseInt(channel.number, 10)) !== -1 && scope.isNewChannel) // we need the parseInt for indexOf to work properly
                        scope.error.number = "Channel number already in use."
                    else if (!scope.isNewChannel && channel.number !== scope.beforeEditChannelNumber && channelNumbers.indexOf(parseInt(channel.number, 10)) !== -1)
                        scope.error.number = "Channel number already in use."
                    else if (channel.number <= 0 || channel.number >= 2000)
                        scope.error.name = "Enter a valid number (1-2000)"
                    else if (typeof channel.name === "undefined" || channel.name === null || channel.name === "")
                        scope.error.name = "Enter a channel name."
                    else if (channel.icon !== "" && !validURL(channel.icon))
                        scope.error.icon = "Please enter a valid image URL. Or leave blank."
                    else if (channel.overlayIcon && !validURL(channel.icon))
                        scope.error.icon = "Please enter a valid image URL. Cant overlay an invalid image."
                    else if (now < channel.startTime)
                        scope.error.startTime = "Start time must not be set in the future."
                    else if (channel.programs.length === 0)
                        scope.error.programs = "No programs have been selected. Select at least one program."
                    else {
                        channel.startTime.setMilliseconds( scope.millisecondsOffset);
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
function validURL(url) {
    return /^(ftp|http|https):\/\/[^ "]+$/.test(url);
}
