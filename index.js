
const db = require('diskdb')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')

const api = require('./src/api')
const dbMigration = require('./src/database-migration');
const video = require('./src/video')
const HDHR = require('./src/hdhr')

const xmltv = require('./src/xmltv')
const Plex = require('./src/plex');
const channelCache = require('./src/channel-cache');
const constants = require('./src/constants')
const ChannelDB = require("./src/dao/channel-db");

console.log(
`         \\
   dizqueTV ${constants.VERSION_NAME}
.------------.
|:::///### o |
|:::///###   |
':::///### o |
'------------'
`);


for (let i = 0, l = process.argv.length; i < l; i++) {
    if ((process.argv[i] === "-p" || process.argv[i] === "--port") && i + 1 !== l)
        process.env.PORT = process.argv[i + 1]
    if ((process.argv[i] === "-d" || process.argv[i] === "--database") && i + 1 !== l)
        process.env.DATABASE = process.argv[i + 1]
}

process.env.DATABASE = process.env.DATABASE || './.dizquetv'
process.env.PORT = process.env.PORT || 8000

if (!fs.existsSync(process.env.DATABASE)) {
    if (fs.existsSync("./.pseudotv")) {
        throw Error(process.env.DATABASE + " folder not found but ./.pseudotv has been found. Please rename this folder or create an empty " + process.env.DATABASE + " folder so that the program is not confused about.");
    }
    fs.mkdirSync(process.env.DATABASE)
}

if(!fs.existsSync(path.join(process.env.DATABASE, 'images'))) {
    fs.mkdirSync(path.join(process.env.DATABASE, 'images'))
}

if(!fs.existsSync(path.join(process.env.DATABASE, 'channels'))) {
    fs.mkdirSync(path.join(process.env.DATABASE, 'channels'))
}

channelDB = new ChannelDB( path.join(process.env.DATABASE, 'channels') );

db.connect(process.env.DATABASE, ['channels', 'plex-servers', 'ffmpeg-settings', 'plex-settings', 'xmltv-settings', 'hdhr-settings', 'db-version', 'client-id'])

initDB(db, channelDB)

let xmltvInterval = {
    interval: null,
    lastRefresh: null,
    updateXML: async () => {
        let channels = await channelDB.getAllChannels()
        channels.forEach( (channel) => {
            // if we are going to go through the trouble of loading the whole channel db, we might
            // as well take that opportunity to reduce stream loading times...
            channelCache.saveChannelConfig( channel.number, channel );
        });
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
                }).catch( (err) => {
                    console.log("Couldn't tell Plex to refresh channels for some reason.");
                });
            }
        }, (err) => {
            console.error("Failed to write the xmltv.xml file. Something went wrong. Check your output directory via the web UI and verify file permissions?", err)
        })
    },
    startInterval: () => {
        let xmltvSettings = db['xmltv-settings'].find()[0]
        if (xmltvSettings.refresh !== 0) {
            xmltvInterval.interval = setInterval( async () => {
                await xmltvInterval.updateXML()
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

let hdhr = HDHR(db, channelDB)
let app = express()
app.use(bodyParser.json({limit: '50mb'}))
app.get('/version.js', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'application/javascript'
    });

    res.write( `
        function setUIVersionNow() {
            setTimeout( setUIVersionNow, 1000);
            var element = document.getElementById("uiversion");
            if (element != null) {
                element.innerHTML = "${constants.VERSION_NAME}";
            }
        }
        setTimeout( setUIVersionNow, 1000);
    ` );
    res.end();
});
app.use('/images', express.static(path.join(process.env.DATABASE, 'images')))
app.use(express.static(path.join(__dirname, 'web/public')))
app.use('/images', express.static(path.join(process.env.DATABASE, 'images')))
app.use(api.router(db, channelDB, xmltvInterval))
app.use(video.router( channelDB, db))
app.use(hdhr.router)
app.listen(process.env.PORT, () => {
    console.log(`HTTP server running on port: http://*:${process.env.PORT}`)
    let hdhrSettings = db['hdhr-settings'].find()[0]
    if (hdhrSettings.autoDiscovery === true)
        hdhr.ssdp.start()
})

function initDB(db, channelDB) {
    dbMigration.initDB(db, channelDB);
    if (!fs.existsSync(process.env.DATABASE + '/font.ttf')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/font.ttf')))
        fs.writeFileSync(process.env.DATABASE + '/font.ttf', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/dizquetv.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/dizquetv.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/dizquetv.png', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/generic-error-screen.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/generic-error-screen.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/generic-error-screen.png', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/generic-offline-screen.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/generic-offline-screen.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/generic-offline-screen.png', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/loading-screen.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/loading-screen.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/loading-screen.png', data)
    }

}
