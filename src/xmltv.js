const XMLWriter = require('xml-writer')
const fs = require('fs')
const helperFuncs = require('./helperFuncs')
const constants = require('./constants')

module.exports = { WriteXMLTV: WriteXMLTV }

function WriteXMLTV(channels, xmlSettings) {
    return new Promise((resolve, reject) => {
        let date = new Date()
        let ws = fs.createWriteStream(xmlSettings.file)
        let xw = new XMLWriter(true, (str, enc) => ws.write(str, enc))
        ws.on('close', () => { resolve() })
        ws.on('error', (err) => { reject(err) })
        _writeDocStart(xw)
      async function middle() {
        if (channels.length === 0) { // Write Dummy PseudoTV Channel if no channel exists
            _writeChannels(xw, [{ number: 1, name: "PseudoTV", icon: "https://raw.githubusercontent.com/DEFENDORe/pseudotv/master/resources/pseudotv.png" }])
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
            await _writeProgramme(null, xw, program, null)
        } else {
            _writeChannels(xw, channels)
            for (let i = 0; i < channels.length; i++) {
                await _writePrograms(xw, channels[i], date, xmlSettings.cache)
            }
        }
      }
      middle().then( () => {
        _writeDocEnd(xw, ws)
      }).catch( (err) => {
          console.error("Error", err);
      }).then( () => ws.end() );
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
    for (let i = 0; i < channels.length; i++) {
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

async function _writePrograms(xw, channel, date, cache) {
    let prog = helperFuncs.getCurrentProgramAndTimeElapsed(date, channel)
    let cutoff = new Date( date.valueOf() + (cache * 60 * 60 * 1000) )
    let temp = new Date(date.valueOf() - prog.timeElapsed)
    if (channel.programs.length === 0)
        return
    let i = prog.programIndex
    for (; temp < cutoff;) {
        await _throttle(); //let's not block for this process
        let program = {
            program: channel.programs[i],
            channel: channel.number,
            start: new Date(temp.valueOf()),
            stop: new Date(temp.valueOf() + channel.programs[i].duration)
        }
        let ni = (i + 1) % channel.programs.length;
        if (
            ( (typeof(program.program.isOffline) === 'undefined') || !(program.program.isOffline) )
            &&
            (channel.programs[ni].isOffline)
            &&
            (channel.programs[ni].duration < constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS )
        ) {
            program.stop = new Date(temp.valueOf() + channel.programs[i].duration + channel.programs[ni].duration)
            i = (i + 2) % channel.programs.length;
        } else {
            i = ni;
        }
        _writeProgramme(channel, xw, program, cutoff)
        temp = program.stop;
    }
}

async function _writeProgramme(channel, xw, program, cutoff) {
    // Programme
    xw.startElement('programme')
    xw.writeAttribute('start', _createXMLTVDate(program.start))
    xw.writeAttribute('stop', _createXMLTVDate(program.stop))
    xw.writeAttribute('channel', program.channel)
    // Title
    xw.startElement('title')
    xw.writeAttribute('lang', 'en')

    if (program.program.isOffline) {
        xw.text(channel.name)
        xw.endElement()
    } else if (program.program.type === 'episode') {
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
    if (typeof(program.program.summary) !== 'undefined') {
        xw.text(program.program.summary)
    } else {
        xw.text(channel.name)
    }
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
    //console.log("d=" + d.getTime() );
    try {
        return d.toISOString().substring(0,19).replace(/[-T:]/g,"") + " +0000";
    } catch(e) {
        console.log("d=" + d.getTime(), e);
        return (new Date()).toISOString().substring(0,19).replace(/[-T:]/g,"") + " +0000";
    }
}
function _throttle() {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
}
