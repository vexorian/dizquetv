
const express = require('express')
const fs = require('fs')
const databaseMigration = require('./database-migration');
const channelCache = require('./channel-cache')
const constants = require('./constants');
const FFMPEGInfo = require('./ffmpeg-info');
const PlexServerDB = require('./dao/plex-server-db');
const Plex = require("./plex.js");

module.exports = { router: api }
function api(db, channelDB, xmltvInterval) {
    let router = express.Router()
    let plexServerDB = new PlexServerDB(channelDB, channelCache, db);

    router.get('/api/version', async (req, res) => {
        let ffmpegSettings = db['ffmpeg-settings'].find()[0];
        let v = await (new FFMPEGInfo(ffmpegSettings)).getVersion();
        res.send( {
            "dizquetv" : constants.VERSION_NAME,
            "ffmpeg" : v,
        } );
    });

    // Plex Servers
    router.get('/api/plex-servers', (req, res) => {
        let servers = db['plex-servers'].find()
        servers.sort( (a,b) => { return a.index - b.index } );
        res.send(servers)
    })
    router.post("/api/plex-servers/status", async (req, res) => {
        let servers = db['plex-servers'].find( {
            name: req.body.name,
        });
        if (servers.length != 1) {
            return res.status(404).send("Plex server not found.");
        }
        let plex = new Plex(servers[0]);
        let s = await Promise.race( [
            (async() => {
                return await plex.checkServerStatus();
            })(),
            new Promise( (resolve, reject) => {
                setTimeout( () => { resolve(-1); }, 60000);
            }),
        ]);
        res.send( {
            status: s,
        });
    })
    router.post("/api/plex-servers/foreignstatus", async (req, res) => {
        let server = req.body;
        let plex = new Plex(server);
        let s = await Promise.race( [
            (async() => {
                return await plex.checkServerStatus();
            })(),
            new Promise( (resolve, reject) => {
                setTimeout( () => { resolve(-1); }, 60000);
            }),
        ]);
        res.send( {
            status: s,
        });
    })
    router.delete('/api/plex-servers', async (req, res) => {
        let name = req.body.name;
        if (typeof(name) === 'undefined') {
            return res.status(400).send("Missing name");
        }
        let report = await plexServerDB.deleteServer(name);
        res.send(report)
    })
    router.post('/api/plex-servers', async (req, res) => {
        try {
            await plexServerDB.updateServer(req.body);
            res.status(204).send("Plex server updated.");;
        } catch (err) {
            console.error("Could not add plex server.", err);
            res.status(400).send("Could not add plex server.");
        }
    })
    router.put('/api/plex-servers', async (req, res) => {
        try {
            await plexServerDB.addServer(req.body);
            res.status(201).send("Plex server added.");;
        } catch (err) {
            console.error("Could not add plex server.", err);
            res.status(400).send("Could not add plex server.");
        }
    })


    // Channels
    router.get('/api/channels', async (req, res) => {
        let channels = await channelDB.getAllChannels();
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        res.send(channels)
    })
    router.get('/api/channel/:number', async (req, res) => {
        let number = parseInt(req.params.number, 10);
        let channel = await channelCache.getChannelConfig(channelDB, number);
        if (channel.length == 1) {
            channel = channel[0];
            res.send(  channel );
        } else {
            return res.status(404).send("Channel not found");
        }
    })
    router.get('/api/channel/description/:number', async (req, res) => {
        let number = parseInt(req.params.number, 10);
        let channel = await channelCache.getChannelConfig(channelDB, number);
        if (channel.length == 1) {
            channel = channel[0];
            res.send( {
                number: channel.number,
                icon: channel.icon,
                name: channel.name,
            });
        } else {
            return res.status(404).send("Channel not found");
        }
    })
    router.get('/api/channelNumbers', async (req, res) => {
        let channels = await channelDB.getAllChannelNumbers();
        channels.sort( (a,b) => { return parseInt(a) - parseInt(b) } );
        res.send(channels)
    })
    router.post('/api/channel', async (req, res) => {
        cleanUpChannel(req.body);
        await channelDB.saveChannel( req.body.number, req.body );
        channelCache.clear();
        res.send( { number: req.body.number} )
        updateXmltv()
    })
    router.put('/api/channel', async (req, res) => {
        cleanUpChannel(req.body);
        await channelDB.saveChannel( req.body.number, req.body );
        channelCache.clear();
        res.send( { number: req.body.number} )
        updateXmltv()
    })
    router.delete('/api/channel', async (req, res) => {
        await channelDB.deleteChannel( req.body.number  );
        channelCache.clear();
        res.send( { number: req.body.number} )
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
        let ffmpeg = databaseMigration.defaultFFMPEG() ;
        ffmpeg.ffmpegPath = req.body.ffmpegPath;
        db['ffmpeg-settings'].update({ _id: req.body._id },  ffmpeg)
        ffmpeg = db['ffmpeg-settings'].find()[0]
        res.send(ffmpeg)
    })

    // PLEX SETTINGS
    router.get('/api/plex-settings', (req, res) => {
        let plex = db['plex-settings'].find()[0]
        res.send(plex)
    })
    router.put('/api/plex-settings', (req, res) => {
        db['plex-settings'].update({ _id: req.body._id }, req.body)
        let plex = db['plex-settings'].find()[0]
        res.send(plex)
    })
    router.post('/api/plex-settings', (req, res) => { // RESET
        db['plex-settings'].update({ _id: req.body._id }, {
            streamPath: 'plex',
            debugLogging: true,
            directStreamBitrate: '40000',
            transcodeBitrate: '3000',
            mediaBufferSize: 1000,
            transcodeMediaBufferSize: 20000,
            maxPlayableResolution: "1920x1080",
            maxTranscodeResolution: "1920x1080",
            videoCodecs: 'h264,hevc,mpeg2video,av1',
            audioCodecs: 'ac3',
            maxAudioChannels: '2',
            audioBoost: '100',
            enableSubtitles: false,
            subtitleSize: '100',
            updatePlayStatus: false,
            streamProtocol: 'http',
            forceDirectPlay: false,
            pathReplace: '',
            pathReplaceWith: ''
        })
        let plex = db['plex-settings'].find()[0]
        res.send(plex)
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
    router.get('/api/channels.m3u', async (req, res) => {
        res.type('text')
        let channels = await channelDB.getAllChannels();
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        var data = "#EXTM3U\n"
        for (var i = 0; i < channels.length; i++) {
            data += `#EXTINF:0 tvg-id="${channels[i].number}" tvg-chno="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}" group-title="dizqueTV",${channels[i].name}\n`
            data += `${req.protocol}://${req.get('host')}/video?channel=${channels[i].number}\n`
        }
        if (channels.length === 0) {
            data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="https://raw.githubusercontent.com/vexorian/dizquetv/main/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`
            data += `${req.protocol}://${req.get('host')}/setup\n`
        }
        res.send(data)
    })

    // hls.m3u Download is not really working correctly right now
    router.get('/api/hls.m3u', async (req, res) => {
        res.type('text')
        let channels = await channelDB.getAllChannels();
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        var data = "#EXTM3U\n"
        for (var i = 0; i < channels.length; i++) {
            data += `#EXTINF:0 tvg-id="${channels[i].number}" tvg-chno="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}" group-title="dizqueTV",${channels[i].name}\n`
            data += `${req.protocol}://${req.get('host')}/m3u8?channel=${channels[i].number}\n`
        }
        if (channels.length === 0) {
            data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="https://raw.githubusercontent.com/vexorian/dizquetv/main/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`
            data += `${req.protocol}://${req.get('host')}/setup\n`
        }
        res.send(data)
    })



    function updateXmltv() {
        xmltvInterval.updateXML()
        xmltvInterval.restartInterval()
    }

    function cleanUpProgram(program) {
        delete program.start
        delete program.stop
        delete program.streams;
        delete program.durationStr;
        delete program.commercials;
    }

    function cleanUpChannel(channel) {
        channel.programs.forEach( cleanUpProgram );
        channel.fillerContent.forEach( cleanUpProgram );
        channel.fallback.forEach( cleanUpProgram );
    }


    return router
}
