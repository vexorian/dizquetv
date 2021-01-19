const fs = require('fs');
const express = require('express');
const request = require('request');
const diskDb = require('diskdb');

const config = require('./config');
const CacheService = require('./cache-service');
const SettingsService = require('./services/settings-service');

/**
 * Manager a cache in disk for external images.
 *
 * @class CacheImageService
 */
class CacheImageService {
    constructor() {
        this.cacheService = CacheService;
        this.imageCacheFolder = 'images';
        const connection = diskDb.connect(config.DATABASE, ['cache-images']);
        this.db = connection['cache-images'];

        SettingsService.saveSetting('enabled-cache-image', 'Enable Cache Image', false);
    }

    /**
     * Router interceptor to download image and update cache before pass to express.static return this cached image.
     * 
     * GET /:hash - Hash is a full external URL encoded in base64.
     * eg.: http://{host}/cache/images/aHR0cHM6Ly8xO...cXVUbmFVNDZQWS1LWQ==
     *
     * @returns
     * @memberof CacheImageService
     */
    routerInterceptor() {
        const router = express.Router();
        
        router.get('/:hash', async (req, res, next) => {
            try {
                const hash = req.params.hash;
                const imgItem = this.db.find({url: hash})[0];
                if(imgItem) {
                    const file = await this.getImageFromCache(imgItem.url);
                    if(!file.length) {
                        const fileMimeType = await this.requestImageAndStore(Buffer.from(imgItem.url, 'base64').toString('ascii'), imgItem);
                        res.set('content-type', fileMimeType);
                        next();
                    } else {
                        res.set('content-type', imgItem.mimeType);
                        next();
                    }
                }
            } catch(err) {
                console.error(err);
                res.status(500).send("error");
            }
        });
        return router;
    }

    /**
     * Routers exported to use on express.use() function.
     * Use on api routers, like `{host}/api/cache/images`
     * 
     * `DELETE /` - Clear all files on .dizquetv/cache/images
     *
     * @returns {Router}
     * @memberof CacheImageService
     */
    apiRouters() {
        const router = express.Router();

        router.delete('/', async (req, res, next) => {
            try {
                await this.clearCache();
                res.status(200).send({msg: 'Cache Image are Cleared'});
            } catch (error) {
                console.error(error);
                res.status(500).send("error");
            }
        });

        return router;
    }

    /**
     *
     *
     * @param {*} url External URL to get file/image
     * @param {*} dbFile register of file from db
     * @returns {promise} `Resolve` when can download imagem and store on cache folder, `Reject` when file are inaccessible over network or can't write on directory
     * @memberof CacheImageService
     */
    async requestImageAndStore(url, dbFile) {
        return new Promise( async(resolve, reject) => {
            const requestConfiguration = {
                method: 'get',
                url
            };

            request(requestConfiguration, (err, res) => {
                if (err) {
                    reject(err);
                } else {
                    const mimeType = res.headers['content-type'];
                    this.db.update({_id: dbFile._id}, {url: dbFile.url, mimeType});
                    request(requestConfiguration)
                    .pipe(fs.createWriteStream(`${this.cacheService.cachePath}/${this.imageCacheFolder}/${dbFile.url}`))
                    .on('close', () =>{
                        resolve(mimeType);
                    });
                }
            });

        });
    }

    /**
     * Get image from cache using an filename
     *
     * @param {*} fileName
     * @returns {promise} `Resolve` with file content
     * @memberof CacheImageService
     */
    getImageFromCache(fileName) {
        return new Promise(async(resolve, reject) => {
            try {
                const file = await this.cacheService.getCache(`${this.imageCacheFolder}/${fileName}`);
                resolve(file);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Clear all files on .dizquetv/cache/images
     *
     * @returns {promise}
     * @memberof CacheImageService
     */
    async clearCache() {
        return new Promise( async(resolve, reject) => {
            const cachePath = `${this.cacheService.cachePath}/${this.imageCacheFolder}`;
            fs.rmdir(cachePath, { recursive: true }, (err) => {
                if(err) {
                    reject();
                }
                fs.mkdirSync(cachePath);
                resolve();
            });
        });
    }

    registerImageOnDatabase(imageUrl) {
        const url = Buffer.from(imageUrl).toString('base64');
        const dbQuery = {url};
        if(!this.db.find(dbQuery)[0]) {
            this.db.save(dbQuery);
        }
        return url;
    }
}

module.exports = new CacheImageService();