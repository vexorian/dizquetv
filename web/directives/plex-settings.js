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
        }
    };
}