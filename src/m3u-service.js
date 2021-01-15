const CacheService = require('./cache-service');

class M3uService {
    constructor(dataBase) {
        this.dataBase = dataBase;
        this.cacheService = new CacheService();
    }

    /**
     * Get the channel list in HLS or M3U
     *
     * @param {string} [type='m3u'] List type
     * @param {*} host Host of Server
     * @returns {promise} Return a Promise with HLS or M3U file content
     * @memberof M3uService
     */
    getChannelList(type = 'm3u', host) {
        if(type === 'hls') {

        } else {
            return this.buildM3UList(host);
        }
    }

    /**
     *  Build M3U with cache
     *
     * @param {*} host Full URL of server
     * @param {boolean} [cache=true]
     * @returns {promise} M3U file content
     * @memberof M3uService
     */

    buildM3UList(host, cache = true) {
        return new Promise(async (resolve, reject) => {

            try {

                const cacheChannels = await this.cacheService.getCache('channels.m3u');

                if(cache && cacheChannels) {
                    resolve(cacheChannels);
                }

                let channels = await this.dataBase.getAllChannels();

                channels.sort((a, b) => { 
                    return a.number < b.number ? -1 : 1 
                });

                const tvg = `${host}/api/xmltv.xml`;

                let data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;

                for (var i = 0; i < channels.length; i++) {
                if (channels[i].stealth!==true) {
                    data += `#EXTINF:0 tvg-id="${channels[i].number}" CUID="${channels[i].number}" tvg-chno="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}" group-title="dizqueTV",${channels[i].name}\n`
                    data += `${host}/video?channel=${channels[i].number}\n`
                }
                }
                if (channels.length === 0) {
                    data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="https://raw.githubusercontent.com/vexorian/dizquetv/main/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`
                    data += `${host}/setup\n`
                }

                if(cache) {
                    await this.cacheService.setCache('channels.m3u', data);
                }

                resolve(data);

            } catch (error) {
                reject(error);
            }

        });
    }

    async clearCache() {
        try {
            await this.cacheService.deleteCache('channels.m3u');
        } catch (error) {
            console.log("File not exist",error);
        }
    }
}

module.exports = M3uService;