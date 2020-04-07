const Router = require('express').Router
const config = require('config-yml')
const path = require('path')

module.exports = pseudotv

function pseudotv(client, xmltv, m3u) {
    var counter = config.EPG_UPDATE * 60 * 1000
    restartEPG(client, xmltv, m3u, config.PLEX_AUTO_REFRESH_GUIDE, config.PLEX_AUTO_REMAP_CHANNELS, () => {
        console.log("Initial EPG Generated.")
    })
    if (config.EPG_UPDATE !== 0) {
        setInterval(() => {
            counter -= 1000
            if (counter === 0)
                updateEPG(client, xmltv, m3u, config.PLEX_AUTO_REFRESH_GUIDE, config.PLEX_AUTO_REMAP_CHANNELS, () => {
                    console.log("Updated EPG via Scheduled Refresh.")
                    counter = config.EPG_UPDATE * 60 * 1000
                })
        }, 1000)
    }

    var router = Router()

    router.get('/', (req, res) => {
        if (req.query.refresh === 'true')
            updateEPG(client, xmltv, m3u,
                req.query.rg === 'true' ? true : false,
                req.query.rc === 'true' ? true : false, () => {
                    counter = config.EPG_UPDATE * 60 * 1000
                    return res.status(200).send()
                })
        else if (req.query.restart === 'true')
            restartEPG(client, xmltv, m3u,
                req.query.rg === 'true' ? true : false,
                req.query.rc === 'true' ? true : false, () => {
                    counter = config.EPG_UPDATE * 60 * 1000
                    return res.status(200).send()
                })
        else
            client.GetPseudoTVDVRS((result) => {
                res.status(200).send(createHTML(result.result, xmltv.readXMLChannels(), counter / 1000))
            })
    })
    return router
}

function updateEPG(client, xmltv, m3u, rg, rc, cb) {
    client.PseudoTVChannelScan((channels) => {
        xmltv.UpdateXMLTV(channels, () => {
            m3u.WriteM3U(channels, () => {
                if (rg)
                    client.RefreshGuide()
                if (rc)
                    client.RefreshChannels(channels)
                cb()
            })
        })
    })
}

function restartEPG(client, xmltv, m3u, rg, rc, cb) {
    client.PseudoTVChannelScan((channels) => {
        xmltv.WriteXMLTV(channels, () => {
            m3u.WriteM3U(channels, () => {
                if (rg)
                    client.RefreshGuide()
                if (rc)
                    client.RefreshChannels(channels)
                cb()
            })
        })
    })
}

function createHTML(dvrs, channels, counter) {
    var str = `
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>pseudotv-plex</title>
            <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css" rel="stylesheet">
        </head>
        <body class="bg-dark">
            <div class="container bg-light" style="padding: 15px; margin: 5px auto;">
                <h1>pseudotv-plex<span class="pull-right"><a href="https://gitlab.com/DEFENDORe/pseudotv-plex"><i class="fa fa-gitlab"></i></a></span></h1>
                <p class="lead">Create live TV channels from your Plex playlists.</p>
            </div>
            <div class="container bg-light" style="padding: 15px; margin: 5px auto;" id="channels">
                <h3 class="text-center">Pseudo Channels</h3>
                <hr/>
                <span class="text-md-left">Total channels in XMLTV file: <b>${channels.length}</b></span>
                ${createChannelTable(channels)}
            </div>
            <div class="container bg-light" style="padding: 15px; margin: 5px auto;" id="epg">
                <h3 class="text-center">EPG Utility</h3>
                <p class="lead text-center">Scan Plex for <i>${config.PLEX_PLAYLIST_IDENTIFIER}</i> playlists.</p>
                <hr/>
                ${createEPGUtility(dvrs)}
            </div>
            <div class="container bg-light" style="padding: 15px; margin: 5px auto;" id="config">
                <h3 class="text-center">Configuration</h3>
                <p class="text-center text-secondary">Any changes made to <b>config.yml</b> won't take effect until pseudotv-plex is restarted.</p>
                <hr/>
                ${createConfigDetails()}
            </div>
            <p class="text-center">Author: Dan Ferguson</p>
            ${createScript(counter)}
        </body>
    </html>`
    return str.split('    ').join('')
}

function createConfigDetails() {
    var str = `<p>
                    Host: <b>${config.HOST}</b><br/>
                    Port: <b>${config.PORT}</b>
                    <hr/>
                    Plex Server Host: <b>${config.PLEX_OPTIONS.hostname}</b><br/>
                    Plex Server Port: <b>${config.PLEX_OPTIONS.port}</b><hr/>
                    XMLTV: <b>${path.resolve(config.XMLTV_FILE)}</b><br/>
                    M3U: <b>${path.resolve(config.M3U_FILE)}</b>
                    <hr/>
                    ${config.HDHOMERUN_OPTIONS.ENABLED ? `HDHomeRun Tuner: <b>${config.HOST}:${config.PORT}</b><br/>` : ''}
                    HDHomeRun Tuner: <b>${config.HDHOMERUN_OPTIONS.ENABLED ? 'Enabled' : 'Disabled'}</b>
                    ${config.HDHOMERUN_OPTIONS.ENABLED ? `<br/>HDHomeRun Auto-Discovery: <b>${config.HDHOMERUN_OPTIONS.AUTODISCOVERY ? 'Enabled' : 'Disabled'}</b>` : ''}
                    <hr/>
                    MPEGTS Streaming Muxer: <b>${config.MUXER.toUpperCase()}</b><br/>
                    ${config.MUXER.toUpperCase()} Location: <b>${config.MUXER.toLowerCase() === 'ffmpeg' ? path.resolve(config.FFMPEG_OPTIONS.PATH) : path.resolve(config.VLC_OPTIONS.PATH)}</b>
                    ${config.MUXER.toLowerCase() === 'ffmpeg' ? `<br/>FFMPEG Prebuffering: <b>${config.FFMPEG_OPTIONS.PREBUFFER ? 'Enabled' : 'Disabled'}</b>` : ''}
                    ${config.MUXER.toLowerCase() === 'vlc' ? `<br/>VLC HTTP Server Port: <b>${config.VLC_OPTIONS.PORT}</b>` : ''}
                    ${config.MUXER.toLowerCase() === 'vlc' ? `<br/>VLC Streaming Delay (ms): <b>${config.VLC_OPTIONS.DELAY}</b>` : ''}
                    ${config.MUXER.toLowerCase() === 'vlc' ? `<br/>VLC Session Visibility: <b>${config.VLC_OPTIONS.HIDDEN ? 'Hidden' : 'Visible'}</b>` : ''}
                    <hr/>
                    EPG Cache: <b>${config.EPG_CACHE} Hours</b><br/>
                    EPG Update: <b>${config.EPG_UPDATE === 0 ? 'Never' : config.EPG_UPDATE + ' Minutes'}</b><br/>
                    Auto Refresh Plex Guide: <b>${config.PLEX_AUTO_REFRESH_GUIDE ? 'Yes' : 'No'}</b><br/>
                    Auto Refresh Plex DVR Channels: <b>${config.PLEX_AUTO_REMAP_CHANNELS ? 'Yes' : 'No'}</b>
                    <hr/>
                    Plex Playlist Summary Identifier: <b>${config.PLEX_PLAYLIST_IDENTIFIER}</b><br/>
                    X-Plex-Session-Identifier: <b>${config.PLEX_SESSION_ID}</b>
                </p>`
    return str.split('    ').join('')
}

var createChannelTable = (channels) => {
    var str = `<table class="table table-striped">
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Icon</th>
                        <th>Shuffle</th>
                    </tr>`
    for (var i = 0; i < channels.length; i++) {
        str += `<tr>
                        <td>${channels[i].channel}</td>
                        <td>${channels[i].name}</td>
                        <td>${channels[i].icon ? `<img style="height: 50px;" src="${channels[i].icon}"/>` : ''}</td>
                        <td>${channels[i].shuffle}</td>
                    </tr>`
    }
    str += `</table>`
    if (channels.length === 0) {
        str += `<h5>Initial Setup</h5>
                <ol>
                    <li>Create a video playlist. <i>Tip: you can utilize Plex Smart Playlist's to create dynamic channels.</i></li>
                    <li>Edit the playlist's summary/description, write <i>${config.PLEX_PLAYLIST_IDENTIFIER}</i> at the beginning to identify the playlist as a channel.</li>
                    <li>Restart pseudotv-plex, or use the '<a href="#epg">EPG Utilty</a>' below to update/restart your EPG.</li>
                    <li>Add the spoofed HDHomeRun tuner to Plex. Use the XMLTV file for EPG information. Alternatively you can use xTeVe, by utilizing the XMLTV and M3U files.</li>
                    <li>Enjoy your pseudo live TV</li>`
    }
    return str.split('    ').join('')
}
function createEPGUtility(dvrs) {
    var str = `<form id="frmEPG" class="text-center" onsubmit="return false">
                <p><b>Plex Server LiveTV/DVR Auto Refresh Options</b>${dvrs.length > 0 ? '' : '<br/><span class="text-info">(Could not find a PseudoTV DVR in Plex)</span>'}</p>
                <div class="row">
                    <label for="chkGuide" class="col-md-6">
                        <input type="checkbox" id="chkGuide" ${config.PLEX_AUTO_REFRESH_GUIDE ? 'checked' : ''} ${dvrs.length > 0 ? 'enabled' : 'disabled'}> Auto Refresh Guide
                    </label>
                    <label for="chkChannels" class="col-md-6">
                        <input type="checkbox" id="chkChannels" ${config.PLEX_AUTO_REMAP_CHANNELS ? 'checked' : ''} ${dvrs.length > 0 ? 'enabled' : 'disabled'}> Auto Remap Channels
                    </label>
                </div>
                <hr/>
                <div class="row">
                    <div class="col-md-6">
                        <button id="btnRefresh" type="submit" class="btn btn-primary" style="width: 100%">Refresh EPG</button>
                        <p class="text-primary">Updates the XMLTV file in such a way that channel timelines are uninterupted, if possible.</p>
                    </div>
                    <div class="col-md-6">
                        <button id="btnRestart" type="submit" class="btn btn-danger" style="width: 100%">Restart EPG</button>
                        <p class="text-danger">Rewrites the XMLTV file, every channels timeline will begin now.</p>
                    </div>
                </div>
                
            </form>
            <p class="text-center"><i>Restart Plex client apps and refresh Plex web sessions to view changes..</i></p>
            ${config.EPG_UPDATE === 0 ? '' : `<hr/><p class="text-center"><span><b>Next EPG Refresh:</b> <span style="width: 100px; display: inline-block;" class="counter text-right"></span> (hh:mm:ss)</span></p>`}
            `
    return str.split('    ').join('')
}

var createScript = function (counter) {
    var str = `<script>
        var chkGuide = document.getElementById('chkGuide')
        var chkChannels = document.getElementById('chkChannels')
        var btnRefresh = document.getElementById('btnRefresh')
        var btnRestart = document.getElementById('btnRestart')
        ${config.EPG_UPDATE === 0 ? '' : `
        function ts(s) {
            var date = new Date(null)
            date.setSeconds(s)
            return date.toISOString().substr(11, 8)
        }
        var x = document.getElementsByClassName('counter')
        var secs = ${counter}
        for (var i = 0; i < x.length; i++)
                x[i].innerText = ts(secs)
        var interval = setInterval(() => {
            secs--
            for (var i = 0; i < x.length; i++)
                x[i].innerText = ts(secs)
            if (secs <= 0) {
                clearInterval(interval)
                setTimeout(() => { location.reload() }, 1000)
            }
        }, 1000)
        `}
        
        btnRefresh.addEventListener('click', () => {
            var xhr = new XMLHttpRequest()
            xhr.open('GET', '/?refresh=true&rg=' + (chkGuide.checked ? 'true' : 'false') + '&rc=' + (chkChannels.checked ? 'true' : 'false'), true)
            xhr.onload = function () {
                location.reload()
            }
            xhr.send(null)
        })
        btnRestart.addEventListener('click', () => {
            var xhr = new XMLHttpRequest()
            xhr.open('GET', '/?restart=true&rg=' + (chkGuide.checked ? 'true' : 'false') + '&rc=' + (chkChannels.checked ? 'true' : 'false'), true)
            xhr.onload = function () {
                location.reload()
            }
            xhr.send(null)
        })
    </script>    
    `
    return str
}