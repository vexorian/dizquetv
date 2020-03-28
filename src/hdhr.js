const Router = require('express').Router
const SSDP = require('node-ssdp').Server
const fs = require('fs')

const m3u = require('./m3u')
const config = require('config-yml')

var device = {
  FriendlyName: "PsuedoTV",
  Manufacturer: "Silicondust",
  ManufacturerURL: "https://github.com/DEFENDORe",
  ModelNumber: "HDTC-2US",
  FirmwareName: "hdhomeruntc_atsc",
  TunerCount: config.HDHR_OPTIONS.tuners,
  FirmwareVersion: "20170930",
  DeviceID: config.HDHR_OPTIONS.uuid,
  DeviceAuth: "test1234",
  BaseURL: `http://${config.HOST}:${config.PORT}`,
  LineupURL: `http://${config.HOST}:${config.PORT}/lineup.json`
}

const server = new SSDP({
  location: {
    port: config.PORT,
    path: '/device.xml'
  },
  udn: `uuid:${device.DeviceID}`,
  allowWildcards: true,
  ssdpSig: 'PPTV/3.0 UPnP/1.0'
})

function startHDHR() {
  server.addUSN('upnp:rootdevice')
  server.addUSN('urn:schemas-upnp-org:device:MediaServer:1')
  server.addUSN('urn:schemas-upnp-org:service:ContentDirectory:1')
  server.addUSN('urn:schemas-upnp-org:service:ConnectionManager:1')
  server.start()
}

function HDHRRouter() {

  const router = Router()
  router.get('/device.xml', (req, res) => {
    res.header("Content-Type", "application/xml")
    var data = `<root xmlns="urn:schemas-upnp-org:device-1-0" xmlns:dlna="urn:schemas-dlna-org:device-1-0" xmlns:pnpx="http://schemas.microsoft.com/windows/pnpx/2005/11" xmlns:df="http://schemas.microsoft.com/windows/2008/09/devicefoundation">
  <specVersion>
      <major>1</major>
      <minor>0</minor>
  </specVersion>
  <URLBase>${device.BaseURL}</URLBase>
  <device>
    <dlna:X_DLNADOC>DMS-1.50</dlna:X_DLNADOC>
    <pnpx:X_hardwareId>VEN_0115&amp;DEV_1040&amp;SUBSYS_0001&amp;REV_0004 VEN_0115&amp;DEV_1040&amp;SUBSYS_0001 VEN_0115&amp;DEV_1040</pnpx:X_hardwareId>
    <pnpx:X_deviceCategory>MediaDevices</pnpx:X_deviceCategory>
    <df:X_deviceCategory>Multimedia</df:X_deviceCategory>
    <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
    <friendlyName>${device.FriendlyName}</friendlyName>
    <presentationURL>/</presentationURL>
    <manufacturer>${device.Manufacturer}</manufacturer>
    <manufacturerURL>${device.ManufacturerURL}</manufacturerURL>
    <modelDescription>${device.FriendlyName}</modelDescription>
    <modelName>${device.FriendlyName}</modelName>
    <modelNumber>${device.ModelNumber}</modelNumber>
    <modelURL>${device.ManufacturerURL}</modelURL>
    <serialNumber></serialNumber>
    <UDN>uuid:${device.DeviceID}</UDN>
  </device>
  <serviceList>
    <service>
      <serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType>
      <serviceId>urn:upnp-org:serviceId:ConnectionManager</serviceId>
      <SCPDURL>/ConnectionManager.xml</SCPDURL>
      <controlURL>${device.BaseURL}/ConnectionManager.xml</controlURL>
      <eventSubURL>${device.BaseURL}/ConnectionManager.xml</eventSubURL>
    </service>
    <service>
      <serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType>
      <serviceId>urn:upnp-org:serviceId:ContentDirectory</serviceId>
      <SCPDURL>/ContentDirectory.xml</SCPDURL>
      <controlURL>${device.BaseURL}/ContentDirectory.xml</controlURL>
      <eventSubURL>${device.BaseURL}/ContentDirectory.xml</eventSubURL>
    </service>
  </serviceList>
</root>`
    res.send(data)
  })

  router.get('/ConnectionManager.xml', (req, res) => {
    res.header("Content-Type", "application/xml")
    var data = `
    <?xml version="1.0" encoding="utf-8" ?>
    <scpd xmlns="urn:schemas-upnp-org:service-1-0">
      <specVersion>
        <major>1</major>
        <minor>0</minor>
      </specVersion>
      <actionList>
        <action>
          <name>GetProtocolInfo</name>
          <argumentList>
            <argument>
              <name>Source</name>
              <direction>out</direction>
              <relatedStateVariable>SourceProtocolInfo</relatedStateVariable>
            </argument>
            <argument>
              <name>Sink</name>
              <direction>out</direction>
              <relatedStateVariable>SinkProtocolInfo</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
        <action>
          <name>GetCurrentConnectionIDs</name>
          <argumentList>
            <argument>
              <name>ConnectionIDs</name>
              <direction>out</direction>
              <relatedStateVariable>CurrentConnectionIDs</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
        <action>
          <name>GetCurrentConnectionInfo</name>
          <argumentList>
            <argument>
              <name>ConnectionID</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_ConnectionID</relatedStateVariable>
            </argument>
            <argument>
              <name>RcsID</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_RcsID</relatedStateVariable>
            </argument>
            <argument>
              <name>AVTransportID</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_AVTransportID</relatedStateVariable>
            </argument>
            <argument>
              <name>ProtocolInfo</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_ProtocolInfo</relatedStateVariable>
            </argument>
            <argument>
              <name>PeerConnectionManager</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_ConnectionManager</relatedStateVariable>
            </argument>
            <argument>
              <name>PeerConnectionID</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_ConnectionID</relatedStateVariable>
            </argument>
            <argument>
              <name>Direction</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_Direction</relatedStateVariable>
            </argument>
            <argument>
              <name>Status</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_ConnectionStatus</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
      </actionList>
      <serviceStateTable>
        <stateVariable sendEvents="yes">
          <name>SourceProtocolInfo</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="yes">
          <name>SinkProtocolInfo</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="yes">
          <name>CurrentConnectionIDs</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_ConnectionStatus</name>
          <dataType>string</dataType>
          <allowedValueList>
            <allowedValue>OK</allowedValue>
            <allowedValue>ContentFormatMismatch</allowedValue>
            <allowedValue>InsufficientBandwidth</allowedValue>
            <allowedValue>UnreliableChannel</allowedValue>
            <allowedValue>Unknown</allowedValue>
          </allowedValueList>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_ConnectionManager</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_Direction</name>
          <dataType>string</dataType>
          <allowedValueList>
            <allowedValue>Input</allowedValue>
            <allowedValue>Output</allowedValue>
          </allowedValueList>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_ProtocolInfo</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_ConnectionID</name>
          <dataType>i4</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_AVTransportID</name>
          <dataType>i4</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_RcsID</name>
          <dataType>i4</dataType>
        </stateVariable>
      </serviceStateTable>
    </scpd>`;
    res.send(data)
  })

  router.get('/ContentDirectory.xml', (req, res) => {
    res.header("Content-Type", "application/xml")
    var data = `
    <?xml version="1.0" encoding="utf-8"?>
    <scpd xmlns="urn:schemas-upnp-org:service-1-0">
      <specVersion>
        <major>1</major>
        <minor>0</minor>
      </specVersion>
      <actionList>
        <action>
          <name>Browse</name>
          <argumentList>
            <argument>
              <name>ObjectID</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_ObjectID</relatedStateVariable>
            </argument>
            <argument>
              <name>BrowseFlag</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_BrowseFlag</relatedStateVariable>
            </argument>
            <argument>
              <name>Filter</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_Filter</relatedStateVariable>
            </argument>
            <argument>
              <name>StartingIndex</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_Index</relatedStateVariable>
            </argument>
            <argument>
              <name>RequestedCount</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable>
            </argument>
            <argument>
              <name>SortCriteria</name>
              <direction>in</direction>
              <relatedStateVariable>A_ARG_TYPE_SortCriteria</relatedStateVariable>
            </argument>
            <argument>
              <name>Result</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_Result</relatedStateVariable>
            </argument>
            <argument>
              <name>NumberReturned</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable>
            </argument>
            <argument>
              <name>TotalMatches</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_Count</relatedStateVariable>
            </argument>
            <argument>
              <name>UpdateID</name>
              <direction>out</direction>
              <relatedStateVariable>A_ARG_TYPE_UpdateID</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
        <action>
          <name>GetSearchCapabilities</name>
          <argumentList>
            <argument>
              <name>SearchCaps</name>
              <direction>out</direction>
              <relatedStateVariable>SearchCapabilities</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
        <action>
          <name>GetSortCapabilities</name>
          <argumentList>
            <argument>
              <name>SortCaps</name>
              <direction>out</direction>
              <relatedStateVariable>SortCapabilities</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
        <action>
          <name>GetSystemUpdateID</name>
          <argumentList>
            <argument>
              <name>Id</name>
              <direction>out</direction>
              <relatedStateVariable>SystemUpdateID</relatedStateVariable>
            </argument>
          </argumentList>
        </action>
      </actionList>
      <serviceStateTable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_SortCriteria</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_UpdateID</name>
          <dataType>ui4</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_Filter</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_Result</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_Index</name>
          <dataType>ui4</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_ObjectID</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>SortCapabilities</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>SearchCapabilities</name>
          <dataType>string</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_Count</name>
          <dataType>ui4</dataType>
        </stateVariable>
        <stateVariable sendEvents="no">
          <name>A_ARG_TYPE_BrowseFlag</name>
          <dataType>string</dataType>
          <allowedValueList>
            <allowedValue>BrowseMetadata</allowedValue>
            <allowedValue>BrowseDirectChildren</allowedValue>
          </allowedValueList>
        </stateVariable>
        <stateVariable sendEvents="yes">
          <name>SystemUpdateID</name>
          <dataType>ui4</dataType>
        </stateVariable>
      </serviceStateTable>
    </scpd>`
    res.send(data)
  })

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
  return router
}

module.exports = { router: HDHRRouter, start: startHDHR }