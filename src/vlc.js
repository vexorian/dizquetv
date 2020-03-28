const Router = require('express').Router
const spawn = require('child_process').spawn
const request = require('request')
const config = require('config-yml')

const xmltv = require('./xmltv')

module.exports = { router: vlcRouter }

function vlcRouter() {
    var router = Router()
    var streams = []

    router.get('/video', (req, res) => {
        var programs = xmltv.readXMLPrograms()
        if (!req.query.channel)
            return res.status(422).send("No channel queried")

        req.query.channel = req.query.channel.split('?')[0]
        var streamIndex = -1
        for (var i = 0; i < streams.length; i++) {
            if (streams[i].channel === req.query.channel) {
                streamIndex = i
                break
            }
        }

        if (streamIndex != -1) {
            streams[streamIndex].viewers++
            request('http://' + config.HOST + ':' + streams[streamIndex].port + '/').on('error', (err) => {/* ignore errors  */}).pipe(res)
        } else {
            var args = []
            var startPos = 0
            var programIndex = 0
            for (var i = 0; i < programs.length; i++) {
                var date = new Date()
                if (programs[i].start <= date && programs[i].stop >= date && programs[i].channel == req.query.channel) {
                    var dif = date.getTime() - programs[i].start.getTime()
                    startPos = dif / 1000
                    programIndex = i
                    break
                }
            }
            for (var i = programIndex; i < programs.length; i++)
                if (programs[i].channel == req.query.channel)
                    args.push(programs[i].video)

            if (args.length == 0)
                return res.status(422).send("Channel not found")

            var vlcPort = config.PORT + streams.length + 1

            args.push("--start-time=" + startPos)
            if (programs.optimized)
                args.push(`--sout=#http{mux=ts,dst=:${vlcPort}/}`)
            else
                args.push(`--sout=#${config.VLC_TRANSCODE_SETTINGS}:http{mux=ts,dst=:${vlcPort}/}`)
            if (config.VLC_HIDDEN)
                args.push("--intf=dummy")


            var vlcExe = spawn(config.VLC_EXECUTABLE, args)
            var stream = { vlcExe: vlcExe, channel: req.query.channel, viewers: 1, port: vlcPort }
            streamIndex = streams.length
            streams.push(stream)
            setTimeout(() => {
                request(`http://${config.HOST}:${vlcPort}/`).on('error', function (err) {/* ignore errors  */}).pipe(res)
            }, config.VLC_STARTUP_DELAY)
        }

        res.on('close', () => {
            streams[streamIndex].viewers--
            if (streams[streamIndex].viewers == 0) {
                streams[streamIndex].vlcExe.kill()
                streams.splice(streamIndex, 1)
            }
        })
    })

    return router
}