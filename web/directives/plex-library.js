module.exports = function (plex, pseudotv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/plex-library.html',
        replace: true,
        scope: {
            onFinish: "=onFinish",
            height: "=height",
            visible: "=visible"
        },
        link: function (scope, element, attrs) {
            scope.selection = []
            scope.selectServer = function (server) {
                scope.plexServer = server
                updateLibrary(server)
            }
            scope._onFinish = (s) => {
                scope.onFinish(JSON.parse(angular.toJson(s)))
                scope.selection = []
                scope.visible = false
            }
            scope.selectItem = (item) => {
                scope.selection.push(JSON.parse(angular.toJson(item)))
            }
            pseudotv.getPlexServers().then((servers) => {
                if (servers.length === 0) {
                    scope.noServers = true
                    return
                }
                scope.plexServers = servers
                scope.plexServer = servers[0]
                updateLibrary(scope.plexServer)
            })

            function updateLibrary(server) {
                plex.getLibrary(server).then((lib) => {
                    plex.getPlaylists(server).then((play) => {
                        for (let i = 0, l = play.length; i < l; i++)
                            play[i].type = 'playlist'
                        scope.$apply(() => {
                            scope.libraries = lib
                            if (play.length > 0)
                                scope.libraries.push({ title: "Playlists", key: "", icon: "", nested: play, collapse: false })
                        })
                    })
                }, (err) => {
                    console.log(err)
                })
            }
            scope.getNested = function (list) {
                if (typeof list.collapse == 'undefined') {
                    plex.getNested(scope.plexServer, list.key).then((res) => {
                        list.nested = res
                        list.collapse = true
                        scope.$apply()
                    }, (err) => {
                        console.log(err)
                    })
                } else {
                    list.collapse = !list.collapse
                }
            }
            scope.selectPlaylist = (playlist) => {
                if (typeof playlist.collapse == 'undefined') {
                    plex.getNested(scope.plexServer, playlist.key).then((res) => {
                        playlist.nested = res
                        for (let i = 0, l = playlist.nested.length; i < l; i++)
                            scope.selectItem(playlist.nested[i])
                        scope.$apply()
                    }, (err) => {
                        console.log(err)
                    })
                } else {
                    for (let i = 0, l = playlist.nested.length; i < l; i++)
                        scope.selectItem(playlist.nested[i])
                }
            }
            scope.createShowIdentifier = (season, ep) => {
                return 'S' + (season.toString().padStart(2, '0')) + 'E' + (ep.toString().padStart(2, '0'))
            }
        }
    };
}