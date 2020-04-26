const request = require('request')
class Plex {
    constructor(opts) {
        this._token = typeof opts.token !== 'undefined' ? opts.token : ''
        this._server = {
            host: typeof opts.host !== 'undefined' ? opts.host : '127.0.0.1',
            port: typeof opts.port !== 'undefined' ? opts.port : '32400',
            protocol: typeof opts.protocol !== 'undefined' ? opts.protocol : 'http'
        }
        this._headers = {
            'Accept': 'application/json',
            'X-Plex-Device': 'PseudoTV',
            'X-Plex-Device-Name': 'PseudoTV',
            'X-Plex-Product': 'PseudoTV',
            'X-Plex-Version': '0.1',
            'X-Plex-Client-Identifier': 'rg14zekk3pa5zp4safjwaa8z',
            'X-Plex-Platform': 'Chrome',
            'X-Plex-Platform-Version': '80.0'
        }
    }

    get URL() { return `${this._server.protocol}://${this._server.host}:${this._server.port}` }

    SignIn(username, password) {
        return new Promise((resolve, reject) => {
            if (typeof username === 'undefined' || typeof password === 'undefined')
                reject("Plex 'SignIn' Error - No Username or Password was provided to sign in.")
            var req = {
                method: 'post',
                url: 'https://plex.tv/users/sign_in.json',
                headers: this._headers,
                form: {
                    user: {
                        login: username,
                        password: password
                    }
                },
                jar: false
            }
            request(req, (err, res, body) => {
                if (err || res.statusCode !== 201)
                    reject("Plex 'SignIn' Error - Username/Email and Password is incorrect!.")
                else {
                    this._token = JSON.parse(body).user.authToken
                    resolve({ token: this._token })
                }
            })
        })
    }
    Get(path, optionalHeaders = {}) {
        var req = {
            method: 'get',
            url: `${this.URL}${path}`,
            headers: this._headers,
            jar: false
        }
        Object.assign(req, optionalHeaders)
        req.headers['X-Plex-Token'] = this._token
        return new Promise((resolve, reject) => {
            if (this._token === '')
                reject("No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.")
            else
                request(req, (err, res) => {
                    if (err || res.statusCode !== 200)
                        reject(`Plex 'Get' request failed. URL: ${this.URL}${path}`)
                    else
                        resolve(JSON.parse(res.body).MediaContainer)
                })
        })
    }
    Put(path, query = {}, optionalHeaders = {}) {
        var req = {
            method: 'put',
            url: `${this.URL}${path}`,
            headers: this._headers,
            qs: query,
            jar: false
        }
        Object.assign(req, optionalHeaders)
        req.headers['X-Plex-Token'] = this._token
        return new Promise((resolve, reject) => {
            if (this._token === '')
                reject("No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.")
            else
                request(req, (err, res) => {
                    if (err || res.statusCode !== 200)
                        reject(`Plex 'Put' request failed. URL: ${this.URL}${path}`)
                    else
                        resolve(res.body)
                })
        })
    }
    Post(path, query = {}, optionalHeaders = {}) {
        var req = {
            method: 'post',
            url: `${this.URL}${path}`,
            headers: this._headers,
            qs: query,
            jar: false
        }
        Object.assign(req, optionalHeaders)
        req.headers['X-Plex-Token'] = this._token
        return new Promise((resolve, reject) => {
            if (this._token === '')
                reject("No Plex token provided. Please use the SignIn method or provide a X-Plex-Token in the Plex constructor.")
            else
                request(req, (err, res) => {
                    if (err || res.statusCode !== 200)
                        reject(`Plex 'Post' request failed. URL: ${this.URL}${path}`)
                    else
                        resolve(res.body)
                })
        })
    }
    GetDVRS = async function () {
        var result = await this.Get('/livetv/dvrs')
        var dvrs = result.Dvr
        dvrs = typeof dvrs === 'undefined' ? [] : dvrs
        return dvrs
    }
    RefreshGuide = async function (_dvrs) {
        var dvrs = typeof _dvrs !== 'undefined' ? _dvrs : await this.GetDVRS()
        for (var i = 0; i < dvrs.length; i++)
            this.Post(`/livetv/dvrs/${dvrs[i].key}/reloadGuide`).then(() => { }, (err) => { console.log(err) })
    }
    RefreshChannels = async function (channels, _dvrs) {
        var dvrs = typeof _dvrs !== 'undefined' ? _dvrs : await this.GetDVRS()
        var _channels = []
        let qs = {}
        for (var i = 0; i < channels.length; i++)
            _channels.push(channels[i].number)
        qs.channelsEnabled = _channels.join(',')
        for (var i = 0; i < _channels.length; i++) {
            qs[`channelMapping[${_channels[i]}]`] = _channels[i]
            qs[`channelMappingByKey[${_channels[i]}]`] = _channels[i]
        }
        for (var i = 0; i < dvrs.length; i++)
            for (var y = 0; y < dvrs[i].Device.length; y++)
                this.Put(`/media/grabbers/devices/${dvrs[i].Device[y].key}/channelmap`, qs).then(() => { }, (err) => { console.log(err) })
    }
}

module.exports = Plex