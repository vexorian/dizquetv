var config = require('config-yml')

function device() {
	var device = {
		friendlyName: "PseudoTV",
		manufacturer: "Silicondust",
		manufacturerURL: "https://github.com/DEFENDORe/pseudotv-plex",
		modelNumber: "HDTC-2US",
		firmwareName: "hdhomeruntc_atsc",
		tunerCount: 1,
		firmwareVersion: "20170930",
		deviceID: 'PseudoTV',
		deviceAuth: "",
		baseURL: `http://${config.HOST}:${config.PORT}`,
		lineupURL: `http://${config.HOST}:${config.PORT}/lineup.json`
	}
	device.getXml = () => {
		return `<root xmlns="urn:schemas-upnp-org:device-1-0" xmlns:dlna="urn:schemas-dlna-org:device-1-0" xmlns:pnpx="http://schemas.microsoft.com/windows/pnpx/2005/11" xmlns:df="http://schemas.microsoft.com/windows/2008/09/devicefoundation">
      <specVersion>
          <major>1</major>
          <minor>0</minor>
      </specVersion>
      <URLBase>${device.baseURL}</URLBase>
      <device>
        <dlna:X_DLNADOC>DMS-1.50</dlna:X_DLNADOC>
        <pnpx:X_hardwareId>VEN_0115&amp;DEV_1040&amp;SUBSYS_0001&amp;REV_0004 VEN_0115&amp;DEV_1040&amp;SUBSYS_0001 VEN_0115&amp;DEV_1040</pnpx:X_hardwareId>
        <pnpx:X_deviceCategory>MediaDevices</pnpx:X_deviceCategory>
        <df:X_deviceCategory>Multimedia</df:X_deviceCategory>
        <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
        <friendlyName>${device.friendlyName}</friendlyName>
        <presentationURL>/</presentationURL>
        <manufacturer>${device.manufacturer}</manufacturer>
        <manufacturerURL>${device.manufacturerURL}</manufacturerURL>
        <modelDescription>${device.friendlyName}</modelDescription>
        <modelName>${device.friendlyName}</modelName>
        <modelNumber>${device.modelNumber}</modelNumber>
        <modelURL>${device.manufacturerURL}</modelURL>
        <serialNumber></serialNumber>
        <UDN>uuid:${device.deviceID}</UDN>
      </device>
      <serviceList>
        <service>
          <serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType>
          <serviceId>urn:upnp-org:serviceId:ConnectionManager</serviceId>
          <SCPDURL>/ConnectionManager.xml</SCPDURL>
          <controlURL>${device.baseURL}/ConnectionManager.xml</controlURL>
          <eventSubURL>${device.baseURL}/ConnectionManager.xml</eventSubURL>
        </service>
        <service>
          <serviceType>urn:schemas-upnp-org:service:ContentDirectory:1</serviceType>
          <serviceId>urn:upnp-org:serviceId:ContentDirectory</serviceId>
          <SCPDURL>/ContentDirectory.xml</SCPDURL>
          <controlURL>${device.baseURL}/ContentDirectory.xml</controlURL>
          <eventSubURL>${device.baseURL}/ContentDirectory.xml</eventSubURL>
        </service>
      </serviceList>
    </root>`
	}
	return device
}

module.exports = device