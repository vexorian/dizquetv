const Plex = require('../plex.js')
const events = require('events')

class PlexProxyService extends events.EventEmitter {

    constructor(plexServerDB) {
        super();
        this.plexServerDB = plexServerDB;
    }

    async get(serverName64, path) {
        let plexServer = await getPlexServer(this.plexServerDB, serverName64);
        let client = new Plex(plexServer);
        return { MediaContainer: await client.Get("/" + path) };
    }
}



async function getPlexServer(plexServerDB, serverName64) {
    let serverKey = Buffer.from(serverName64, 'base64').toString('utf-8');
    let server = await plexServerDB.getPlexServerByName(serverKey);
    if (server == null) {
        throw Error("server not found");
    }
    return server;

}

module.exports = PlexProxyService