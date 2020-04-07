const express = require('express')
const SSDP = require('node-ssdp').Server
const config = require('config-yml')
const m3u = require('../m3u')

function hdhr() {
    var device = require('./device')()

    const server = new SSDP({
        location: {
          port: config.PORT,
          path: '/device.xml'
        },
        udn: `uuid:${device.deviceID}`,
        allowWildcards: true,
        ssdpSig: 'PsuedoTV/0.1 UPnP/1.0'
    })
    server.addUSN('upnp:rootdevice')
    server.addUSN('urn:schemas-upnp-org:device:MediaServer:1')
    server.addUSN('urn:schemas-upnp-org:service:ContentDirectory:1')
    server.addUSN('urn:schemas-upnp-org:service:ConnectionManager:1')

    var router = express.Router()

    router.get('/device.xml', (req, res) => {
        res.header("Content-Type", "application/xml")
        var data = device.getXml()
        res.send(data)
    })

    router.use(express.static('./static'))

    router.get('/discover.json', (req, res) => {
        res.header("Content-Type", "application/json")
        res.send(JSON.stringify(device))
    })

    router.get('/lineup_status.json', (req, res) => {
        res.header("Content-Type", "application/json")
        var data = {
            ScanInProgress: 0,
            ScanPossible: 1,
            Source: "Cable",
            SourceList: ["Cable"],
        }
        res.send(JSON.stringify(data))
    })
    router.get('/lineup.json', (req, res) => {
        res.header("Content-Type", "application/json")
        var data = m3u.ReadChannels()
        res.send(JSON.stringify(data))
    })

    return { router: router, ssdp: server }
}

module.exports = hdhr