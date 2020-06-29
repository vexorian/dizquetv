module.exports = function ($scope, pseudotv) {
    $scope.channels = []
    $scope.showChannelConfig = false
    $scope.selectedChannel = null
    $scope.selectedChannelIndex = -1

    pseudotv.getChannels().then((channels) => {
        $scope.channels = channels
    })
    $scope.removeChannel = (channel) => {
        if (confirm("Are you sure to delete channel: " + channel.name + "?")) {
            pseudotv.removeChannel(channel).then((channels) => {
                $scope.channels = channels
            })
        }
    }
    $scope.onChannelConfigDone = (channel) => {
        if (typeof channel !== 'undefined') {
            if ($scope.selectedChannelIndex == -1) { // add new channel
                pseudotv.addChannel(channel).then((channels) => {
                    $scope.channels = channels
                })
            } else { // update existing channel
                pseudotv.updateChannel(channel).then((channels) => {
                    $scope.channels = channels
                })
            }
        }
        $scope.showChannelConfig = false
    }
    $scope.selectChannel = (index) => {
        if (index === -1) {
            $scope.selectedChannel = null
            $scope.selectedChannelIndex = -1
        } else {
            let newObj = JSON.parse(angular.toJson($scope.channels[index]))
            newObj.startTime = new Date(newObj.startTime)
            $scope.selectedChannel = newObj
            $scope.selectedChannelIndex = index
        }
        $scope.showChannelConfig = true
    }
}