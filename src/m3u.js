const fs = require('fs')
const config = require('config-yml')

function WriteM3U(channels, cb) {
    var data = "#EXTM3U\n"
    for (var i = 0; i < channels.length; i++) {
        data += `#EXTINF:0 tvg-id="${channels[i].channel}" tvg-name="${channels[i].name}" tvg-logo="${channels[i].icon}",${channels[i].channel}\n`
        data += `http://${config.HOST}:${config.PORT}/video?channel=${channels[i].channel}\n`
    }
    fs.writeFileSync(config.M3U_OUTPUT, data)
    if (typeof cb == 'function')
        cb()
}
// Formatted for HDHR lineup..
function ReadChannels() {
    var m3uData = fs.readFileSync(config.M3U_OUTPUT)
    var track = m3uData.toString().split(/[\n]+/)
    var channels = []
    track.splice(0, 1)
    track.pop()
    for (var i = 0; i < track.length; i += 2) {
        var tmp = track[i].split("\"")
        channels.push({ GuideNumber: tmp[1], GuideName: tmp[3], URL: track[i + 1] })
    }
    return channels
}

module.exports = {
    WriteM3U: WriteM3U,
    ReadChannels: ReadChannels
}