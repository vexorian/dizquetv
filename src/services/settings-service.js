const diskDb = require('diskdb');
const express = require('express');
const config = require('../config');

class SettingsService {
    constructor() {
        const connection = diskDb.connect(config.DATABASE, ['settings']);
        this.db = connection['settings'];
    }

    apiRouters() {
        const router = express.Router();

        router.get('/', async (req, res) => {
            try {
                const settings = await this.getAllSettings();
                res.send(settings);
            } catch (error) {
                console.error(error);
                res.status(500).send("error");
            }
        });
        
        router.post('/', async (req, res) => {
            try {
                const {key, title, value} = req.body;
                if(!key || !title || value === undefined) {
                    throw Error("Key, title and value are Required");
                }

                const settings = await this.saveSetting(key, title, value);
                res.send(settings);
            } catch (error) {
                console.error(error);
                res.status(500).send("error");
            }
        });

        router.put('/:key', async (req, res) => {
            try {
                const key = req.params.key;
                const {value} = req.body;
                console.log(key, value);
                if(!key || value === undefined) {
                    throw Error("Key and value are Required");
                }
                const settings = await this.updateSetting(key, value);
                console.log(settings);
                res.send(settings);
            } catch (error) {
                console.error(error);
                res.status(500).send("error");
            }
        });

        return router;
    }

    getSetting(key) {
        return new Promise((resolve, reject) =>{
            try {
                const setting = this.db.find({key})[0];
                resolve(setting);
            } catch (error) {
                reject(error);
            }
        });
    }

    getAllSettings() {
        return new Promise((resolve, reject) =>{
            try {
                const settings = this.db.find();
                resolve(settings);
            } catch (error) {
                reject(error);
            }
        });
    }
    saveSetting(key, title, value) {
        return new Promise((resolve, reject) =>{
            try {
                const setting = this.db.find({key})[0];
                if(!setting) {
                    this.db.save({key, title, value});
                }
                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    }
    updateSetting(key, value) {
        return new Promise((resolve, reject) => {
            try {
                const setting = this.db.find({key})[0];
                if(setting) {
                    const query = this.db.update({_id: setting._id}, {key, value});
                    if(query.updated > 0) {
                        const settings = this.db.find();
                        resolve(settings);
                    }
                    reject();
                } else {
                    reject({error: true, msg: "Setting not found!"});
                }
            } catch (error) {
                
            }
        });
    }
}

module.exports = new SettingsService();