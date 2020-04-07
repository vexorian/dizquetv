function getPsuedoTVPlaylists(_client, cb) {
    var lineup = []
    _client.Get("/playlists/", (result) => {
        var playlists = result.result.MediaContainer
        for (var i = 0; playlists.size > 0 && i < playlists.Metadata.length; i++) {
            var summaryData = playlists.Metadata[i].summary.split(/\s+/)
            if (playlists.Metadata[i].playlistType == 'video' && summaryData.length > 0 && summaryData[0].toLowerCase() == 'pseudotv') {
                var channelNumber = playlists.Metadata[i].ratingKey
                var channelIcon = ""
                var shuffle = false
                if (summaryData.length > 1) {
                    if (!isNaN(summaryData[1]))
                        channelNumber = summaryData[1]
                    else if (validURL(summaryData[1]))
                        channelIcon = summaryData[1]
                    else if (summaryData[1] === 'shuffle')
                        shuffle = true
                }
                if (summaryData.length > 2) {
                    if (!isNaN(summaryData[2]))
                        channelNumber = summaryData[2]
                    else if (validURL(summaryData[2]))
                        channelIcon = summaryData[2]
                    else if (summaryData[2] === 'shuffle')
                        shuffle = true
                }
                if (summaryData.length > 3) {
                    if (!isNaN(summaryData[3]))
                        channelNumber = summaryData[3]
                    else if (validURL(summaryData[3]))
                        channelIcon = summaryData[3]
                    else if (summaryData[3] === 'shuffle')
                        shuffle = true
                }
                lineup.push({
                    id: playlists.Metadata[i].ratingKey,
                    channel: channelNumber,
                    shuffle: shuffle,
                    name: playlists.Metadata[i].title,
                    icon: channelIcon,
                    summary: playlists.Metadata[i].summary
                })
            }
        }
        cb(lineup)
    })
}

function getAllPlaylistsInfo(_client, lineup, cb) {
    var channelIndex = 0
    if (lineup.length == 0)
        return cb([])
    getPlaylist(channelIndex, () => { cb(lineup) })
    // Fetch each playlist (channel) recursivley from Plex
    function getPlaylist(i, _cb) {
        _client.Get("/playlists/" + lineup[i].id + "/items", (result) => {
            var playlist = result.result.MediaContainer.Metadata
            lineup[i].items = typeof playlist !== 'undefined' ? playlist : []
            if (lineup[i].shuffle)
                shuffle(lineup[i].items)
            channelIndex++
            if (channelIndex < lineup.length)
                getPlaylist(channelIndex, _cb)
            else
                _cb()
        })
    }
}

module.exports = {
    getPsuedoTVPlaylists: getPsuedoTVPlaylists,
    getAllPlaylistsInfo: getAllPlaylistsInfo
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

var shuffle = function (items) {
    var i = items.length
    var tmp, r
    while (i !== 0) {
        r = Math.floor(Math.random() * i)
        i--
        tmp = items[i]
        items[i] = items[r]
        items[r] = tmp
    }
    return items
}