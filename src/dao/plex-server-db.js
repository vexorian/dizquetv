
//hmnn this is more of a "PlexServerService"...
class PlexServerDB
{
    constructor(channelDB, channelCache, db) {
        this.channelDB = channelDB;
        this.db = db;
        this.channelCache = channelCache;
    }

    async deleteServer(name) {
        let channelNumbers = await this.channelDB.getAllChannelNumbers();
        let report = await Promise.all( channelNumbers.map( async (i) => {
            let channel = await this.channelDB.getChannel(i);
            let channelReport = {
                channelNumber : channel.number,
                channelName : channel.name,
                destroyedPrograms: 0,
            };
            this.fixupProgramArray(channel.programs, name, channelReport);
            this.fixupProgramArray(channel.fillerContent, name, channelReport);
            this.fixupProgramArray(channel.fallback, name, channelReport);
            if (typeof(channel.fillerContent) !== 'undefined') {
                channel.fillerContent = channel.fillerContent.filter(
                    (p) => {
                        return (true !== p.isOffline);
                    }
                );
            }
            if (
                (typeof(channel.fallback) !=='undefined')
                && (channel.fallback.length > 0)
                && (channel.fallback[0].isOffline)
            ) {
                channel.fallback = [];
                if (channel.offlineMode != "pic") {
                    channel.offlineMode = "pic";
                    channel.offlinePicture = `http://localhost:${process.env.PORT}/images/generic-offline-screen.png`;
                }
            }
            this.fixupProgramArray(channel.fallback, name, channelReport);
            await this.channelDB.saveChannel(i, channel);
            this.db['plex-servers'].remove( { name: name } );
            return channelReport;
        }) );
        this.channelCache.clear();
        return report;
    }

    doesNameExist(name) {
        return this.db['plex-servers'].find( { name: name} ).length > 0;
    }

    async updateServer(server) {
        let name = server.name;
        if (typeof(name) === 'undefined') {
            throw Error("Missing server name from request");
        }
        let s = this.db['plex-servers'].find( { name: name} );
        if (s.length != 1) {
            throw Error("Server doesn't exist.");
        }
        s = s[0];
        let arGuide = server.arGuide;
        if (typeof(arGuide) === 'undefined') {
            arGuide = true;
        }
        let arChannels = server.arGuide;
        if (typeof(arChannels) === 'undefined') {
            arChannels = false;
        }
        let newServer = {
            name: s.name,
            uri: server.uri,
            accessToken: server.accessToken,
            arGuide: arGuide,
            arChannels: arChannels,
            index: s.index,
        }

        this.db['plex-servers'].update(
            { _id: s._id  },
            newServer
        );


    }

    async addServer(server) {
        let name = server.name;
        if (typeof(name) === 'undefined') {
            name = "plex";
        }
        let i = 2;
        let prefix = name;
        let resultName = name;
        while (this.doesNameExist(resultName)) {
            resultName = `${prefix}${i}` ;
            i += 1;
        }
        name = resultName;
        let arGuide = server.arGuide;
        if (typeof(arGuide) === 'undefined') {
            arGuide = true;
        }
        let arChannels = server.arGuide;
        if (typeof(arChannels) === 'undefined') {
            arChannels = false;
        }
        let index = this.db['plex-servers'].find({}).length;

        let newServer = {
            name: name,
            uri: server.uri,
            accessToken: server.accessToken,
            arGuide: arGuide,
            arChannels: arChannels,
            index: index,
        };
        this.db['plex-servers'].save(newServer);
    }

    fixupProgramArray(arr, serverName, channelReport) {
        if (typeof(arr) !== 'undefined') {
            for(let i = 0; i < arr.length; i++) {
                arr[i] = this.fixupProgram( arr[i], serverName, channelReport );
            }
        }
    }
    fixupProgram(program, serverName, channelReport) {
        if (program.serverKey === serverName) {
            channelReport.destroyedPrograms += 1;
            return {
                isOffline: true,
                duration: program.duration,
            }
        }
        return program;
    }
}

module.exports = PlexServerDB