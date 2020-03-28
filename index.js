const express = require('express')
const fs = require('fs')
var path = require("path")
const config = require('config-yml')

const hdhr = require('./src/hdhr')
const vlc = require('./src/vlc')
const xmltv = require('./src/xmltv')
const m3u = require('./src/m3u')
const plex = require('./src/plex')

// Plex does not update the playlists updatedAt property when the summary or title changes
var lastPlaylistUpdate = 0      // to watch for playlist updates
var channelsInfo  = ""          // to watch for playlist updates

var refreshDate = new Date()    // when the EPG will be updated
refreshDate.setHours(refreshDate.getHours() + config.EPG_REFRESH)

plex.PlexChannelScan((channels, lastUpdate, info) => {
    console.log(`Generating EPG data(XMLTV) and channel playlists (M3U) from Plex. Channels: ${channels.length}`)
    lastPlaylistUpdate = lastUpdate
    channelsInfo = info
    m3u.WriteM3U(channels, () => { console.log(`M3U File Location: ${path.resolve(config.M3U_OUTPUT)}`) })
    xmltv.WriteXMLTV(channels, () => { console.log(`XMLTV File Location: ${path.resolve(config.XMLTV_OUTPUT)}`) })
})

setInterval(() => {
    plex.PlexChannelScan((channels, lastUpdate, info) => {
        var now = new Date()
        // Update EPG whenever a psuedotv playlist is updated/added/removed, or at EPG_REFRESH interval
        if (lastUpdate > lastPlaylistUpdate || channelsInfo !== info || now > refreshDate ) {
            console.log(`Updating EPG data(XMLTV) and channel playlists (M3U) from Plex. Channels: ${channels.length}`)
            m3u.WriteM3U(channels)
            xmltv.UpdateXMLTV(channels)
            lastPlaylistUpdate = lastUpdate
            channelsInfo = info
            refreshDate.setHours(refreshDate.getHours() + config.EPG_REFRESH)
    }})
}, config.PLEX_PLAYLIST_FETCH_TIMER * 1000)

var app = express()
app.use(hdhr.router())
app.use(vlc.router())
app.listen(config.PORT, () => {
    hdhr.start()
    console.log(`Hosting VLC / HDHomeRun server at: http://${config.HOST}:${config.PORT}`)
})
