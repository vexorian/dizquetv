const queryString = require('query-string')
const config = require('config-yml')

module.exports = {
    login: login,
    poll: poll,
    get: get,
    timeline: timeline,
    queue: queue,
    transcode: transcode,
    refreshGuide: refreshGuide,
    refreshChannels: refreshChannels
}

function login(username, password, OPTIONS) {
    return {
        method: 'post',
        url: 'https://plex.tv/users/sign_in.json',
        headers: {
            'X-Plex-Platform': OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': OPTIONS.PLATFORM_VERSION,
            'X-Plex-Provides': 'timeline,playback,navigation,mirror,playqueues',
            'X-Plex-Client-Identifier': OPTIONS.CLIENT_ID,
            'X-Plex-Product': OPTIONS.PRODUCT,
            'X-Plex-Version': OPTIONS.VERSION,
            'X-Plex-Device': OPTIONS.DEVICE,
            'X-Plex-Device-Name': OPTIONS.DEVICE
        },
        form: {
            user: {
                login: username,
                password: password
            }
        }
    }
}

function poll(_client) {
    return {
        method: 'get',
        url: `http://${OPTIONS.HOSTNAME}:${OPTIONS.PORT}/player/proxy/poll`,
        qs: {
            deviceClass: 'pc',
            protocolVersion: 3,
            protocolCapabilities: 'timeline,playback,navigation,mirror,playqueues',
            timeout: 1,
            'X-Plex-Provides': 'timeline,playback,navigation,mirror,playqueues',
            'X-Plex-Product': _client.OPTIONS.PRODUCT,
            'X-Plex-Version': _client.OPTIONS.VERSION,
            'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
            'X-Plex-Platform': _client.OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
            'X-Plex-Sync-Version': 2,
            'X-Plex-Features': 'external-media,internal-media',
            'X-Plex-Device': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
            'X-Plex-Token': _client.authToken
        }
    }
}

function get(_client, path) {
    return {
        method: 'get',
        url: `http://${OPTIONS.HOSTNAME}:${OPTIONS.PORT}${path}`,
        headers: {
            'Accept': 'application/json',
            'X-Plex-Token': _client.authToken,
            'X-Plex-Device': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
            'X-Plex-Product': _client.OPTIONS.PRODUCT,
            'X-Plex-Version': _client.OPTIONS.VERSION,
            'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
            'X-Plex-Platform': _client.OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
        }
    }
}

function timeline(_client, item, pQid, state, time) {
    return {
        method: 'get',
        url: `http://${_client.OPTIONS.HOSTNAME}:${_client.OPTIONS.PORT}/:/timeline`,
        qs: {
            ratingKey: item.ratingKey,
            key: item.key,
            playbackTime: 0,
            playQueueItemID: pQid,
            state: state,
            hasMDE: 1,
            time: time,
            duration: item.duration,
            'X-Plex-Session-Identifier': config.PLEX_SESSION_ID,
            'X-Plex-Token': _client.authToken,
            'X-Plex-Device': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
            'X-Plex-Product': _client.OPTIONS.PRODUCT,
            'X-Plex-Version': _client.OPTIONS.VERSION,
            'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
            'X-Plex-Platform': _client.OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
            'X-Plex-Sync-Version': 2,
            'X-Plex-Features': 'external-media,indirect-media',
            'X-Plex-Model': 'bundled',
            'X-Plex-Device-Screen-Resolution': '1920x1080',
            'X-Plex-Language': 'en',
            'X-Plex-Text-Format': 'plain',
            'X-Plex-Provider-Version': '1.3',
            'X-Plex-Drm': 'widevine'
        }
    }
}

function queue(_client, key) {
    return {
        method: 'post',
        url: `http://${_client.OPTIONS.HOSTNAME}:${_client.OPTIONS.PORT}/playQueues`,
        headers: {
            'Accept': 'application/json',
        },
        qs: {
            type: 'video',
            extrasPrefixCount: 0,
            uri: `server://${_client.serverId}/com.plexapp.plugins.library${key}`,
            repeat: 0,
            own: 1,
            includeChapters: 1,
            includeGeolocation: 1,
            includeExternalMedia: 1,
            'X-Plex-Token': _client.authToken,
            'X-Plex-Device': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
            'X-Plex-Product': _client.OPTIONS.PRODUCT,
            'X-Plex-Version': _client.OPTIONS.VERSION,
            'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
            'X-Plex-Platform': _client.OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
            'X-Plex-Sync-Version': 2,
            'X-Plex-Features': 'external-media,indirect-media',
            'X-Plex-Model': 'bundled',
            'X-Plex-Device-Screen-Resolution': '1920x1080',
            'X-Plex-Language': 'en',
            'X-Plex-Text-Format': 'plain',
            'X-Plex-Provider-Version': '1.3',
            'X-Plex-Drm': 'widevine'
        }
    }
}

function transcode(_client, item) {
    return queryString.stringifyUrl({
        url: `http://${_client.OPTIONS.HOSTNAME}:${_client.OPTIONS.PORT}/video/:/transcode/universal/start.mpd`,
        query: {
            hasMDE: 1,
            path: item.key,
            mediaIndex: 0,
            partIndex: 0,
            protocol: 'dash',
            fastSeek: 1,
            directPlay: 0,
            directStream: 0,
            subtitleSize: 100,
            audioBoost: 100,
            location: 'lan',
            addDebugOverlay: 0,
            autoAdjustQuality: 0,
            directStreamAudio: 1,
            mediaBufferSize: 102400,
            session: 'wtfisthisusedfor',
            subtitles: 'burn',
            'Accept-Language': 'en',
            'X-Plex-Session-Identifier': config.PLEX_SESSION_ID,
            'X-Plex-Client-Profile-Extra': 'append-transcode-target-codec(type=videoProfile&context=streaming&audioCodec=aac&protocol=dash)',
            //'X-Plex-Client-Profile-Extra': 'add-limitation(scope=videoCodec&scopeName=*&type=upperBound&name=video.bitrate&value=4000&replace=true)+append-transcode-target-codec(type=videoProfile&context=streaming&audioCodec=aac&protocol=dash)',
            'X-Plex-Product': _client.OPTIONS.PRODUCT,
            'X-Plex-Version': _client.OPTIONS.VERSION,
            'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
            'X-Plex-Platform': _client.OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
            'X-Plex-Sync-Version': 2,
            'X-Plex-Features': 'external-media,indirect-media',
            'X-Plex-Device': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
            'X-Plex-Model': 'bundled',
            'X-Plex-Device-Screen-Resolution': '1920x1080,1920x1080',
            'X-Plex-Token': _client.authToken,
            'X-Plex-Language': 'en'
        }
    })
}

function refreshGuide(_client, dvrID) {
    return {
        method: 'post',
        url: `http://${_client.OPTIONS.HOSTNAME}:${_client.OPTIONS.PORT}/livetv/dvrs/${dvrID}/reloadGuide`,
        headers: {
            'Accept': 'application/json',
        },
        qs: {
            'X-Plex-Product': _client.OPTIONS.PRODUCT,
            'X-Plex-Version': _client.OPTIONS.VERSION,
            'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
            'X-Plex-Platform': _client.OPTIONS.PLATFORM,
            'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
            'X-Plex-Sync-Version': 2,
            'X-Plex-Features': 'external-media,indirect-media',
            'X-Plex-Model': 'bundled',
            'X-Plex-Device': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
            'X-Plex-Device-Screen-Resolution': '1920x1080,1920x1080',
            'X-Plex-Token': _client.authToken,
            'X-Plex-Language': 'en'
        }
    }
}

function refreshChannels(_client, dvrID, channels) {
    var qs = {
        'X-Plex-Product': _client.OPTIONS.PRODUCT,
        'X-Plex-Version': _client.OPTIONS.VERSION,
        'X-Plex-Client-Identifier': _client.OPTIONS.CLIENT_ID,
        'X-Plex-Platform': _client.OPTIONS.PLATFORM,
        'X-Plex-Platform-Version': _client.OPTIONS.PLATFORM_VERSION,
        'X-Plex-Sync-Version': 2,
        'X-Plex-Features': 'external-media,indirect-media',
        'X-Plex-Model': 'bundled',
        'X-Plex-Device': _client.OPTIONS.DEVICE,
        'X-Plex-Device-Name': _client.OPTIONS.DEVICE,
        'X-Plex-Device-Screen-Resolution': '1920x1080,1920x1080',
        'X-Plex-Token': _client.authToken,
        'X-Plex-Language': 'en'
    }
    var _channels = []
    for (var i = 0; i < channels.length; i ++)
        _channels.push(channels[i].channel)
    qs.channelsEnabled = _channels.join(',')
    for (var i = 0; i < _channels.length; i ++) {
        qs[`channelMapping[${_channels[i]}]`] = _channels[i]
        qs[`channelMappingByKey[${_channels[i]}]`] = _channels[i]
    }
    return {
        method: 'put',
        url: `http://${_client.OPTIONS.HOSTNAME}:${_client.OPTIONS.PORT}/media/grabbers/devices/${dvrID}/channelmap`,
        headers: {
            'Accept': 'application/json',
        },
        qs: qs
    }
}