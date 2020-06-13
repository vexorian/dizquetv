var pseudotvVersion = "0.5.1";

const db = require('diskdb')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const api = require('./src/api')
const video = require('./src/video')
const HDHR = require('./src/hdhr')

const xmltv = require('./src/xmltv')
const Plex = require('./src/plex')

console.log("PseudoTV Version: " + pseudotvVersion)

for (let i = 0, l = process.argv.length; i < l; i++) {
    if ((process.argv[i] === "-p" || process.argv[i] === "--port") && i + 1 !== l)
        process.env.PORT = process.argv[i + 1]
    if ((process.argv[i] === "-d" || process.argv[i] === "--database") && i + 1 !== l)
        process.env.DATABASE = process.argv[i + 1]
}

process.env.DATABASE = process.env.DATABASE || './.pseudotv'
process.env.PORT = process.env.PORT || 8000

if (!fs.existsSync(process.env.DATABASE))
    fs.mkdirSync(process.env.DATABASE)

if(!fs.existsSync(path.join(process.env.DATABASE, 'images')))
    fs.mkdirSync(path.join(process.env.DATABASE, 'images'))

db.connect(process.env.DATABASE, ['channels', 'plex-servers', 'ffmpeg-settings', 'plex-settings', 'xmltv-settings', 'hdhr-settings'])

initDB(db)

let xmltvInterval = {
    interval: null,
    lastRefresh: null,
    updateXML: () => {
        let channels = db['channels'].find()
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        let xmltvSettings = db['xmltv-settings'].find()[0]
        xmltv.WriteXMLTV(channels, xmltvSettings).then(async () => {    // Update XML
            xmltvInterval.lastRefresh = new Date()
            console.log('XMLTV Updated at ', xmltvInterval.lastRefresh.toLocaleString())
            let plexServers = db['plex-servers'].find()
            for (let i = 0, l = plexServers.length; i < l; i++) {       // Foreach plex server
                var plex = new Plex(plexServers[i])
                await plex.GetDVRS().then(async (dvrs) => {             // Refresh guide and channel mappings
                    if (plexServers[i].arGuide)
                        plex.RefreshGuide(dvrs).then(() => { }, (err) => { console.error(err, i) })
                    if (plexServers[i].arChannels && channels.length !== 0)
                        plex.RefreshChannels(channels, dvrs).then(() => { }, (err) => { console.error(err, i) })
                })
            }
        }, (err) => {
            console.error("Failed to write the xmltv.xml file. Something went wrong. Check your output directory via the web UI and verify file permissions?", err)
        })
    },
    startInterval: () => {
        let xmltvSettings = db['xmltv-settings'].find()[0]
        if (xmltvSettings.refresh !== 0) {
            xmltvInterval.interval = setInterval(() => {
                xmltvInterval.updateXML()
            }, xmltvSettings.refresh * 60 * 60 * 1000)
        }
    },
    restartInterval: () => {
        if (xmltvInterval.interval !== null)
            clearInterval(xmltvInterval.interval)
        xmltvInterval.startInterval()
    }
}

xmltvInterval.updateXML()
xmltvInterval.startInterval()

let hdhr = HDHR(db)
let app = express()
app.use(bodyParser.json({limit: '50mb'}))
app.use(express.static(path.join(__dirname, 'web/public')))
app.use('/images', express.static(path.join(process.env.DATABASE, 'images')))
app.use(api.router(db, xmltvInterval))
app.use(video.router(db))
app.use(hdhr.router)
app.listen(process.env.PORT, () => {
    console.log(`HTTP server running on port: http://*:${process.env.PORT}`)
    let hdhrSettings = db['hdhr-settings'].find()[0]
    if (hdhrSettings.autoDiscovery === true)
        hdhr.ssdp.start()
})

function initDB(db) {
    let ffmpegSettings = db['ffmpeg-settings'].find()
    let plexSettings = db['plex-settings'].find()
    if (!fs.existsSync(process.env.DATABASE + '/font.ttf')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/font.ttf')))
        fs.writeFileSync(process.env.DATABASE + '/font.ttf', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/pseudotv.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/pseudotv.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/pseudotv.png', data)
    }

    if (ffmpegSettings.length === 0) {
        db['ffmpeg-settings'].save({
            ffmpegPath: '/usr/bin/ffmpeg',
            enableChannelOverlay: false,
            threads: 4,
            videoEncoder: 'mpeg2video',
            videoResolutionHeight: 'unchanged',
            videoBitrate: 10000,
            videoBufSize: 2000,
            concatMuxDelay: '0',
            logFfmpeg: true
        })
    }

    if (plexSettings.length === 0) {
        db['plex-settings'].save({
            directStreamBitrate: '40000',
            transcodeBitrate: '3000',
            mediaBufferSize: 1000,
            transcodeMediaBufferSize: 20000,
            maxPlayableResolution: "1920x1080",
            maxTranscodeResolution: "1920x1080",
            videoCodecs: 'h264,hevc,mpeg2video',
            audioCodecs: 'ac3,aac,mp3',
            maxAudioChannels: '6',
            enableSubtitles: false,
            subtitleSize: '100',
            updatePlayStatus: false,
            streamProtocol: 'http'
        })
    }

    let xmltvSettings = db['xmltv-settings'].find()
    if (xmltvSettings.length === 0) {
        db['xmltv-settings'].save({
            cache: 12,
            refresh: 4,
            file: `${process.env.DATABASE}/xmltv.xml`
        })
    }
    let hdhrSettings = db['hdhr-settings'].find()
    if (hdhrSettings.length === 0) {
        db['hdhr-settings'].save({
            tunerCount: 1,
            autoDiscovery: true
        })
    }
}
