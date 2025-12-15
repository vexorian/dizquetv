const events = require('events')

const FILLER_UPDATE = 30 * 60 * 1000; //30 minutes might be too aggressive
//this will be configurable one day.

class FillerService extends events.EventEmitter {

    constructor(fillerDB, plexProxyService, channelService) {
        super();
        this.fillerDB = fillerDB;
        this.plexProxyService = plexProxyService;
        this.channelService = channelService;
    }

    async saveFiller(id, body) {
        body = await this.prework(body);
        return this.fillerDB.saveFiller(id, body);
    }

    async createFiller(body) {
        body = await this.prework(body);
        return this.fillerDB.createFiller(body);
    }

    async getFillerChannels(id) {
        let numbers = await this.channelService.getAllChannelNumbers();
        let channels = [];
        await Promise.all( numbers.map( async(number) => {
            let ch = await this.channelService.getChannel(number);
            let name = ch.name;
            let fillerCollections = ch.fillerCollections;
            for (let i = 0 ; i < fillerCollections.length; i++) {
                if (fillerCollections[i].id === id) {
                    channels.push( {
                        number: number,
                        name : name,
                    } );
                    break;
                }
            }
            ch = null;

        } ) );
        return channels;
    }

    async deleteFiller(id) {
        try {
            let channels = await this.getFillerChannels(id);
            await Promise.all( channels.map( async(channel) => {
                console.log(`Updating channel ${channel.number} , remove filler: ${id}`);
                let json = await channelService.getChannel(channel.number);
                json.fillerCollections = json.fillerCollections.filter( (col) => {
                    return col.id != id;
                } );
                await this.channelService.saveChannel( channel.number, json );
            } ) );
        } finally {
            await this.fillerDB.deleteFiller(id);
        }
    }

    async prework(body) {
        if (body.mode === "import") {
            body.content = await this.getContents(body);
            body.import.lastRefreshTime = new Date().getTime();
        } else {
            delete body.import;
        }
        return body;
    }

    async getContents(body) {
        let serverKey = body.import.serverName;
        let key = body.import.key;
        let content = await this.plexProxyService.getKeyMediaContents(serverKey, key);
        console.log(JSON.stringify(content));
        return content;
    }

    async getFillersFromChannel(channel) {

        let loadChannelFiller = async(fillerEntry) => {
            let content = [];
            try {
                let filler = await this.fillerDB.getFiller(fillerEntry.id);
                await this.fillerUsageWatcher(fillerEntry.id, filler);
                content = filler.content;
            } catch(e) {
                console.error(`Channel #${channel.number} - ${channel.name} references an unattainable filler id: ${fillerEntry.id}`, e);
            }
            return {
                id: fillerEntry.id,
                content: content,
                weight: fillerEntry.weight,
                cooldown: fillerEntry.cooldown,
            }
        };
        return await Promise.all(
            channel.fillerCollections.map(loadChannelFiller)
        );
    }

    async fillerUsageWatcher(id, filler) {
        if (filler.mode === "import") {
            //I need to upgrade nodejs version ASAP
            let lastTime = 0;
            if (
                (typeof(filler.import) !== "undefined")
                &&
                !isNaN(filler.import.lastRefreshTime)
            ) {
                lastTime = filler.import.lastRefreshTime;
            }
            let t = new Date().getTime();
            if ( t - lastTime >= FILLER_UPDATE) {
                //time to do an update.
                if (  (typeof(filler.content) === "undefined")
                    || (filler.content.length == 0)
                ) {
                    //It should probably be an sync update...
                    await this.refreshFiller(id);
                } else {
                    this.refreshFiller(id);
                }
            }
        }
    }

    async refreshFiller(id) {
        let t0 = new Date().getTime();
        console.log(`Refreshing filler with id=${id}`);
        try {
            let filler = await this.fillerDB.getFiller(id);
            await this.saveFiller(id, filler);
        } catch (err) {
            console.log(`Unable to update filler: ${id}`, err);
        } finally {
            let t1 = new Date().getTime();
            console.log(`Refreshed filler with id=${id} in ${t1-t0}ms`);
        }
    }


}




module.exports = FillerService