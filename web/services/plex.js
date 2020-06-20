const Plex = require('../../src/plex');

module.exports = function ($http, $window, $interval) {
    return {
        login: async () => {
            const headers = {
                'Accept': 'application/json',
                'X-Plex-Product': 'PseudoTV',
                'X-Plex-Version': 'Plex OAuth',
                'X-Plex-Client-Identifier': 'rg14zekk3pa5zp4safjwaa8z',
                'X-Plex-Model': 'Plex OAuth'
            }

            return new Promise((resolve, reject) => {
                $http({
                    method: 'POST',
                    url: 'https://plex.tv/api/v2/pins?strong=true',
                    headers: headers
                }).then((res) => {
                    $window.open('https://app.plex.tv/auth/#!?clientID=rg14zekk3pa5zp4safjwaa8z&context[device][version]=Plex OAuth&context[device][model]=Plex OAuth&code=' + res.data.code + '&context[device][product]=Plex Web')
                    let limit = 120000 // 2 minute time out limit
                    let poll = 2000 // check every 2 seconds for token
                    let interval = $interval(() => {
                        $http({
                            method: 'GET',
                            url: `https://plex.tv/api/v2/pins/${res.data.id}`,
                            headers: headers
                        }).then(async (r2) => {
                            limit -= poll
                            if (limit <= 0) {
                                $interval.cancel(interval)
                                reject('Timed Out. Failed to sign in a timely manner (2 mins)')
                            }
                            if (r2.data.authToken !== null) {
                                $interval.cancel(interval)

                                headers['X-Plex-Token'] = r2.data.authToken

                                $http({
                                    method: 'GET',
                                    url: 'https://plex.tv/api/v2/resources?includeHttps=1',
                                    headers: headers
                                })
                                .then((r3) => {
                                    let res_servers = []

                                    const servers = r3.data; 
                                    
                                    servers.forEach((server) => {
                                        // not pms, skip
                                        if (server.provides != `server`)
                                            return;

                                        // true = local server, false = remote
                                        const i = (server.publicAddressMatches == true) ? 0 : server.connections.length - 1
                                        server.uri = server.connections[i].uri
                                        server.protocol = server.connections[i].protocol
                                        server.address = server.connections[i].address
                                        server.port = server.connections[i].port
    
                                        res_servers.push(server);
                                    });

                                    res.servers = res_servers
                                    resolve(res)
                                })
                                .catch((err) => {
                                    reject(err);
                                });
                            }
                        }, (err) => {
                            $interval.cancel(interval)
                            reject(err)
                        })
                        
                    }, poll)
                }, (err) => {
                    reject(err)
                })
            })
        },
        getLibrary: async (server) => {
            var client = new Plex(server)
            const res = await client.Get('/library/sections')
            var sections = []
            for (let i = 0, l = typeof res.Directory !== 'undefined' ? res.Directory.length : 0; i < l; i++)
                if (res.Directory[i].type === 'movie' || res.Directory[i].type === 'show')
                    sections.push({
                        title: res.Directory[i].title,
                        key: `/library/sections/${res.Directory[i].key}/all`,
                        icon: `${server.uri}${res.Directory[i].composite}?X-Plex-Token=${server.accessToken}`,
                        type: res.Directory[i].type
                    })
            return sections
        },
        getPlaylists: async (server) => {
            var client = new Plex(server)
            const res = await client.Get('/playlists')
            var playlists = []
            for (let i = 0, l = typeof res.Metadata !== 'undefined' ? res.Metadata.length : 0; i < l; i++)
                if (res.Metadata[i].playlistType === 'video')
                    playlists.push({
                        title: res.Metadata[i].title,
                        key: res.Metadata[i].key,
                        icon: `${server.uri}${res.Metadata[i].composite}?X-Plex-Token=${server.accessToken}`,
                        duration: res.Metadata[i].duration
                    })
            return playlists
        },
        getStreams: async (server, key) => {
            var client = new Plex(server)
            return client.Get(key).then((res) => { 
                let streams =  res.Metadata[0].Media[0].Part[0].Stream
                for (let i = 0, l = streams.length; i < l; i++) {
                    if (typeof streams[i].key !== 'undefined') {
                        streams[i].key = `${server.uri}${streams[i].key}?X-Plex-Token=${server.accessToken}`
                    }
                }
                return streams
            })
        },
        getNested: async (server, key) => {
            var client = new Plex(server)
            const res = await client.Get(key)
            var nested = []
            var seenFiles = {};
            for (let i = 0, l = typeof res.Metadata !== 'undefined' ? res.Metadata.length : 0; i < l; i++) {
                // Skip any videos (movie or episode) without a duration set...
                if (typeof res.Metadata[i].duration === 'undefined' && (res.Metadata[i].type === "episode" || res.Metadata[i].type === "movie"))
                    continue
                if (res.Metadata[i].duration <= 0 && (res.Metadata[i].type === "episode" || res.Metadata[i].type === "movie"))
                    continue
                var program = {
                    title: res.Metadata[i].title,
                    key: res.Metadata[i].key,
                    ratingKey: res.Metadata[i].ratingKey,
                    server: server,
                    icon: `${server.uri}${res.Metadata[i].thumb}?X-Plex-Token=${server.accessToken}`,
                    type: res.Metadata[i].type,
                    duration: res.Metadata[i].duration,
                    actualDuration: res.Metadata[i].duration,
                    durationStr: msToTime(res.Metadata[i].duration),
                    subtitle: res.Metadata[i].subtitle,
                    summary: res.Metadata[i].summary,
                    rating: res.Metadata[i].contentRating,
                    date: res.Metadata[i].originallyAvailableAt,
                    year: res.Metadata[i].year,
                }
                if (program.type === 'episode') {
                    //Make sure that video files that contain multiple episodes are only listed once:
                    var anyNewFile = false;
                    for (var j = 0; j < res.Metadata[i].Media.length; j++) {
                        for (var k = 0; k < res.Metadata[i].Media[j].Part.length; k++) {
                            var fileName = res.Metadata[i].Media[j].Part[k].file;
                            if (seenFiles[fileName] !== true) {
                                seenFiles[fileName] = true;
                                anyNewFile = true;
                            }
                        }
                    }
                    if (! anyNewFile) {
                        continue;
                    }
                    program.showTitle = res.Metadata[i].grandparentTitle
                    program.episode = res.Metadata[i].index
                    program.season = res.Metadata[i].parentIndex
                    program.icon = `${server.uri}${res.Metadata[i].grandparentThumb}?X-Plex-Token=${server.accessToken}`
                    program.episodeIcon = `${server.uri}${res.Metadata[i].thumb}?X-Plex-Token=${server.accessToken}`
                    program.seasonIcon = `${server.uri}${res.Metadata[i].parentThumb}?X-Plex-Token=${server.accessToken}`
                    program.showIcon = `${server.uri}${res.Metadata[i].grandparentThumb}?X-Plex-Token=${server.accessToken}`
                }
                else if (program.type === 'movie') {
                    program.showTitle = res.Metadata[i].title
                    program.episode = 1
                    program.season = 1
                }
                nested.push(program)
            }
            return nested
        }
    }
}

function msToTime(duration) {
    var milliseconds = parseInt((duration % 1000) / 100),
        seconds = Math.floor((duration / 1000) % 60),
        minutes = Math.floor((duration / (1000 * 60)) % 60),
        hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + ":" + minutes + ":" + seconds + "." + milliseconds;
}
