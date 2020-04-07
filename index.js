const express = require('express')
var config = require('config-yml')

const plex = require('./src/plex')
const xmltv = require('./src/xmltv')
const m3u = require('./src/m3u')
const ffmpeg = require('./src/ffmpeg')
const vlc = require('./src/vlc')
const hdhr = require('./src/hdhr')()
const pseudotv = require('./src/pseudotv')

plex(config.PLEX_OPTIONS, (result) => {
    if (result.err)
        return console.error("Failed to create plex client.", result.err)
    var client = result.client

    console.log("Plex authentication successful")

    var app = express()
    if (config.MUXER.toLowerCase() === 'ffmpeg')
        app.use(ffmpeg(client))
    else if (config.MUXER.toLowerCase() === 'vlc')
        app.use(vlc(client))
    else
        return console.error("Invalid MUXER specified in config.yml")

    if (config.HDHOMERUN_OPTIONS.ENABLED)
        app.use(hdhr.router)

    app.use(pseudotv(client, xmltv, m3u))

    app.listen(config.PORT, () => {
        console.log(`pseudotv-plex: http://${config.HOST}:${config.PORT}`)
        if (config.HDHOMERUN_OPTIONS.ENABLED && config.HDHOMERUN_OPTIONS.AUTODISCOVERY)
            hdhr.ssdp.start()
    })
})
