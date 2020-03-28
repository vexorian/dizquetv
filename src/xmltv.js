const XMLWriter = require('xml-writer')
const XMLReader = require('xml-reader')
const fs = require('fs')
const config = require('config-yml')

function readXMLPrograms() {
    var data = fs.readFileSync(config.XMLTV_OUTPUT)
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
            video: tv[i].attributes.video,
            optimized: tv[i].attributes.optimized == "true" ? true : false
        }
        programs.push(program)
    }
    return programs
}

function WriteXMLTV(channels, cb) {
    var xw = new XMLWriter(true);
    var time = new Date()
    // Build XMLTV and M3U files
    xw.startDocument()
    // Root TV Element
    xw.startElement('tv')
    xw.writeAttribute('generator-info-name', 'psuedotv-plex')
    writeChannels(xw, channels)
    // Programmes
    for (var i = 0; i < channels.length; i++) {
        var future = new Date()
        future.setHours(time.getHours() + config.EPG_CACHE)
        var tempDate = new Date(time.valueOf())
        while (tempDate < future && channels[i].playlist.length > 0) {
            for (var y = 0; y < channels[i].playlist.length; y++) {
                var stopDate = new Date(tempDate.valueOf())
                stopDate.setMilliseconds(stopDate.getMilliseconds() + channels[i].playlist[y].duration)
                var plexURL = channels[i].playlist[y].Media[0].Part[0].key
                var optimizedForStreaming = false
                for (var z = 0; z < channels[i].playlist[y].Media.length; z++) {
                    var part = channels[i].playlist[y].Media[z].Part[0]
                    if (typeof part.optimizedForStreaming !== 'undefined' && part.optimizedForStreaming) {
                        plexURL = part.key
                        optimizedForStreaming = part.optimizedForStreaming
                        break;
                    }
                }
                plexURL = `http://${config.PLEX_OPTIONS.hostname}:${config.PLEX_OPTIONS.port}${plexURL}?X-Plex-Token=${config.PLEX_OPTIONS.token}`
                var program = {
                    info: channels[i].playlist[y],
                    channel: channels[i].channel,
                    start: new Date(tempDate.valueOf()),
                    stop: stopDate,
                    plexURL: plexURL,
                    optimizedForStreaming: optimizedForStreaming.toString()
                }
                writeProgramme(xw, program)
                tempDate.setMilliseconds(tempDate.getMilliseconds() + channels[i].playlist[y].duration)
            }
        }
    }
    // End TV
    xw.endElement()
    xw.endDocument()
    fs.writeFileSync(config.XMLTV_OUTPUT, xw.toString())
    if (typeof cb == 'function')
        cb()
}

function UpdateXMLTV(channels, cb) {
    var xw = new XMLWriter(true)
    var data = fs.readFileSync(config.XMLTV_OUTPUT)
    var xml = XMLReader.parseSync(data.toString())
    var time = new Date()
    xw.startDocument()
    xw.startElement('tv')
    xw.writeAttribute('generator-info-name', 'psuedotv-plex')
    writeChannels(xw, channels)
    // Programmes
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
        if (validPrograms.length == 0) {
            // write out programs from plex
            var future = new Date()
            future.setHours(time.getHours() + config.EPG_CACHE)
            var tempDate = new Date(time.valueOf())
            while (tempDate < future) {
                for (var y = 0; y < channels[i].playlist.length; y++) { // foreach item in playlist
                    var stopDate = new Date(tempDate.valueOf())
                    stopDate.setMilliseconds(stopDate.getMilliseconds() + channels[i].playlist[y].duration)
                    var plexURL = channels[i].playlist[y].Media[0].Part[0].key
                    var optimizedForStreaming = false
                    for (var z = 0; z < channels[i].playlist[y].Media.length; z++) { // get optimed video if there is one
                        var part = channels[i].playlist[y].Media[z].Part[0]
                        if (typeof part.optimizedForStreaming !== 'undefined' && part.optimizedForStreaming) {
                            plexURL = part.key
                            optimizedForStreaming = part.optimizedForStreaming
                            break;
                        }
                    }
                    plexURL = `http://${config.PLEX_OPTIONS.hostname}:${config.PLEX_OPTIONS.port}${plexURL}?X-Plex-Token=${config.PLEX_OPTIONS.token}`
                    var program = {
                        info: channels[i].playlist[y],
                        channel: channels[i].channel,
                        start: new Date(tempDate.valueOf()),
                        stop: stopDate,
                        plexURL: plexURL,
                        optimizedForStreaming: optimizedForStreaming.toString()
                    }
                    writeProgramme(xw, program)
                    tempDate.setMilliseconds(tempDate.getMilliseconds() + channels[i].playlist[y].duration)
                }
            }
        } else {
            var playlistStartIndex = 0
            var isFirstItemFound = false
            var startingDate = new Date(time.valueOf())
            var endDate = new Date(time.valueOf())
            endDate.setHours(endDate.getHours() + config.EPG_CACHE)
            // rewrite first valid xml programmes, if it still exists in the plex playlist..
            for (var z = 0; z < channels[i].playlist.length; z++) {
                if (channels[i].playlist[z].guid == validPrograms[0].attributes.guid) {

                    isFirstItemFound = true
                    playlistStartIndex = z
                    var program = {
                        channel: validPrograms[0].attributes.channel,
                        start: createDate(validPrograms[0].attributes.start),
                        stop: createDate(validPrograms[0].attributes.stop),
                        plexURL: validPrograms[0].attributes.video,
                        optimizedForStreaming: validPrograms[0].attributes.optimized,
                        info: channels[i].playlist[z]
                    }
                    startingDate = new Date(program.stop.valueOf())
                    writeProgramme(xw, program)
                    break;
                }
            }
            if (isFirstItemFound) {
                playlistStartIndex++
                if (channels[i].playlist.length == playlistStartIndex)
                    playlistStartIndex = 0
            }

            // write programs from plex, starting at the live playlist index.
            while (startingDate < endDate) {
                for (var y = playlistStartIndex; y < channels[i].playlist.length; y++) {
                    var stopDate = new Date(startingDate.valueOf())
                    stopDate.setMilliseconds(stopDate.getMilliseconds() + channels[i].playlist[y].duration)
                    var plexURL = channels[i].playlist[y].Media[0].Part[0].key
                    var optimizedForStreaming = false
                    for (var z = 0; z < channels[i].playlist[y].Media.length; z++) {
                        var part = channels[i].playlist[y].Media[z].Part[0]
                        if (typeof part.optimizedForStreaming !== 'undefined' && part.optimizedForStreaming) {
                            plexURL = part.key
                            optimizedForStreaming = part.optimizedForStreaming
                            break;
                        }
                    }
                    plexURL = `http://${config.PLEX_OPTIONS.hostname}:${config.PLEX_OPTIONS.port}${plexURL}?X-Plex-Token=${config.PLEX_OPTIONS.token}`
                    var program = {
                        info: channels[i].playlist[y],
                        channel: channels[i].channel,
                        start: new Date(startingDate.valueOf()),
                        stop: stopDate,
                        plexURL: plexURL,
                        optimizedForStreaming: optimizedForStreaming.toString()
                    }
                    writeProgramme(xw, program)
                    startingDate.setMilliseconds(startingDate.getMilliseconds() + channels[i].playlist[y].duration)
                    playlistStartIndex = 0
                }
            }
        }
    }
    // End TV
    xw.endElement()
    // End Doc
    xw.endDocument()
    fs.writeFileSync(config.XMLTV_OUTPUT, xw.toString())
    if (typeof cb == 'function')
        cb()
}



module.exports = {
    WriteXMLTV: WriteXMLTV,
    UpdateXMLTV: UpdateXMLTV,
    readXMLPrograms: readXMLPrograms
}
function writeChannels(xw, channels) {
    // Channels
    for (var i = 0; i < channels.length; i++) {
        xw.startElement('channel')
        xw.writeAttribute('id', channels[i].channel)
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
    // For VLC to handle...
    xw.writeAttribute('video', program.plexURL)
    xw.writeAttribute('optimized', program.optimizedForStreaming)
    xw.writeAttribute('guid', program.info.guid)
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
        xw.writeAttribute('src', 'http://' + config.PLEX_OPTIONS.hostname + ':' + config.PLEX_OPTIONS.port + program.info.thumb + '?X-Plex-Token=' + config.PLEX_OPTIONS.token)
    else if (program.info.type == 'episode')
        xw.writeAttribute('src', 'http://' + config.PLEX_OPTIONS.hostname + ':' + config.PLEX_OPTIONS.port + program.info.parentThumb + '?X-Plex-Token=' + config.PLEX_OPTIONS.token)
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