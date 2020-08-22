const Plex = require('../../src/plex');

module.exports = function ($http, $window, $interval) {
    let exported = {
        login: async () => {
            const headers = {
                'Accept': 'application/json',
                'X-Plex-Product': 'dizqueTV',
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

        check: async(server) => {
            let client = new Plex(server)
            try {
                const res = await client.Get('/')
                return 1;
            } catch (err) {
                console.error(err);
                return -1;
            }
        },

        getLibrary: async (server) => {
            var client = new Plex(server)
            const res = await client.Get('/library/sections')
            var sections = []
            for (let i = 0, l = typeof res.Directory !== 'undefined' ? res.Directory.length : 0; i < l; i++)
                if (res.Directory[i].type === 'movie' || res.Directory[i].type === 'show') {
                    var genres = []
                    if (res.Directory[i].type === 'movie') {
                        const genresRes = await client.Get(`/library/sections/${res.Directory[i].key}/genre`)
                        for (let q = 0, k = typeof genresRes.Directory !== 'undefined' ? genresRes.Directory.length : 0; q < k; q++) {
                            if (genresRes.Directory[q].type === 'genre') {
                                genres.push({
                                    title: 'Genre: ' + genresRes.Directory[q].title,
                                    key: genresRes.Directory[q].fastKey,
                                    type: 'genre'
                                })
                            }
                        }
                    }

                    sections.push({
                        title: res.Directory[i].title,
                        key: `/library/sections/${res.Directory[i].key}/all`,
                        icon: `${server.uri}${res.Directory[i].composite}?X-Plex-Token=${server.accessToken}`,
                        type: res.Directory[i].type,
                        genres: genres
                    })
                }
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
        getNested: async (server, lib, includeCollections, errors) => {
            var client = new Plex(server)
            const key = lib.key
            const res = await client.Get(key)
            var nested = []
            if (typeof (lib.genres) !== 'undefined') {
                nested = Array.from(lib.genres)
            }
            var seenFiles = {};
            var collections = {};
            for (let i = 0, l = typeof res.Metadata !== 'undefined' ? res.Metadata.length : 0; i < l; i++) {
              try {
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
                    durationStr: msToTime(res.Metadata[i].duration),
                    subtitle: res.Metadata[i].subtitle,
                    summary: res.Metadata[i].summary,
                    rating: res.Metadata[i].contentRating,
                    date: res.Metadata[i].originallyAvailableAt,
                    year: res.Metadata[i].year,
                }
                if (program.type === 'episode' || program.type === 'movie') {
                    program.plexFile = `${res.Metadata[i].Media[0].Part[0].key}`
                    program.file = `${res.Metadata[i].Media[0].Part[0].file}`
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
                if (typeof (res.Metadata[i].Collection) !== 'undefined') {
                    let coll = res.Metadata[i].Collection;
                    for (let j = 0; j < coll.length; j++) {
                        let tag = coll[j].tag;
                        if ( (typeof(tag)!==  "undefined") && (tag.length > 0) ) {
                            let collection = collections[tag];
                            if (typeof(collection) === 'undefined') {
                                collection = [];
                                collections[tag] = collection;
                            }
                            collection.push( program );
                        }
                    }
                }
                nested.push(program)
              } catch(err) {
                  let msg = "Error when attempting to read nested data for " + key + " " + res.Metadata[i].title;
                  errors.push(msg);
                  console.error(msg , err);
              }
            }
            if (includeCollections === true) {
                let nestedCollections = [];
                let keys = [];
                Object.keys(collections).forEach(function(key,index) {
                    keys.push(key);
                });
                for (let k = 0; k < keys.length; k++) {
                    let key = keys[k];
                    if (collections[key].length <= 1) {
                        //it's pointless to include it.
                        continue;
                    }
                    let collection = {
                        title: key,
                        key: "#collection",
                        icon : "",
                        type : "collection",
                        nested: collections[key],
                    }
                    if (res.viewGroup === 'show') {
                        collection.title = collection.title + " Collection";
                        //nest the seasons directly because that's way too many depth levels already
                        let shows = collection.nested;
                        let collectionContents = [];
                        for (let i = 0; i < shows.length; i++) {
                            let seasons = await exported.getNested(server, shows[i], false);
                            for (let j = 0; j < seasons.length; j++) {
                                seasons[j].title = shows[i].title + " - " + seasons[j].title;
                                collectionContents.push(seasons[j]);
                            }
                        }
                        collection.nested = collectionContents;
                    }
                    nestedCollections.push( collection );
                }
                nested = nestedCollections.concat(nested);
            }


            return nested
        }
    }
    return exported;
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
