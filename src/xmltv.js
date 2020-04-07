const XMLWriter = require('xml-writer')
const XMLReader = require('xml-reader')
const fs = require('fs')
const config = require('config-yml')

module.exports = {
    WriteXMLTV: WriteXMLTV,
    UpdateXMLTV: UpdateXMLTV,
    readXMLPrograms: readXMLPrograms,
    readXMLChannels: readXMLChannels
}

function readXMLPrograms() {
    var data = fs.readFileSync(config.XMLTV_FILE)
    var xmltv = XMLReader.parseSync(data.toString())
    var programs = []
    var tv = xmltv.children
    for (var i = 0; i < tv.length; i++) {
        if (tv[i].name == 'channel')
            continue;
        var program = {
            channel: tv[i].attributes.channel,
            start: createDate(tv[i].attributes.start),
            stop: createDate(tv[i].attributes.stop),
            key: tv[i].attributes['plex-key']
        }
        programs.push(program)
    }
    return programs
}

function readXMLChannels() {
    var data = fs.readFileSync(config.XMLTV_FILE)
    var xmltv = XMLReader.parseSync(data.toString())
    var channels = []
    var tv = xmltv.children
    for (var i = 0; i < tv.length; i++) {
        if (tv[i].name == 'programme')
            continue;
        //console.log(tv[i])
        var channel = {
            channel: tv[i].attributes.id,
            shuffle: tv[i].attributes.shuffle
        }
        for (var y = 0; y < tv[i].children.length; y++)
        {
            if (tv[i].children[y].name === 'display-name') {
                channel.name = tv[i].children[y].children[0].value
            }
            if (tv[i].children[y].name === 'icon') {
                channel.icon = tv[i].children[y].attributes.src
            }
        }
        channels.push(channel)
    }
    return channels
}

function WriteXMLTV(channels, cb) {
    var xw = new XMLWriter(true)
    var time = new Date()
    // Build XMLTV and M3U files
    xw.startDocument()
    // Root TV Element
    xw.startElement('tv')
    xw.writeAttribute('generator-info-name', 'psuedotv-plex')
    writeChannels(xw, channels)
    // For each channel
    for (var i = 0; i < channels.length; i++) {
        var future = new Date()
        future.setHours(time.getHours() + config.EPG_CACHE)
        var tempDate = new Date(time.valueOf())
        // Loop items until EPG_CACHE is satisfied, starting time of first show is NOW.
        while (tempDate < future && channels[i].items.length > 0) {
            for (var y = 0; y < channels[i].items.length && tempDate < future; y++) {
                var stopDate = new Date(tempDate.valueOf())
                stopDate.setMilliseconds(stopDate.getMilliseconds() + channels[i].items[y].duration)
                var program = {
                    info: channels[i].items[y],
                    channel: channels[i].channel,
                    start: new Date(tempDate.valueOf()),
                    stop: stopDate
                }
                writeProgramme(xw, program)
                tempDate.setMilliseconds(tempDate.getMilliseconds() + channels[i].items[y].duration)
            }
        }
    }
    // End TV
    xw.endElement()
    xw.endDocument()
    fs.writeFileSync(config.XMLTV_FILE, xw.toString())
    if (typeof cb == 'function')
        cb()
}

function UpdateXMLTV(channels, cb) {
    var xw = new XMLWriter(true)
    var data = fs.readFileSync(config.XMLTV_FILE)
    var xml = XMLReader.parseSync(data.toString())
    var time = new Date()
    xw.startDocument()
    xw.startElement('tv')
    xw.writeAttribute('generator-info-name', 'psuedotv-plex')
    writeChannels(xw, channels)
    // Foreach channel
    for (var i = 0; i < channels.length; i++) {
        // get non-expired programmes for channel
        var validPrograms = []
        for (var y = 0; y < xml.children.length; y++) {
            if (xml.children[y].name == 'programme' && xml.children[y].attributes.channel == channels[i].channel) {
                var showStop = createDate(xml.children[y].attributes.stop)
                if (showStop > time)
                    validPrograms.push(xml.children[y])
            }
        }
        // If Channel doesnt exists..
        if (validPrograms.length === 0) {
            var future = new Date()
            future.setHours(time.getHours() + config.EPG_CACHE)
            var tempDate = new Date(time.valueOf())
            // Loop items until EPG_CACHE is satisfied, starting time of first show is NOW.
            while (tempDate < future) {
                for (var y = 0; y < channels[i].items.length && tempDate < future; y++) { // foreach item in playlist
                    var stopDate = new Date(tempDate.valueOf())
                    stopDate.setMilliseconds(stopDate.getMilliseconds() + channels[i].items[y].duration)
                    var program = {
                        info: channels[i].items[y],
                        channel: channels[i].channel,
                        start: new Date(tempDate.valueOf()),
                        stop: stopDate
                    }
                    writeProgramme(xw, program)
                    tempDate.setMilliseconds(tempDate.getMilliseconds() + channels[i].items[y].duration)
                }
            }
        } else { // Otherwise the channel already exists..
            var playlistStartIndex = -1
            var startingDate = new Date(time.valueOf())
            var endDate = new Date(time.valueOf())
            endDate.setHours(endDate.getHours() + config.EPG_CACHE)
            // rewrite first valid xml programmes, if it still exists in the plex playlist..
            for (var z = 0; z < channels[i].items.length; z++) {
                if (channels[i].items[z].key == validPrograms[0].attributes['plex-key']) {
                    playlistStartIndex = z
                    var program = {
                        channel: validPrograms[0].attributes.channel,
                        start: createDate(validPrograms[0].attributes.start),
                        stop: createDate(validPrograms[0].attributes.stop),
                        info: channels[i].items[z]
                    }
                    startingDate = new Date(program.stop.valueOf())
                    writeProgramme(xw, program)
                    break;
                }
            }
            if (playlistStartIndex !== -1) {
                playlistStartIndex++
                if (playlistStartIndex === channels[i].items.length)
                    playlistStartIndex = 0
            } else {
                playlistStartIndex = 0
            }
            // write programs from plex, starting at the live playlist index.
            while (startingDate < endDate) {
                for (var y = playlistStartIndex; y < channels[i].items.length && startingDate < endDate; y++) {
                    var stopDate = new Date(startingDate.valueOf())
                    stopDate.setMilliseconds(stopDate.getMilliseconds() + channels[i].items[y].duration)
                    var program = {
                        info: channels[i].items[y],
                        channel: channels[i].channel,
                        start: new Date(startingDate.valueOf()),
                        stop: stopDate
                    }
                    writeProgramme(xw, program)
                    startingDate.setMilliseconds(startingDate.getMilliseconds() + channels[i].items[y].duration)
                }
                playlistStartIndex = 0
            }
        }
    }
    // End TV
    xw.endElement()
    // End Doc
    xw.endDocument()
    fs.writeFileSync(config.XMLTV_FILE, xw.toString())
    if (typeof cb == 'function')
        cb()
}

function writeChannels(xw, channels) {
    // Channels
    for (var i = 0; i < channels.length; i++) {
        xw.startElement('channel')
        xw.writeAttribute('id', channels[i].channel)
        xw.writeAttribute('shuffle', channels[i].shuffle ? 'yes': 'no')
        xw.startElement('display-name')
        xw.writeAttribute('lang', 'en')
        xw.text(channels[i].name)
        xw.endElement()
        if (channels[i].icon) {
            xw.startElement('icon')
            xw.writeAttribute('src', channels[i].icon)
            xw.endElement()
        }
        xw.endElement()
    }
}

function writeProgramme(xw, program) {
    // Programme
    xw.startElement('programme')
    xw.writeAttribute('start', createXMLTVDate(program.start))
    xw.writeAttribute('stop', createXMLTVDate(program.stop))
    xw.writeAttribute('channel', program.channel)
    xw.writeAttribute('plex-key', program.info.key) // Used to link this programme to Plex..
    // Title
    xw.startElement('title')
    xw.writeAttribute('lang', 'en')
    if (program.info.type == 'episode')
        xw.text(program.info.grandparentTitle)
    else
        xw.text(program.info.title)
    xw.endElement()
    if (program.info.type == 'episode') {
        xw.writeRaw('\n        <previously-shown/>')
        // Sub-Title
        xw.startElement('sub-title')
        xw.writeAttribute('lang', 'en')
        xw.text(program.info.title)
        xw.endElement()
        // Episode-Number
        xw.startElement('episode-num')
        xw.writeAttribute('system', 'xmltv_ns')
        xw.text((program.info.parentIndex - 1) + ' . ' + (program.info.index - 1) + ' . 0/1')
        xw.endElement()
    }
    // Icon
    xw.startElement('icon')
    if (program.info.type == 'movie')
        xw.writeAttribute('src', 'http://' + config.PLEX_OPTIONS.hostname + ':' + config.PLEX_OPTIONS.port + program.info.thumb)
    else if (program.info.type == 'episode')
        xw.writeAttribute('src', 'http://' + config.PLEX_OPTIONS.hostname + ':' + config.PLEX_OPTIONS.port + program.info.parentThumb)
    xw.endElement()
    // Desc
    xw.startElement('desc')
    xw.writeAttribute('lang', 'en')
    xw.text(program.info.summary)
    xw.endElement()
    // Date
    if (typeof program.info.originallyAvailableAt !== 'undefined')
        xw.writeElement('date', program.info.originallyAvailableAt.split('-').join(''))
    // Rating
    if (typeof program.info.contentRating != 'undefined') {
        xw.startElement('rating')
        xw.writeAttribute('system', 'MPAA')
        xw.writeElement('value', program.info.contentRating)
        xw.endElement()
    }
    // End of Programme
    xw.endElement()
}
function createXMLTVDate(d) {
    function pad(n) { return n < 10 ? '0' + n : n }
    var timezone = d.toString().split('GMT')
    timezone = timezone[timezone.length - 1].split(' ')[0]
    return d.getFullYear() + ""
        + pad(d.getMonth() + 1) + ""
        + pad(d.getDate()) + ""
        + pad(d.getHours()) + ""
        + pad(d.getMinutes()) + ""
        + pad(d.getSeconds()) + " " + timezone
}
function createDate(xmlDate) {
    var year = xmlDate.substr(0, 4)
    var month = xmlDate.substr(4, 2) - 1
    var day = xmlDate.substr(6, 2)
    var hour = xmlDate.substr(8, 2)
    var min = xmlDate.substr(10, 2)
    var sec = xmlDate.substr(12, 2)
    var date = new Date(year, month, day, hour, min, sec) // fuck the timezone.. It'll be the same as a new Date()...
    return date
}