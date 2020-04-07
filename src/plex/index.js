const request = require('request')
const xmlParser = require('xml2json')
const config = require('config-yml')
const path = require('path')
const requests = require('./requests')
const playlists = require('./channels')

const plex = function (opts, callback) {

    if (typeof opts.username === 'undefined' || typeof opts.password === 'undefined')
        return callback({ err: "Error - No Username or Password was provided" })
    if (typeof opts.hostname === 'undefined' || typeof opts.port === 'undefined')
        return callback({ err: "Error - No Hostname or Port was provided" })

    const OPTIONS = {
        HOSTNAME: opts.hostname,
        PORT: opts.port,
        CLIENT_ID: 'rg14zekk3pa5zp4safjwaa8z',
        PRODUCT: 'PseudoTV',
        VERSION: '0.1',
        DEVICE: 'PseudoTV - JS',
        PLATFORM: 'Chrome',
        PLATFORM_VERSION: '80.0'
    }

    // Login via plex.tv, return client via callback
    request(requests.login(opts.username, opts.password, OPTIONS), (err, res, body) => {
        if (err || res.statusCode !== 201)
            return callback({ err: "Unauthorized - Username/Email and Password is incorrect!." })
        var _client = client()
        _client.authToken = JSON.parse(body).user.authToken
        _client.Get('/', (result) => {
            if (result.err)
                return callback({ err: "Failed to connect to server." })
            _client._poll()
            _client.serverId = result.result.MediaContainer.machineIdentifier
            callback({ client: _client })
        })
    })
    const client = function () {
        var _this = this
        _this.OPTIONS = OPTIONS
        // Private
        _this._killed = false
        _this.serverId = ''
        _this.authToken = ''
        _this._poll = function () {
            request(requests.poll(_this), (err, res) => {
                if (!_this._killed && !err && res.statusCode === 200)
                    _this._poll() // recurse, plex returns response every 20 seconds.
            })
        }

        _this._updateTimeline = (item, playQueueItemID, state, time, cb) => {
            var callback = typeof cb === 'function' ? cb : () => { }

            request(requests.timeline(_this, item, playQueueItemID, state, time), (err, res) => {
                if (err || res.statusCode !== 200)
                    callback({ err: "Get Request Failed" })
                else
                    callback({ result: JSON.parse(xmlParser.toJson(res.body, { arrayNotation: true })) })
            })
        }
        _this._createPlayQueue = function (key, callback) {

            request(requests.queue(_this, key), (err, res) => {
                if (err && res.statusCode !== 200)
                    callback({ err: "Post Request Failed" })
                else
                    callback({ result: JSON.parse(res.body) })
            })
        }
        _this._getTranscodeURL = (item) => {
            return requests.transcode(_this, item)
        }

        _this._refreshGuide = (dvrID) => {
            request(requests.refreshGuide(_this, dvrID))
        }

        _this._refreshChannels = (dvrID, channels) => {
            request(requests.refreshChannels(_this, dvrID, channels))
        }

        // Public
        _this.Close = () => { _this._killed = true }

        _this.Get = function (path, callback) {
            request(requests.get(_this, path), (err, res) => {
                if (err || res.statusCode !== 200)
                    callback({ err: "Get Request Failed" })
                else
                    callback({ result: JSON.parse(res.body) })
            })
        }

        _this.Transcode = function (item, msElapsed, cb) {
            _createPlayQueue(item.key, (res) => {
                if (res.err)
                    cb(res)
                var playQueueID = res.result.MediaContainer.playQueueID
                _updateTimeline(item, playQueueID, 'playing', msElapsed)
                var stop = () => { _updateTimeline(item, playQueueID, 'stopped', 0) }
                var update = (_msElapsed) => { _updateTimeline(item, playQueueID, 'playing', _msElapsed) }
                cb({ result: { url: _getTranscodeURL(item), stop: stop, update: update }})
            })
        }

        _this.PseudoTVChannelScan = function (cb) {
            playlists.getPsuedoTVPlaylists(_this, (lineup) => {
                playlists.getAllPlaylistsInfo(_this, lineup, cb)
            })
        }

        _this.RefreshGuide = function () {
            GetPseudoTVDVRS((result) => {
                var dvrs = result.result
                dvrs = typeof dvrs === 'undefined' ? [] : dvrs
                for (var i = 0; i < dvrs.length; i++) {
                    var xmlfile = dvrs[i].lineup.split('lineup://tv.plex.providers.epg.xmltv/')
                    xmlfile = xmlfile[xmlfile.length - 1].split('#')[0]
                    if (path.resolve(xmlfile) === path.resolve(config.XMLTV_FILE)) {
                        _refreshGuide(dvrs[i].key)
                    }
                }   
            })
        }
        _this.RefreshChannels = function (channels) {
            GetPseudoTVDVRS((result) => {
                var dvrs = result.result
                dvrs = typeof dvrs === 'undefined' ? [] : dvrs
                for (var i = 0; i < dvrs.length; i++) {
                    for (var y = 0; y < dvrs[i].Device.length; y++) {
                        _refreshChannels(dvrs[i].Device[y].key, channels)
                    }
                }
            })
        }
        _this.GetPseudoTVDVRS = function (cb) {
            Get('/livetv/dvrs', (result) => {
                if (result.err)
                    return cb(result)
                var dvrs = result.result.MediaContainer.Dvr
                dvrs = typeof dvrs === 'undefined' ? [] : dvrs
                var _dvrs = []
                for (var i = 0; i < dvrs.length; i++) {
                    var xmlfile = dvrs[i].lineup.split('lineup://tv.plex.providers.epg.xmltv/')
                    xmlfile = xmlfile[xmlfile.length - 1].split('#')[0]
                    if (path.resolve(xmlfile) === path.resolve(config.XMLTV_FILE))
                        _dvrs.push(dvrs[i])
                }
                cb({result: _dvrs})
            })
        }
        return _this
    }
}

module.exports = plex