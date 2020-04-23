const Plex = require('../../src/plex')
module.exports = function () {
    return {
        login: (plex) => {
            var client = new Plex({ protocol: plex.protocol, host: plex.host, port: plex.port })
            return client.SignIn(plex.username, plex.password).then((res) => {
                return client.Get('/').then((_res) => {
                    res.name = _res.friendlyName
                    return res
                })
            })
        },
        getLibrary: (server) => {
            var client = new Plex(server)
            return client.Get('/library/sections').then((res) => {
                var sections = []
                for (let i = 0, l = typeof res.Directory !== 'undefined' ? res.Directory.length : 0; i < l; i++)
                    if (res.Directory[i].type === 'movie' || res.Directory[i].type === 'show')
                        sections.push({
                            title: res.Directory[i].title,
                            key: `/library/sections/${res.Directory[i].key}/all`,
                            icon: `${server.protocol}://${server.host}:${server.port}${res.Directory[i].composite}?X-Plex-Token=${server.token}`,
                            type: res.Directory[i].type
                        })
                return sections
            })
        },
        getPlaylists: (server) => {
            var client = new Plex(server)
            return client.Get('/playlists').then((res) => {
                var playlists = []
                for (let i = 0, l = typeof res.Metadata !== 'undefined' ? res.Metadata.length : 0; i < l; i++)
                    if (res.Metadata[i].playlistType === 'video')
                        playlists.push({
                            title: res.Metadata[i].title,
                            key: res.Metadata[i].key,
                            icon: `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].composite}?X-Plex-Token=${server.token}`,
                            duration: res.Metadata[i].duration
                        })
                return playlists
            })
        },
        getNested: (server, key) => {
            var client = new Plex(server)
            return client.Get(key).then(function (res) {
                var nested = []
                for (let i = 0, l = typeof res.Metadata !== 'undefined' ? res.Metadata.length : 0; i < l; i++) {
                    var program = {
                        title: res.Metadata[i].title,
                        key: res.Metadata[i].key,
                        icon: `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].thumb}?X-Plex-Token=${server.token}`,
                        type: res.Metadata[i].type,
                        duration: res.Metadata[i].duration,
                        actualDuration: res.Metadata[i].duration,
                        durationStr: msToTime(res.Metadata[i].duration),
                        subtitle: res.Metadata[i].subtitle,
                        summary: res.Metadata[i].summary,
                        rating: res.Metadata[i].contentRating,
                        date: res.Metadata[i].originallyAvailableAt,
                        year: res.Metadata[i].year
                    }
                    if (program.type === 'episode') {
                        program.showTitle = res.Metadata[i].grandparentTitle
                        program.episode = res.Metadata[i].index
                        program.season = res.Metadata[i].parentIndex
                        program.icon = `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].grandparentThumb}?X-Plex-Token=${server.token}`
                        program.episodeIcon = `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].thumb}?X-Plex-Token=${server.token}`
                        program.seasonIcon = `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].parentThumb}?X-Plex-Token=${server.token}`
                        program.showIcon = `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].grandparentThumb}?X-Plex-Token=${server.token}`
                        program.file = `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].Media[0].Part[0].key}?X-Plex-Token=${server.token}`
                    } else if (program.type === 'movie') {
                        program.file = `${server.protocol}://${server.host}:${server.port}${res.Metadata[i].Media[0].Part[0].key}?X-Plex-Token=${server.token}`
                        program.showTitle = res.Metadata[i].title
                        program.episode = 1
                        program.season = 1
                    }
                    nested.push(program)
                }
                return nested
            })
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