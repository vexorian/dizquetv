const express = require('express')
const SSDP = require('node-ssdp').Server

module.exports = hdhr

function hdhr(db) {

    const server = new SSDP({
        location: {
            port: process.env.PORT,
            path: '/device.xml'
        },
        udn: `uuid:2020-03-S3LA-BG3LIA:2`,
        allowWildcards: true,
        ssdpSig: 'PsuedoTV/0.1 UPnP/1.0'
    })

    server.addUSN('upnp:rootdevice')
    server.addUSN('urn:schemas-upnp-org:device:MediaServer:1')

    var router = express.Router()

    router.get('/device.xml', (req, res) => {
        var device = getDevice(db)
        res.header("Content-Type", "application/xml")
        var data = device.getXml()
        res.send(data)
    })

    router.get('/discover.json', (req, res) => {
        var device = getDevice(db)
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
        var lineup = []
        var channels = db['channels'].find()
        for (let i = 0, l = channels.length; i < l; i++)
            lineup.push({ GuideNumber: channels[i].number.toString(), GuideName: channels[i].name, URL: `http://${process.env.HOST}:${process.env.PORT}/video?channel=${channels[i].number}` })
        res.send(JSON.stringify(lineup))
    })

    return { router: router, ssdp: server }
}

function getDevice(db) {
    let hdhrSettings = db['hdhr-settings'].find()[0]
    var device = {
        FriendlyName: "PseudoTV",
        Manufacturer: "PseudoTV - Silicondust",
        ManufacturerURL: "https://gitlab.org/DEFENDORe/pseudotv-plex",
        ModelNumber: "HDTC-2US",
        FirmwareName: "hdhomeruntc_atsc",
        TunerCount: hdhrSettings.tunerCount,
        FirmwareVersion: "20170930",
        DeviceID: 'PseudoTV',
        DeviceAuth: "",
        BaseURL: `http://${process.env.HOST}:${process.env.PORT}`,
        LineupURL: `http://${process.env.HOST}:${process.env.PORT}/lineup.json`
    }
    device.getXml = () => {
        str =
            `<root xmlns="urn:schemas-upnp-org:device-1-0">
      <URLBase>${device.BaseURL}</URLBase>
      <specVersion>
      <major>1</major>
      <minor>0</minor>
      </specVersion>
      <device>
      <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
      <friendlyName>PseudoTV</friendlyName>
      <manufacturer>Silicondust</manufacturer>
      <modelName>HDTC-2US</modelName>
      <modelNumber>HDTC-2US</modelNumber>
      <serialNumber/>
      <UDN>uuid:2020-03-S3LA-BG3LIA:2</UDN>
      </device>
      </root>`
        return str
    }
    return device
}