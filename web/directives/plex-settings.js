module.exports = function (plex, pseudotv, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/plex-settings.html',
        replace: true,
        scope: {},
        link: function (scope, element, attrs) {
            pseudotv.getPlexServers().then((servers) => {
                scope.servers = servers
            })
            scope.plex = { protocol: 'http', host: '', port: '32400', arGuide: false, arChannels: false }
            scope.addPlexServer = function (p) {
                scope.isProcessing = true
                if (scope.plex.host === '') {
                    scope.isProcessing = false
                    scope.error = 'Invalid HOST set'
                    $timeout(() => {
                        scope.error = null
                    }, 3500)
                    return
                } else if (scope.plex.port <= 0) {
                    scope.isProcessing = false
                    scope.error = 'Invalid PORT set'
                    $timeout(() => {
                        scope.error = null
                    }, 3500)
                    return
                }
                plex.login(p)
                    .then((result) => {
                        p.token = result.token
                        p.name = result.name
                        return pseudotv.addPlexServer(p)
                    }).then((servers) => {
                        scope.$apply(() => {
                            scope.servers = servers
                            scope.isProcessing = false
                            scope.visible = false
                        })
                    }, (err) => {
                        scope.$apply(() => {
                            scope.isProcessing = false
                            scope.error = err
                            $timeout(() => {
                                scope.error = null
                            }, 3500)
                        })
                    })
            }
            scope.deletePlexServer = (x) => {
                pseudotv.removePlexServer(x)
                    .then((servers) => {
                        scope.servers = servers
                    })
            }
            scope.toggleVisiblity = function () {
                scope.visible = !scope.visible
            }
            pseudotv.getPlexSettings().then((settings) => {
                scope.settings = settings
            })
            scope.updateSettings = (settings) => {
                pseudotv.updatePlexSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.resetSettings = (settings) => {
                pseudotv.resetPlexSettings(settings).then((_settings) => {
                    scope.settings = _settings
                })
            }
            scope.maxAudioChannelsOptions=[
                {id:"1",description:"1.0"},
                {id:"2",description:"2.0"},
                {id:"3",description:"2.1"},
                {id:"4",description:"4.0"},
                {id:"5",description:"5.0"},
                {id:"6",description:"5.1"},
                {id:"7",description:"6.1"},
                {id:"8",description:"7.1"}
            ];
            scope.resolutionOptions=[
                {id:"420x420",description:"420x420"},
                {id:"576x320",description:"576x320"},
                {id:"720x480",description:"720x480"},
                {id:"1024x768",description:"1024x768"},
                {id:"1280x720",description:"1280x720"},
                {id:"1920x1080",description:"1920x1080"},
                {id:"3840x2160",description:"3840x2160"}
            ];
        }
    };
}