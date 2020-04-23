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
            scope.plex = { protocol: 'http', host: '127.0.0.1', port: '32400', username: '', password: '', arGuide: false, arChannels: false }
            scope.addPlexServer = function (p) {
                scope.isProcessing = true
                plex.login(p)
                    .then((result) => {
                        delete p['username']
                        delete p['password']
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