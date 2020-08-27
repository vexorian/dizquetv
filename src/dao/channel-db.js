const path = require('path');
var fs = require('fs');
 
class ChannelDB {

    constructor(folder) {
        this.folder = folder;
    }

    async getChannel(number) {
        let f = path.join(this.folder, `${number}.json` );
        try {
            return await new Promise( (resolve, reject) => {
                fs.readFile(f, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    try {
                        resolve( JSON.parse(data) )
                    } catch (err) {
                        reject(err);
                    }
                })
            });
        } catch (err) {
            console.error(err);
            return null;
        }
    }
    
    async saveChannel(number, json) {
        if (typeof(number) === 'undefined') {
            throw Error("Mising channel number");
        }
        let f = path.join(this.folder, `${number}.json` );
        return await new Promise( (resolve, reject) => {
            let data = undefined;
            try {
                data = JSON.stringify(json);
            } catch (err) {
                return reject(err);
            }
            fs.writeFile(f, data, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    saveChannelSync(number, json) {
        json.number = number;
        let data = JSON.stringify(json);
        let f = path.join(this.folder, `${number}.json` );
        fs.writeFileSync( f, data );
    }

    async deleteChannel(number) {
        let f = path.join(this.folder, `${number}.json` );
        await new Promise( (resolve, reject) => {
            fs.unlink(f, function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    
    async getAllChannelNumbers() {
        return await new Promise( (resolve, reject) => {
            fs.readdir(this.folder, function(err, items) {
                if (err) {
                    return reject(err);
                }
                let channelNumbers = [];
                for (let i = 0; i < items.length; i++) {
                    let name = path.basename( items[i] );
                    if (path.extname(name) === '.json') {
                        let numberStr = name.slice(0, -5);
                        if (!isNaN(numberStr)) {
                            channelNumbers.push( parseInt(numberStr) );
                        }
                    }
                }
                resolve (channelNumbers);
            });
        });
    }
    
    async getAllChannels() {
        let numbers = await this.getAllChannelNumbers();
        return await Promise.all( numbers.map( async (c) => this.getChannel(c) ) );
    }
    
}










module.exports = ChannelDB;