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
                    console.log(channel.startTime.toLocaleString())
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