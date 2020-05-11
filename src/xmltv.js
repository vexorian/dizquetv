const XMLWriter = require('xml-writer')
const fs = require('fs')
const helperFuncs = require('./helperFuncs')

module.exports = { WriteXMLTV: WriteXMLTV }

function WriteXMLTV(channels, xmlSettings) {
    return new Promise((resolve, reject) => {
        let date = new Date()
        var ws = fs.createWriteStream(xmlSettings.file)
        var xw = new XMLWriter(true, (str, enc) => ws.write(str, enc))
        ws.on('close', () => { resolve() })
        ws.on('error', (err) => { reject(err) })
        _writeDocStart(xw)
        if (channels.length === 0) {
            _writeChannels(xw, [{ number: 1, name: "PseudoTV", icon: null }])
            let program = {
                program: {
                    type: 'movie',
                    title: 'No Channels Configured',
                    summary: 'Configure your channels using the PseudoTV Web UI.'
                },
                channel: '1',
                start: date,
                stop: new Date(date.valueOf() + xmlSettings.cache * 60 * 60 * 1000)
            }
            _writeProgramme(xw, program)
        } else {
            _writeChannels(xw, channels)
            for (var i = 0; i < channels.length; i++)
                _writePrograms(xw, channels[i], date, xmlSettings.cache)
        }
        
        _writeDocEnd(xw, ws)
        ws.close()
    })
}

function _writeDocStart(xw) {
    xw.startDocument()
    xw.startElement('tv')
    xw.writeAttribute('generator-info-name', 'psuedotv-plex')
}
function _writeDocEnd(xw, ws) {
    xw.endElement()
    xw.endDocument()
}

function _writeChannels(xw, channels) {
    for (var i = 0; i < channels.length; i++) {
        xw.startElement('channel')
        xw.writeAttribute('id', channels[i].number)
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

function _writePrograms(xw, channel, date, cache) {
    let prog = helperFuncs.getCurrentProgramAndTimeElapsed(date, channel)
    let cutoff = new Date((date.valueOf() - prog.timeElapsed) + (cache * 60 * 60 * 1000))
    let temp = new Date(date.valueOf() - prog.timeElapsed)
    if (channel.programs.length === 0)
        return
    let i = prog.programIndex
    for (; temp < cutoff;) {
        let program = {
            program: channel.programs[i],
            channel: channel.number,
            start: new Date(temp.valueOf()),
            stop: new Date(temp.valueOf() + channel.programs[i].duration)
        }
        _writeProgramme(xw, program)
        temp.setMilliseconds(temp.getMilliseconds() + channel.programs[i].duration)
        i++
        if (i >= channel.programs.length)
            i = 0
    }
}

function _writeProgramme(xw, program) {
    // Programme
    xw.startElement('programme')
    xw.writeAttribute('start', _createXMLTVDate(program.start))
    xw.writeAttribute('stop', _createXMLTVDate(program.stop))
    xw.writeAttribute('channel', program.channel)
    // Title
    xw.startElement('title')
    xw.writeAttribute('lang', 'en')

    if (program.program.type === 'episode') {
        xw.text(program.program.showTitle)
        xw.endElement()
        xw.writeRaw('\n        <previously-shown/>')
        // Sub-Title
        xw.startElement('sub-title')
        xw.writeAttribute('lang', 'en')
        xw.text(program.program.title)
        xw.endElement()
        // Episode-Number
        xw.startElement('episode-num')
        xw.writeAttribute('system', 'xmltv_ns')
        xw.text((program.program.season - 1) + ' . ' + (program.program.episode - 1) + ' . 0/1')
        xw.endElement()
    } else {
        xw.text(program.program.title)
        xw.endElement()
    }
    // Icon
    if (typeof program.program.icon !== 'undefined') {
        xw.startElement('icon')
        xw.writeAttribute('src', program.program.icon)
        xw.endElement()
    }
    // Desc
    xw.startElement('desc')
    xw.writeAttribute('lang', 'en')
    xw.text(program.program.summary)
    xw.endElement()
    // Rating
    if (typeof program.program.rating !== 'undefined') {
        xw.startElement('rating')
        xw.writeAttribute('system', 'MPAA')
        xw.writeElement('value', program.program.rating)
        xw.endElement()
    }
    // End of Programme
    xw.endElement()
}
function _createXMLTVDate(d) {
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