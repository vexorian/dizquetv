
const express = require('express')
const path = require('path')
const databaseMigration = require('./database-migration');
const channelCache = require('./channel-cache')
const constants = require('./constants');
const FFMPEGInfo = require('./ffmpeg-info');
const PlexServerDB = require('./dao/plex-server-db');
const Plex = require("./plex.js");
const FillerDB = require('./dao/filler-db');
const timeSlotsService = require('./services/time-slots-service');

module.exports = { router: api }
function api(db, channelDB, fillerDB, xmltvInterval,  guideService ) {
    let router = express.Router()
    let plexServerDB = new PlexServerDB(channelDB, channelCache, db);

    router.get('/api/version', async (req, res) => {
      try {
        let ffmpegSettings = db['ffmpeg-settings'].find()[0];
        let v = await (new FFMPEGInfo(ffmpegSettings)).getVersion();
        res.send( {
            "dizquetv" : constants.VERSION_NAME,
            "ffmpeg" : v,
        } );
      } catch(err) {
          console.error(err);
          res.status(500).send("error");
      }
    });

    // Plex Servers
    router.get('/api/plex-servers', (req, res) => {
      try {
        let servers = db['plex-servers'].find()
        servers.sort( (a,b) => { return a.index - b.index } );
        res.send(servers)
      } catch(err) {
         console.error(err);
        res.status(500).send("error");
      }
    })
    router.post("/api/plex-servers/status", async (req, res) => {
      try {
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
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.post("/api/plex-servers/foreignstatus", async (req, res) => {
      try {
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
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.delete('/api/plex-servers', async (req, res) => {
      try {
        let name = req.body.name;
        if (typeof(name) === 'undefined') {
            return res.status(400).send("Missing name");
        }
        let report = await plexServerDB.deleteServer(name);
        res.send(report)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
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
      try {
        let channels = await channelDB.getAllChannels();
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        res.send(channels)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.get('/api/channel/:number', async (req, res) => {
      try {
        let number = parseInt(req.params.number, 10);
        let channel = await channelCache.getChannelConfig(channelDB, number);
        if (channel.length == 1) {
            channel = channel[0];
            res.send(  channel );
        } else {
            return res.status(404).send("Channel not found");
        }
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.get('/api/channel/description/:number', async (req, res) => {
      try {
        let number = parseInt(req.params.number, 10);
        let channel = await channelCache.getChannelConfig(channelDB, number);
        if (channel.length == 1) {
            channel = channel[0];
            res.send( {
                number: channel.number,
                icon: channel.icon,
                name: channel.name,
                stealth: channel.stealth,
            });
        } else {
            return res.status(404).send("Channel not found");
        }
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.get('/api/channelNumbers', async (req, res) => {
      try {
        let channels = await channelDB.getAllChannelNumbers();
        channels.sort( (a,b) => { return parseInt(a) - parseInt(b) } );
        res.send(channels)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.post('/api/channel', async (req, res) => {
      try {
        cleanUpChannel(req.body);
        await channelDB.saveChannel( req.body.number, req.body );
        channelCache.clear();
        res.send( { number: req.body.number} )
        updateXmltv()
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.put('/api/channel', async (req, res) => {
      try {
        cleanUpChannel(req.body);
        await channelDB.saveChannel( req.body.number, req.body );
        channelCache.clear();
        res.send( { number: req.body.number} )
        updateXmltv()
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.delete('/api/channel', async (req, res) => {
      try {
        await channelDB.deleteChannel( req.body.number  );
        channelCache.clear();
        res.send( { number: req.body.number} )
        updateXmltv()
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })

    // Filler
    router.get('/api/fillers', async (req, res) => {
      try {
        let fillers = await fillerDB.getAllFillersInfo();
        res.send(fillers);
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.get('/api/filler/:id', async (req, res) => {
      try {
        let id = req.params.id;
        if (typeof(id) === 'undefined') {
          return res.status(400).send("Missing id");
        }
        let filler = await fillerDB.getFiller(id);
        if (filler == null) {
            return res.status(404).send("Filler not found");
        }
        res.send(filler);
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.post('/api/filler/:id', async (req, res) => {
      try {
        let id = req.params.id;
        if (typeof(id) === 'undefined') {
          return res.status(400).send("Missing id");
        }
        await fillerDB.saveFiller(id, req.body );
        return res.status(204).send({});
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.put('/api/filler', async (req, res) => {
      try {
        let uuid = await fillerDB.createFiller(req.body );
        return res.status(201).send({id: uuid});
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.delete('/api/filler/:id', async (req, res) => {
      try {
        let id = req.params.id;
        if (typeof(id) === 'undefined') {
          return res.status(400).send("Missing id");
        }
        await fillerDB.deleteFiller(id);
        return res.status(204).send({});
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })

    router.get('/api/filler/:id/channels', async(req, res) => {
      try {
        let id = req.params.id;
        if (typeof(id) === 'undefined') {
          return res.status(400).send("Missing id");
        }
        let channels = await fillerDB.getFillerChannels(id);
        if (channels == null) {
            return res.status(404).send("Filler not found");
        }
        res.send(channels);
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }
    } );


    // FFMPEG SETTINGS
    router.get('/api/ffmpeg-settings', (req, res) => {
      try {
        let ffmpeg = db['ffmpeg-settings'].find()[0]
        res.send(ffmpeg)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.put('/api/ffmpeg-settings', (req, res) => {
      try {
        db['ffmpeg-settings'].update({ _id: req.body._id }, req.body)
        let ffmpeg = db['ffmpeg-settings'].find()[0]
        let err = fixupFFMPEGSettings(ffmpeg);
        if (typeof(err) !== 'undefined') {
          return res.status(400).send(err);
        }
        res.send(ffmpeg)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.post('/api/ffmpeg-settings', (req, res) => { // RESET
      try {
        let ffmpeg = databaseMigration.defaultFFMPEG() ;
        ffmpeg.ffmpegPath = req.body.ffmpegPath;
        db['ffmpeg-settings'].update({ _id: req.body._id },  ffmpeg)
        ffmpeg = db['ffmpeg-settings'].find()[0]
        res.send(ffmpeg)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }

    })

    function fixupFFMPEGSettings(ffmpeg) {
      if (typeof(ffmpeg.maxFPS) === 'undefined') {
        ffmpeg.maxFPS = 60;
      } else if ( isNaN(ffmpeg.maxFPS) ) {
        return "maxFPS should be a number";
      }
    }

    // PLEX SETTINGS
    router.get('/api/plex-settings', (req, res) => {
      try {
        let plex = db['plex-settings'].find()[0]
        res.send(plex)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }
    })
    router.put('/api/plex-settings', (req, res) => {
      try {
        db['plex-settings'].update({ _id: req.body._id }, req.body)
        let plex = db['plex-settings'].find()[0]
        res.send(plex)
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }

    })
    router.post('/api/plex-settings', (req, res) => { // RESET
      try {
        db['plex-settings'].update({ _id: req.body._id }, {
            streamPath: 'plex',
            debugLogging: true,
            directStreamBitrate: '20000',
            transcodeBitrate: '2000',
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
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }

    })

    router.get('/api/xmltv-last-refresh', (req, res) => {
      try {
        res.send(JSON.stringify({ value: xmltvInterval.lastUpdated.valueOf() }))
      } catch(err) {
        console.error(err);
       res.status(500).send("error");
      }

    })

    // XMLTV SETTINGS
    router.get('/api/xmltv-settings', (req, res) => {
      try {
        let xmltv = db['xmltv-settings'].find()[0]
        res.send(xmltv)
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })
    router.put('/api/xmltv-settings', (req, res) => {
      try {
        let xmltv = db['xmltv-settings'].find()[0]
        db['xmltv-settings'].update(
            { _id: req.body._id },
            {
                _id: req.body._id,
                cache:   req.body.cache,
                refresh: req.body.refresh,
                file: xmltv.file,
            }
        );
        xmltv = db['xmltv-settings'].find()[0]
        res.send(xmltv)
        updateXmltv()
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })
    router.post('/api/xmltv-settings', (req, res) => {
      try {
        db['xmltv-settings'].update({ _id: req.body._id }, {
            _id: req.body._id,
            cache: 12,
            refresh: 4,
            file: process.env.DATABASE + '/xmltv.xml'
        })
        var xmltv = db['xmltv-settings'].find()[0]
        res.send(xmltv)
        updateXmltv()
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }
    })

    router.get('/api/guide/status', async (req, res) => {
        try {
            let s = await guideService.getStatus();
            res.send(s);
        } catch(err) {
            console.error(err);
            res.status(500).send("error");
        }
    });

    router.get('/api/guide/debug', async (req, res) => {
      try {
          let s = await guideService.get();
          res.send(s);
      } catch(err) {
          console.error(err);
          res.status(500).send("error");
      }
  });


    router.get('/api/guide/channels/:number', async (req, res) => {
        try {
            let dateFrom = new Date(req.query.dateFrom);
            let dateTo = new Date(req.query.dateTo);
            let lineup = await guideService.getChannelLineup(  req.params.number , dateFrom, dateTo );
            if (lineup == null) {
              console.log(`GET /api/guide/channels/${req.params.number} : 404 Not Found`);
              res.status(404).send("Channel not found in TV guide");
            } else {
              res.send( lineup );
            }
        } catch (err) {
            console.error(err);
            res.status(500).send("error");
        }
    });


    //HDHR SETTINGS
    router.get('/api/hdhr-settings', (req, res) => {
      try {
        let hdhr = db['hdhr-settings'].find()[0]
        res.send(hdhr)
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })
    router.put('/api/hdhr-settings', (req, res) => {
      try {
        db['hdhr-settings'].update({ _id: req.body._id }, req.body)
        let hdhr = db['hdhr-settings'].find()[0]
        res.send(hdhr)
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })
    router.post('/api/hdhr-settings', (req, res) => {
      try {
        db['hdhr-settings'].update({ _id: req.body._id }, {
            _id: req.body._id,
            tunerCount: 1,
            autoDiscovery: true,
        })
        var hdhr = db['hdhr-settings'].find()[0]
        res.send(hdhr)
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })


    // XMLTV.XML Download
    router.get('/api/xmltv.xml', (req, res) => {
      try {
        res.set('Cache-Control', 'no-store')
        res.type('text')
        let xmltvSettings = db['xmltv-settings'].find()[0]
        let f = path.resolve(xmltvSettings.file);
        res.sendFile(f)
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })

    //tool services
    router.post('/api/channel-tools/time-slots', async (req, res) => {
      try {
        let toolRes = await timeSlotsService(req.body.programs, req.body.schedule);
        if ( typeof(toolRes.userError) !=='undefined') {
          return res.status(400).send(toolRes.userError);
        }
        res.status(200).send(toolRes);
      } catch(err) {
        console.error(err);
        res.status(500).send("Internal error");
      }
    });

    // CHANNELS.M3U Download 
    router.get('/api/channels.m3u', async (req, res) => {
      try {
        res.type('text')
        let channels = await channelDB.getAllChannels();
        channels.sort((a, b) => { return a.number < b.number ? -1 : 1 })
        let tvg = `${req.protocol}://${req.get('host')}/api/xmltv.xml`
        var data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;
        for (var i = 0; i < channels.length; i++) {
          if (channels[i].stealth!==true) {
            data += `#EXTINF:0 tvg-id="${channels[i].number}" CUID="${channels[i].number}" tvg-chno="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}" group-title="dizqueTV",${channels[i].name}\n`
            data += `${req.protocol}://${req.get('host')}/video?channel=${channels[i].number}\n`
          }
        }
        if (channels.length === 0) {
            data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="https://raw.githubusercontent.com/vexorian/dizquetv/main/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`
            data += `${req.protocol}://${req.get('host')}/setup\n`
        }
        res.send(data)
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

    })

    // hls.m3u Download is not really working correctly right now
    router.get('/api/hls.m3u', async (req, res) => {
      try {
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
      } catch(err) {
        console.error(err);
        res.status(500).send("error");
      }

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
        delete channel.fillerContent;
        delete channel.filler;
        channel.fallback.forEach( cleanUpProgram );
    }


    return router
}
