
const db = require('diskdb')
const fs = require('fs')
const unzip = require('unzipper')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload');
const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware/cjs');
const i18nextBackend = require('i18next-fs-backend/cjs');

const api = require('./src/api')
const dbMigration = require('./src/database-migration');
const video = require('./src/video')
const HDHR = require('./src/hdhr')
const FileCacheService = require('./src/services/file-cache-service');
const CacheImageService = require('./src/services/cache-image-service');
const ChannelService = require("./src/services/channel-service");

const xmltv = require('./src/xmltv')
const Plex = require('./src/plex');
const constants = require('./src/constants')
const ChannelDB = require("./src/dao/channel-db");
const M3uService = require("./src/services/m3u-service");
const FillerDB = require("./src/dao/filler-db");
const CustomShowDB = require("./src/dao/custom-show-db");
const TVGuideService = require("./src/services/tv-guide-service");
const EventService = require("./src/services/event-service");
const OnDemandService = require("./src/services/on-demand-service");
const ProgrammingService = require("./src/services/programming-service");
const ActiveChannelService = require('./src/services/active-channel-service')
const ProgramPlayTimeDB = require('./src/dao/program-play-time-db')

const onShutdown = require("node-graceful-shutdown").onShutdown;

console.log(
`         \\
   dizqueTV ${constants.VERSION_NAME}
.------------.
|:::///### o |
|:::///###   |
':::///### o |
'------------'
`);

const NODE = parseInt( process.version.match(/^[^0-9]*(\d+)\..*$/)[1] );

if (NODE < 12) {
    console.error(`WARNING: Your nodejs version ${process.version} is lower than supported. dizqueTV has been tested best on nodejs 12.16.`);
}


for (let i = 0, l = process.argv.length; i < l; i++) {
    if ((process.argv[i] === "-p" || process.argv[i] === "--port") && i + 1 !== l)
        process.env.PORT = process.argv[i + 1]
    if ((process.argv[i] === "-d" || process.argv[i] === "--database") && i + 1 !== l)
        process.env.DATABASE = process.argv[i + 1]
}

process.env.DATABASE = process.env.DATABASE ||  path.join(".", ".dizquetv")
process.env.PORT = process.env.PORT || 8000

if (!fs.existsSync(process.env.DATABASE)) {
    if (fs.existsSync(  path.join(".", ".pseudotv")  )) {
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
if(!fs.existsSync(path.join(process.env.DATABASE, 'filler'))) {
    fs.mkdirSync(path.join(process.env.DATABASE, 'filler'))
}
if(!fs.existsSync(path.join(process.env.DATABASE, 'custom-shows'))) {
    fs.mkdirSync(path.join(process.env.DATABASE, 'custom-shows'))
}
if(!fs.existsSync(path.join(process.env.DATABASE, 'cache'))) {
    fs.mkdirSync(path.join(process.env.DATABASE, 'cache'))
}
if(!fs.existsSync(path.join(process.env.DATABASE, 'cache','images'))) {
    fs.mkdirSync(path.join(process.env.DATABASE, 'cache','images'))
}


channelDB = new ChannelDB( path.join(process.env.DATABASE, 'channels') );

db.connect(process.env.DATABASE, ['channels', 'plex-servers', 'ffmpeg-settings', 'plex-settings', 'xmltv-settings', 'hdhr-settings', 'db-version', 'client-id', 'cache-images', 'settings'])

let fontAwesome = "fontawesome-free-5.15.4-web";
let bootstrap = "bootstrap-4.4.1-dist";
initDB(db, channelDB)

channelService = new ChannelService(channelDB);

fillerDB = new FillerDB( path.join(process.env.DATABASE, 'filler') , channelService );
customShowDB = new CustomShowDB( path.join(process.env.DATABASE, 'custom-shows') );
let programPlayTimeDB = new ProgramPlayTimeDB( path.join(process.env.DATABASE, 'play-cache') );

async function initializeProgramPlayTimeDB() {
    try {
        let t0 = new Date().getTime();
        await programPlayTimeDB.load();
        let t1 = new Date().getTime();
        console.log(`Program Play Time Cache loaded in ${t1-t0} milliseconds.`);
    } catch (err) {
        console.log(err);
    }
}
initializeProgramPlayTimeDB();

fileCache = new FileCacheService( path.join(process.env.DATABASE, 'cache') );
cacheImageService = new CacheImageService(db, fileCache);
m3uService = new M3uService(fileCache, channelService)

onDemandService = new OnDemandService(channelService);
programmingService = new ProgrammingService(onDemandService);
activeChannelService = new ActiveChannelService(onDemandService, channelService);

eventService = new EventService();

i18next
    .use(i18nextBackend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
        // debug: true,
        initImmediate: false,
        backend: {
            loadPath: path.join(__dirname, '/locales/server/{{lng}}.json'),
            addPath: path.join(__dirname, '/locales/server/{{lng}}.json')
        },
        lng: 'en',
        fallbackLng: 'en',
        preload: ['en'],
    });


const guideService = new TVGuideService(xmltv, db, cacheImageService, null, i18next);


let xmltvInterval = {
    interval: null,
    lastRefresh: null,
    updateXML: async () => {

        let channels = [];

        try {
            channels = await channelService.getAllChannels();
            let xmltvSettings = db['xmltv-settings'].find()[0];
            let t = guideService.prepareRefresh(channels, xmltvSettings.cache*60*60*1000);
            channels = null;

            guideService.refresh(t);
        } catch (err) {
            console.error("Unable to update TV guide?", err);
            return;
        }
    },

    notifyPlex: async() => {
        xmltvInterval.lastRefresh = new Date()
        console.log('XMLTV Updated at ', xmltvInterval.lastRefresh.toLocaleString());

        channels = await channelService.getAllChannels();

        let plexServers = db['plex-servers'].find()
        for (let i = 0, l = plexServers.length; i < l; i++) {       // Foreach plex server
            let plex = new Plex(plexServers[i])
            let dvrs;
            if ( !plexServers[i].arGuide && !plexServers[i].arChannels) {
                continue;
            }
            try {
                dvrs = await plex.GetDVRS() // Refresh guide and channel mappings
            } catch(err) {
                console.error(`Couldn't get DVRS list from ${plexServers[i].name}. This error will prevent 'refresh guide' or 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.` , err );
                continue;
            }
            if (plexServers[i].arGuide) {
                try {
                    await plex.RefreshGuide(dvrs);
                } catch(err) {
                    console.error(`Couldn't tell Plex ${plexServers[i].name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.` , err);
                }
            }
            if (plexServers[i].arChannels && channels.length !== 0) {
                try {
                    await plex.RefreshChannels(channels, dvrs);
                } catch(err) {
                    console.error(`Couldn't tell Plex ${plexServers[i].name} to refresh channels for some reason. This error will prevent 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.` , err);
                }
            }
        }
    },

    startInterval: () => {
        let xmltvSettings = db['xmltv-settings'].find()[0]
        if (xmltvSettings.refresh !== 0) {
            xmltvInterval.interval = setInterval( async () => {
                try {
                    await xmltvInterval.updateXML()
                } catch(err) {
                    console.error("update XMLTV error", err);
                }
            }, xmltvSettings.refresh * 60 * 60 * 1000)
        }
    },
    restartInterval: () => {
        if (xmltvInterval.interval !== null)
            clearInterval(xmltvInterval.interval)
        xmltvInterval.startInterval()
    }
}

guideService.on("xmltv-updated", (data) => {
    try {
        xmltvInterval.notifyPlex();
    } catch (err) {
        console.error("Unexpected issue when reacting to xmltv update", err);
    }
} );

xmltvInterval.updateXML()
xmltvInterval.startInterval()


//setup xmltv update
channelService.on("channel-update", (data) => {
    try {
        console.log("Updating TV Guide due to channel update...");
        //TODO: this could be smarter, like avoid updating 3 times if the channel was saved three times in a short time interval...
        xmltvInterval.updateXML()
        xmltvInterval.restartInterval()
    } catch (err) {
        console.error("Unexpected error issuing TV Guide udpate", err);
    }
} );


let hdhr = HDHR(db, channelDB)
let app = express()
eventService.setup(app);

app.use(
    i18nextMiddleware.handle(i18next, {})
);

app.use(fileUpload({
    createParentPath: true
}));
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
app.use(express.static(path.join(__dirname, 'web','public')))
app.use('/images', express.static(path.join(process.env.DATABASE, 'images')))
app.use('/cache/images', cacheImageService.routerInterceptor())
app.use('/cache/images', express.static(path.join(process.env.DATABASE, 'cache','images')))
app.use('/favicon.svg', express.static(
    path.join(__dirname, 'resources','favicon.svg')
) );
app.use('/custom.css', express.static(path.join(process.env.DATABASE, 'custom.css')))

// API Routers
app.use(api.router(db, channelService, fillerDB, customShowDB, xmltvInterval, guideService, m3uService, eventService ))
app.use('/api/cache/images', cacheImageService.apiRouters())
app.use('/' + fontAwesome, express.static(path.join(process.env.DATABASE, fontAwesome)))
app.use('/' + bootstrap, express.static(path.join(process.env.DATABASE, bootstrap)))

app.use(video.router( channelService, fillerDB, db, programmingService, activeChannelService, programPlayTimeDB  ))
app.use(hdhr.router)
app.listen(process.env.PORT, () => {
    console.log(`HTTP server running on port: http://*:${process.env.PORT}`)
    let hdhrSettings = db['hdhr-settings'].find()[0]
    if (hdhrSettings.autoDiscovery === true)
        hdhr.ssdp.start()
})

function initDB(db, channelDB) {
    //TODO: this is getting so repetitive, do it better
    if (!fs.existsSync(process.env.DATABASE + '/images/dizquetv.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/dizquetv.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/dizquetv.png', data)
    }
    dbMigration.initDB(db, channelDB, __dirname);
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
    if (!fs.existsSync(process.env.DATABASE + '/images/generic-music-screen.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/generic-music-screen.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/generic-music-screen.png', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/loading-screen.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/loading-screen.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/loading-screen.png', data)
    }
    if (!fs.existsSync(process.env.DATABASE + '/images/black.png')) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources/black.png')))
        fs.writeFileSync(process.env.DATABASE + '/images/black.png', data)
    }
    if (!fs.existsSync( path.join(process.env.DATABASE, 'custom.css') )) {
        let data = fs.readFileSync(path.resolve(path.join(__dirname, 'resources', 'default-custom.css')))
        fs.writeFileSync( path.join(process.env.DATABASE, 'custom.css'), data)
    }
    if (!fs.existsSync( path.join(process.env.DATABASE, fontAwesome) )) {

        let sourceZip = path.resolve(__dirname, 'resources', fontAwesome) + ".zip";
        let destinationPath = path.resolve(process.env.DATABASE);

        fs.createReadStream(sourceZip)
            .pipe(unzip.Extract({ path: destinationPath }));

    }
    if (!fs.existsSync( path.join(process.env.DATABASE, bootstrap) )) {

        let sourceZip = path.resolve(__dirname, 'resources', bootstrap) + ".zip";
        let destinationPath = path.resolve(process.env.DATABASE);

        fs.createReadStream(sourceZip)
            .pipe(unzip.Extract({ path: destinationPath }));

    }
}


function _wait(t) {
    return new Promise((resolve) => {
      setTimeout(resolve, t);
    });
}


async function sendEventAfterTime() {
    let t = (new Date()).getTime();
    await _wait(20000);
    eventService.push(
        "lifecycle",
        {
            "message": i18next.t("event.server_started"),
            "detail" : {
                "time": t,
            },
            "level" : "success"
        }
    );
    
}
sendEventAfterTime();




onShutdown("log" , [],  async() => {
    let t = (new Date()).getTime();
    eventService.push(
        "lifecycle",
        {
            "message": i18next.t("event.server_shutdown"),
            "detail" : {
                "time": t,
            },
            "level" : "warning"
        }
    );

    console.log("Received exit signal, attempting graceful shutdonw...");
    await _wait(2000);
});
onShutdown("xmltv-writer" , [],  async() => {
    await xmltv.shutdown();
} );
onShutdown("active-channels", [], async() => {
    await activeChannelService.shutdown();
} );

onShutdown("video", [], async() => {
    await video.shutdown();
} );
