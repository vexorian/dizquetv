const plex = require('plex-api')
const config = require('config-yml')

const client = new plex(config.PLEX_OPTIONS)

function PlexChannelScan(cb) {
    getPsuedoTVPlaylists((lineup) => {
        getAllPlaylistsInfo(lineup, cb)
    })
}

function getPsuedoTVPlaylists(cb) {
    var lineup = []
    client.query("/playlists/").then((result) => {
        var playlists = result.MediaContainer
        for (var i = 0; playlists.size > 0 && i < playlists.Metadata.length; i++) {
            var summaryData = playlists.Metadata[i].summary.split(/\s+/)
            if (playlists.Metadata[i].playlistType == 'video' && summaryData.length > 0 && summaryData[0].toLowerCase() == config.PLEX_PLAYLIST_SUMMARY_KEY) {
                var channelNumber = playlists.Metadata[i].ratingKey
                var channelIcon = ""
                if (summaryData.length > 1) {
                    if (!isNaN(summaryData[1]))
                        channelNumber = summaryData[1]
                    else if (validURL(summaryData[1]))
                        channelIcon = summaryData[1]
                }
                if (summaryData.length > 2) {
                    if (!isNaN(summaryData[2]))
                        channelNumber = summaryData[2]
                    else if (validURL(summaryData[2]))
                        channelIcon = summaryData[2]
                }
                lineup.push({ id: playlists.Metadata[i].ratingKey, channel: channelNumber, name: playlists.Metadata[i].title, icon: channelIcon, summary: playlists.Metadata[i].summary, updatedAt: playlists.Metadata[i].updatedAt })
            }
        }
        cb(lineup)
    }, (err) => {
        console.error("Could not connect to Plex server", err)
    })
}

function getAllPlaylistsInfo(lineup, cb) {
    var channelIndex = 0
    if (lineup.length == 0)
        return cb([])
    var lastUpdatedAt = 0
    var channelInfo = []
    getPlaylist(channelIndex, () => {
        cb(lineup, lastUpdatedAt, channelInfo.join())
    })
    // Fetch each playlist (channel) recursivley from Plex
    function getPlaylist(i, _cb) {
        client.query("/playlists/" + lineup[i].id + "/items").then(function (result) {
            var playlist = result.MediaContainer.Metadata
            lastUpdatedAt = lastUpdatedAt > lineup[i].updatedAt ? lastUpdatedAt : lineup[i].updatedAt
            channelInfo.push(lineup[i].name)
            channelInfo.push(lineup[i].summary)
            lineup[i].duration = typeof result.MediaContainer.duration !== 'undefined' ? result.MediaContainer.duration : 0
            lineup[i].playlist = typeof playlist !== 'undefined' ? playlist : []
            channelIndex++
            if (channelIndex < lineup.length)
                getPlaylist(channelIndex, _cb)
            else
                _cb()
        }, function (err) {
            console.error("Could not connect to Plex server", err)
        })
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

module.exports = {
    PlexChannelScan: PlexChannelScan
}