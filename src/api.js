
const express = require('express')
const fs = require('fs')

module.exports = { router: api }
function api(db, xmltvInterval) {
    let router = express.Router()

    // Plex Servers
    router.get('/api/plex-servers', (req, res) => {
        let servers = db['plex-servers'].find()
        res.send(servers)
    })
    router.delete('/api/plex-servers', (req, res) => {
        db['plex-servers'].remove(req.body, false)
        let servers = db['plex-servers'].find()
        res.send(servers)
    })
    router.post('/api/plex-servers', (req, res) => {
        db['plex-servers'].save(req.body)
        let servers = db['plex-servers'].find()
        res.send(servers)
    })

    // Channels
    router.get('/api/channels', (req, res) => {
        let channels = db['channels'].find()
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        res.send(channels)
    })
    router.post('/api/channels', (req, res) => {
        db['channels'].save(req.body)
        let channels = db['channels'].find()
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        res.send(channels)
        updateXmltv()

    })
    router.put('/api/channels', (req, res) => {
        db['channels'].update({ _id: req.body._id }, req.body)
        let channels = db['channels'].find()
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        res.send(channels)
        updateXmltv()
    })
    router.delete('/api/channels', (req, res) => {
        db['channels'].remove({ _id: req.body._id }, false)
        let channels = db['channels'].find()
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        res.send(channels)
        updateXmltv()
    })

    // FFMPEG SETTINGS
    router.get('/api/ffmpeg-settings', (req, res) => {
        let ffmpeg = db['ffmpeg-settings'].find()[0]
        res.send(ffmpeg)
    })
    router.put('/api/ffmpeg-settings', (req, res) => {
        db['ffmpeg-settings'].update({ _id: req.body._id }, req.body)
        let ffmpeg = db['ffmpeg-settings'].find()[0]
        res.send(ffmpeg)
    })
    router.post('/api/ffmpeg-settings', (req, res) => { // RESET
        db['ffmpeg-settings'].update({ _id: req.body._id }, {
            ffmpegPath: req.body.ffmpegPath,
            videoStreamMode: 'transcodeVideo',
            audioStreamMode: 'transcodeAudio',
            reduceAudioTranscodes: true,
            offset: 0,
            threads: 4,
            videoEncoder: 'libx264',
            videoResolution: '1280x720',
            videoFrameRate: 30,
            videoBitrate: 10000,
            videoBufSize: 1000,
            audioBitrate: 192,
            audioChannels: 2,
            audioRate: 48000,
            audioEncoder: 'ac3',
            oneChAudioBitrate: 156,
            oneChAudioRate: 48000,
            oneChAudioEncoder: 'ac3',
            twoChAudioBitrate: 192,
            twoChAudioRate: 48000,
            twoChAudioEncoder: 'ac3',
            fivePointOneChAudioBitrate: 336,
            fivePointOneChAudioRate: 48000,
            fivePointOneChAudioEncoder: 'ac3',
            sixPointOneChAudioBitrate: 350,
            sixPointOneChAudioRate: 48000,
            sixPointOneChAudioEncoder: 'ac3',
            transcodeSixPointOneAudioToFivePointOne: false,
            logFfmpeg: false,
            args: `-threads 4
-ss STARTTIME
-re
-i INPUTFILE
-t DURATION
-map VIDEOSTREAM
-map AUDIOSTREAM
-c:v libx264
-c:a ac3
-ac 2
-ar 48000
-b:a 192k
-b:v 10000k
-s 1280x720
-r 30
-flags cgop+ilme
-sc_threshold 1000000000
-minrate:v 10000k
-maxrate:v 10000k
-bufsize:v 1000k
-metadata service_provider="PseudoTV"
-metadata CHANNELNAME
-f mpegts
-output_ts_offset TSOFFSET
-muxdelay 0
-muxpreload 0
OUTPUTFILE`
        })
        let ffmpeg = db['ffmpeg-settings'].find()[0]
        res.send(ffmpeg)
    })
    router.get('/api/xmltv-last-refresh', (req, res) => {
        res.send(JSON.stringify({ value: xmltvInterval.lastUpdated.valueOf() }))
    })

    // XMLTV SETTINGS
    router.get('/api/xmltv-settings', (req, res) => {
        let xmltv = db['xmltv-settings'].find()[0]
        res.send(xmltv)
    })
    router.put('/api/xmltv-settings', (req, res) => {
        db['xmltv-settings'].update({ _id: req.body._id }, req.body)
        let xmltv = db['xmltv-settings'].find()[0]
        res.send(xmltv)
        updateXmltv()
    })
    router.post('/api/xmltv-settings', (req, res) => {
        db['xmltv-settings'].update({ _id: req.body._id }, {
            _id: req.body._id,
            cache: 12,
            refresh: 4,
            file: process.env.DATABASE + '/xmltv.xml'
        })
        var xmltv = db['xmltv-settings'].find()[0]
        res.send(xmltv)
        updateXmltv()
    })


    //HDHR SETTINGS
    router.get('/api/hdhr-settings', (req, res) => {
        let hdhr = db['hdhr-settings'].find()[0]
        res.send(hdhr)
    })
    router.put('/api/hdhr-settings', (req, res) => {
        db['hdhr-settings'].update({ _id: req.body._id }, req.body)
        let hdhr = db['hdhr-settings'].find()[0]
        res.send(hdhr)
    })
    router.post('/api/hdhr-settings', (req, res) => {
        db['hdhr-settings'].update({ _id: req.body._id }, {
            _id: req.body._id,
            tunerCount: 1,
            autoDiscovery: true,
        })
        var hdhr = db['hdhr-settings'].find()[0]
        res.send(hdhr)
    })


    // XMLTV.XML Download
    router.get('/api/xmltv.xml', (req, res) => {
        res.type('text')
        let xmltvSettings = db['xmltv-settings'].find()[0]
        res.send(fs.readFileSync(xmltvSettings.file))
    })

    // CHANNELS.M3U Download 
    router.get('/api/channels.m3u', (req, res) => {
        res.type('text')
        let channels = db['channels'].find()
        var data = "#EXTM3U\n"
        for (var i = 0; i < channels.length; i++) {
            data += `#EXTINF:0 tvg-id="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}",${channels[i].name}\n`
            data += `${req.protocol}://${req.get('host')}/video?channel=${channels[i].number}\n`
        }
        if (channels.length === 0) {
            data += `#EXTINF:0 tvg-id="1" tvg-name="PseudoTV" tvg-logo="https://raw.githubusercontent.com/DEFENDORe/pseudotv/master/resources/pseudotv.png",PseudoTV\n`
            data += `${req.protocol}://${req.get('host')}/setup\n`
        }
        res.send(data)
    })

    function updateXmltv() {
        xmltvInterval.updateXML()
        xmltvInterval.restartInterval()
    }

    return router
}