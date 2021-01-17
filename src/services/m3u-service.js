const CacheService = require('../cache-service');
const constants = require('../constants');

/**
 * Manager and Generate M3U content
 *
 * @class M3uService
 */
class M3uService {
    constructor(dataBase) {
        this.dataBase = dataBase;
        this.cacheService = new CacheService();
        this.constants = constants;        
    }

    /**
     * Get the channel list in HLS or M3U
     *
     * @param {string} [type='m3u'] List type
     * @returns {promise} Return a Promise with HLS or M3U file content
     * @memberof M3uService
     */
    getChannelList(type = 'm3u') {
        if(type === 'hls') {
            return this.buildHLSList();
        } else {
            return this.buildM3UList();
        }
    }

    /**
     *  Build M3U with cache
     *
     * @param {boolean} [cache=true]
     * @returns {promise} M3U file content
     * @memberof M3uService
     */

    buildM3UList(cache = true) {
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

                const host = this.constants.HOST;

                const tvg = `${host}/api/xmltv.xml`;

                let data = `#EXTM3U url-tvg="${tvg}" x-tvg-url="${tvg}"\n`;

                for (var i = 0; i < channels.length; i++) {
                if (channels[i].stealth!==true) {
                    data += `#EXTINF:0 tvg-id="${channels[i].number}" CUID="${channels[i].number}" tvg-chno="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}" group-title="dizqueTV",${channels[i].name}\n`
                    data += `${host}/video?channel=${channels[i].number}\n`
                }
                }
                if (channels.length === 0) {
                    data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="${host}/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`
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

    /**
     *  
     * "hls.m3u Download is not really working correctly right now"
     *
     * @param {boolean} [cache=true]
     * @returns {promise} M3U file content
     * @memberof M3uService
     */
    buildHLSList(cache = true) {
        return new Promise(async (resolve, reject) => {

            try {

                const cacheChannels = await this.cacheService.getCache('channels-hls.m3u');

                if(cache && cacheChannels) {
                    resolve(cacheChannels);
                }

                let channels = await this.dataBase.getAllChannels();

                const host = this.constants.HOST;

                channels.sort((a, b) => { 
                    return a.number < b.number ? -1 : 1 
                });

                const tvg = `${host}/api/xmltv.xml`;

                let data = "#EXTM3U\n"
                for (var i = 0; i < channels.length; i++) {
                    data += `#EXTINF:0 tvg-id="${channels[i].number}" tvg-chno="${channels[i].number}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}" group-title="dizqueTV",${channels[i].name}\n`
                    data += `${host}/m3u8?channel=${channels[i].number}\n`
                }
                if (channels.length === 0) {
                    data += `#EXTINF:0 tvg-id="1" tvg-chno="1" tvg-name="dizqueTV" tvg-logo="${host}/resources/dizquetv.png" group-title="dizqueTV",dizqueTV\n`
                    data += `${host}/setup\n`
                }

                if(cache) {
                    await this.cacheService.setCache('channels-hls.m3u', data);
                }

                resolve(data);

            } catch (error) {
                reject(error);
            }

        });
    }

    /**
     * Clear channels.m3u file from cache folder.
     *
     * @memberof M3uService
     */
    async clearCache() {
        await this.cacheService.deleteCache('channels.m3u');
        await this.cacheService.deleteCache('channels-hls.m3u');
    }
}

module.exports = M3uService;