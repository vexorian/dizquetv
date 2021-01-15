const path = require('path');
const fs = require('fs');

class CacheService {
    constructor() {
        this.cachePath = path.join(process.env.DATABASE, 'cache');
    }

    setCache(fullFilePath, data) {
        return new Promise((resolve, reject) => {
            try {
                const file = fs.createWriteStream(path.join(this.cachePath, fullFilePath));
                file.write(data, (err) => {
                    if(err) {
                        throw Error("Can't save file: ", err);
                    } else {
                        resolve(true);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    getCache(fullFilePath) {
        return new Promise((resolve, reject) => {
            try {
                fs.readFile(path.join(this.cachePath, fullFilePath), 'utf8', function (err,data) {
                    if (err) {
                      resolve(false);
                    }
                    resolve(data);
                });
            } catch (error) {
                resolve(false);
                throw Error("Can't get file", error)
            }
        });
    }

    deleteCache(fullFilePath) {
        return new Promise((resolve, reject) => {
            try {
                fs.unlinkSync(path.join(this.cachePath, fullFilePath), (err) => {
                    if(err) {
                        throw Error("Can't save file: ", err);
                    } else {
                        resolve(true);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = CacheService;