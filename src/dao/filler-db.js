const path = require('path');
const { v4: uuidv4 } = require('uuid');
let fs = require('fs');
 
class FillerDB {

    constructor(folder) {
        this.folder = folder;
        this.cache = {};
    }

    async $loadFiller(id) {
        let f = path.join(this.folder, `${id}.json` );
        try {
            return await new Promise( (resolve, reject) => {
                fs.readFile(f, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    try {
                        let j = JSON.parse(data);
                        j.id = id;
                        resolve(j);
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

    async getFiller(id) {
        if (typeof(this.cache[id]) === 'undefined') {
            this.cache[id] = await this.$loadFiller(id);
        }
        return this.cache[id];
    }

    async saveFiller(id, json) {
        if (typeof(id) === 'undefined') {
            throw Error("Mising filler id");
        }
        let f = path.join(this.folder, `${id}.json` );
        try {
            await new Promise( (resolve, reject) => {
                let data = undefined;
                try {
                    //id is determined by the file name, not the contents
                    fixup(json);
                    delete json.id;
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
        } finally {
            delete this.cache[id];
        }
    }

    async createFiller(json) {
        let id = uuidv4();
        fixup(json);
        await this.saveFiller(id, json);
        return id;
    }

    async deleteFiller(id) {
        try {
            let f = path.join(this.folder, `${id}.json` );
            await new Promise( (resolve, reject) => {
                fs.unlink(f, function (err) {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                });
            });
        } finally {
            delete this.cache[id];
        }
    }

    
    async getAllFillerIds() {
        return await new Promise( (resolve, reject) => {
            fs.readdir(this.folder, function(err, items) {
                if (err) {
                    return reject(err);
                }
                let fillerIds = [];
                for (let i = 0; i < items.length; i++) {
                    let name = path.basename( items[i] );
                    if (path.extname(name) === '.json') {
                        let id = name.slice(0, -5);
                        fillerIds.push(id);
                    }
                }
                resolve (fillerIds);
            });
        });
    }
    
    async getAllFillers() {
        let ids = await this.getAllFillerIds();
        return await Promise.all( ids.map( async (c) => this.getFiller(c) ) );
    }

    async getAllFillersInfo() {
        //returns just name and id
        let fillers = await this.getAllFillers();
        return fillers.map( (f) =>  {
            return {
                'id'  : f.id,
                'name': f.name,
                'count': f.content.length,
            }
        } );
    }



}

function fixup(json) {
    if (typeof(json.content) === 'undefined') {
        json.content = [];
    }
    if (typeof(json.name) === 'undefined') {
        json.name = "Unnamed Filler";
    }
}

module.exports = FillerDB;