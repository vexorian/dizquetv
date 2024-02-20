const events = require('events')
const constants = require("../constants");
const  FALLBACK_ICON = "https://raw.githubusercontent.com/vexorain/dizquetv/main/resources/dizquetv.png";
const throttle = require('./throttle');

class TVGuideService extends events.EventEmitter
{
    /****
     *
     **/
    constructor(xmltv, db, cacheImageService, eventService, i18next) {
        super();
        this.cached = null;
        this.lastUpdate = 0;
        this.updateTime = 0;
        this.currentUpdate = -1;
        this.currentLimit = -1;
        this.currentChannels = null;
        this.xmltv = xmltv;
        this.db = db;
        this.cacheImageService = cacheImageService;
        this.eventService = eventService;
        this._throttle = throttle;
        this.i18next = i18next;
    }

    async get() {
        while (this.cached == null) {
            await _wait(100);
        }

        return this.cached;
    }

    prepareRefresh(inputChannels, limit) {
        let t = (new Date()).getTime();
        this.updateTime = t;
        this.updateLimit = t + limit;

        let channels = [];
        for (let i = 0; i < inputChannels.length; i++) {
            if (typeof(inputChannels[i]) !== 'undefined') {
                channels.push(inputChannels[i]);
            } else {
                console.error(`There is an issue with one of the channels provided to TV-guide service, it will be ignored: ${i}` );
            }
        }
        this.updateChannels = channels;
        return t;
    }

    async refresh(t) {
        while( this.lastUpdate < t) {
            await _wait(5000);
            if ( ( this.lastUpdate < t) && (this.currentUpdate == -1) ) {
                this.currentUpdate = this.updateTime;
                this.currentLimit = this.updateLimit;
                this.currentChannels = this.updateChannels;
                let t = "" + ( (new Date()) );
                eventService.push(
                    "xmltv",
                    {
                        "message": `Started building tv-guide at = ${t}`,
                        "module" : "xmltv",
                        "detail" : {
                            "time": new Date(),
                        },
                        "level" : "info"
                    }
                );
        
                await this.buildIt();
            }
        }
        return await this.get();
    }

    async makeAccumulated(channel) {
        if (typeof(channel.programs) === 'undefined') {
            throw Error( JSON.stringify(channel).slice(0,200) );
        }
        let n = channel.programs.length;
        let arr = new Array( channel.programs.length + 1);
        arr[0] = 0;
        for (let i = 0; i < n; i++) {
            let d = channel.programs[i].duration;
            if (d == 0) {
                console.log("Found program with duration 0, correcting it");
                d = 1;
            }
            if (! Number.isInteger(d) ) {
                console.log( `Found program in channel ${channel.number} with non-integer duration ${d}, correcting it`);
                d = Math.ceil(d);
            }
            channel.programs[i].duration = d;
            arr[i+1] =  arr[i] + d;
            await this._throttle();
        }
        return arr;
    }

    async getCurrentPlayingIndex(channel, t) {
        let s = (new Date(channel.startTime)).getTime();
        if ( (typeof(channel.onDemand) !== 'undefined') && channel.onDemand.isOnDemand && channel.onDemand.paused ) {
            // it's as flex
            return {
                index : -1,
                start : t,
                program : {
                    isOffline : true,
                    duration : 12*60*1000,
                }
            }
        }
        if (t < s) {
            //it's flex time
            return {
                index : -1,
                start : t,
                program : {
                    isOffline : true,
                    duration : s - t,
                }
            }
        } else {
            let accumulate = this.accumulateTable[ channel.number ];
            if (typeof(accumulate) === 'undefined') {
                throw Error(channel.number + " wasn't preprocesed correctly???!?");
            }
            if (accumulate[channel.programs.length] === 0) {
                console.log("[tv-guide] for some reason the total channel length is 0");
                return {
                    index : -1,
                    start: t,
                    program: {
                        isOffline: true,
                        duration: 15*60*1000,
                    }
                }
            }
            let hi = channel.programs.length;
            let lo = 0;
            let d = (t - s) % (accumulate[channel.programs.length]);
            let epoch = t - d;
            while (lo + 1 < hi) {
                let ha = Math.floor( (lo + hi)  / 2 );
                if (accumulate[ha] > d) {
                    hi = ha;
                } else {
                    lo = ha;
                }
            }

            if ( (lo < 0) || (lo >= channel.programs.length) || (accumulate[lo+1] <= d) ) {
                console.log("[tv-guide] The binary search algorithm is messed up. Replacing with flex...");
                return {
                    index : -1,
                    start: t,
                    program: {
                        isOffline: true,
                        duration: 15*60*1000,
                    }
                }
            }

            await this._throttle();
            return {
                index: lo,
                start: epoch + accumulate[lo],
                program: channel.programs[lo],
            }
        }
    }

    async getChannelPlaying(channel, previousKnown, t, depth) {
        if (typeof(depth) === 'undefined') {
            depth = [];
        }
        let playing = {};
        if (
            (typeof(previousKnown) !== 'undefined')
             && (previousKnown.index !== -1)
             && (previousKnown.program.duration == channel.programs[previousKnown.index].duration )
             && (previousKnown.start + previousKnown.program.duration == t)
        ) {
            //turns out we know the index.
            let index = (previousKnown.index + 1) % channel.programs.length;
            playing = {
                index : index,
                program: channel.programs[index],
                start : t,
            }
        } else {
            playing = await this.getCurrentPlayingIndex(channel, t);
        }
        if ( (playing.program == null) || (typeof(playing) === 'undefined') ) {
            console.log("There is a weird issue with the TV guide generation. A placeholder program is placed to prevent further issues. Please report this.");
            playing = {
                index: -1,
                program: {
                    isOffline: true,
                    duration: 30*60*1000,
                },
                start: t
            }
        }
        if ( playing.program.isOffline && playing.program.type === 'redirect') {
            let ch2 = playing.program.channel;
            
            if (depth.indexOf(ch2) != -1) {
                console.error("Redirrect loop found! Involved channels = " + JSON.stringify(depth) );
            } else {
                depth.push( channel.number );
                let channel2 = this.channelsByNumber[ch2];
                if (typeof(channel2) === 'undefined') {
                    console.error("Redirrect to an unknown channel found! Involved channels = " + JSON.stringify(depth) );
                } else {
                    let otherPlaying = await this.getChannelPlaying( channel2, undefined, t, depth );
                    let a1 =  playing.start;
                    let b1 =  a1 + playing.program.duration;

                    let a2 =  otherPlaying.start;
                    let b2 =  a2 + otherPlaying.program.duration;

                    if ( !(a1 <= t && t < b1) ) {
                        console.error("[tv-guide] algorithm error1 : " + a1 + ", " + t + ", " + b1 );
                    }
                    if ( !(a2 <= t && t < b2) ) {
                        console.error("[tv-guide] algorithm error2 : " + a2 + ", " + t + ", " + b2 );
                    }

                    let a = Math.max( a1, a2 );
                    let b = Math.min( b1, b2 );

                    let start = a;
                    let duration = b - a;
                    let program2 = clone( otherPlaying.program );
                    program2.duration = duration;
                    playing = {
                        index: playing.index,
                        start : start,
                        program: program2,
                    }
                }
            }
        }
        return playing;
    }

    async getChannelPrograms(t0, t1, channel)  {
        if (typeof(channel) === 'undefined') {
            throw Error("Couldn't find channel?");
        }
        let result = {
            channel: makeChannelEntry(channel),
        };
        let programs = [];
        let x = await this.getChannelPlaying(channel, undefined, t0);
        if (x.program.duration == 0) throw Error("A " + channel.name + " " + JSON.stringify(x) );

        let melded = 0;

        let push = async (x) => {
            await this._throttle();
            if (
                (programs.length > 0)
                && isProgramFlex(x.program, channel)
                && (
                    (x.program.duration <= constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS)
                    || isProgramFlex(programs[ programs.length - 1].program, channel)
                )
            ) {
                //meld with previous
                let y = clone( programs[ programs.length - 1] );
                y.program.duration += x.program.duration;
                melded += x.program.duration;
                if (
                    (melded > constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS)
                    && !isProgramFlex(programs[ programs.length - 1].program, channel)
                ) {
                    y.program.duration -= melded;
                    programs[ programs.length - 1] = y;
                    if (y.start + y.program.duration < t1) {
                        programs.push( {
                            start: y.start + y.program.duration,
                            program: {
                                isOffline : true,
                                duration: melded,
                            },
                        } );
                    }
                    melded = 0;
                } else {
                    programs[ programs.length - 1] = y;
                }
            } else if (isProgramFlex(x.program, channel) ) {
                melded = 0;
                programs.push( {
                    start: x.start,
                    program: {
                        isOffline : true,
                        duration: x.program.duration,
                    },
                } );
            } else {
                melded = 0;
                programs.push(x);
            }
        };
        while (x.start < t1) {
            await push(x);
            let t2 = x.start + x.program.duration;
            x = await this.getChannelPlaying(channel, x, t2);
            if (x.start < t2) {
                let d = t2 - x.start;
                x.start = t2;
                x.program = clone(x.program);
                x.program.duration -= d;
            }
            if (x.program.duration == 0) {
                console.error(channel.number + " There's a program with duration 0? " + JSON.stringify(x.program) + " ; " + t1 );
                x.program.duration = 5 * 60 * 1000;
            } else if ( !  Number.isInteger( x.program.duration ) ) {
                console.error(channel.number + " There's a program with non-integer duration?? " + JSON.stringify(x.program) + " ; " + t1 );
                x.program = JSON.parse( JSON.stringify(x.program) );
                x.program.duration = Math.ceil(x.program.duration );
            }
        }
        result.programs = [];
        for (let i = 0; i < programs.length; i++) {
            await this._throttle();
            if (isProgramFlex( programs[i].program, channel) ) {
                let start = programs[i].start;
                let duration = programs[i].program.duration;
                if (start <= t0) {
                    const M = 5*60*1000;
                    let newStart = t0 - t0%M;
                    if (start < newStart) {
                        duration -= (newStart - start);
                        start = newStart;
                    }
                }
                while( start < t1 && duration > 0) {
                    let d = Math.min(duration, constants.TVGUIDE_MAXIMUM_FLEX_DURATION);
                    if (duration - constants.TVGUIDE_MAXIMUM_FLEX_DURATION <= constants.TVGUIDE_MAXIMUM_PADDING_LENGTH_MS) {
                        d = duration;
                    }
                    let x = {
                        start: start,
                        program: {
                            isOffline: true,
                            duration: d,
                        }
                    }
                    duration -= d;
                    start += d;
                    result.programs.push( makeEntry(channel,x) );
                }
            } else {
                            result.programs.push( makeEntry(channel, programs[i] ) );
            }
        }
         
        return result;
    }

    async buildItManaged() {
        let t0 = this.currentUpdate;
        let t1 = this.currentLimit;
        let channels = this.currentChannels;
        let accumulateTable = {};
        this.channelsByNumber = {};
        for (let i = 0; i < channels.length; i++) {
            this.channelsByNumber[ channels[i].number ] = channels[i];
            accumulateTable[ channels[i].number ] = await this.makeAccumulated(channels[i]);
        }
        this.accumulateTable = accumulateTable;
        let result = {};
        if (channels.length == 0) {
            let channel = {
                name: "dizqueTV",
                icon: FALLBACK_ICON,
            }
            result[1] = {
                channel : channel,
                programs: [
                    makeEntry(
                      channel
                      , {
                        start: t0 - t0 % (30 * 60*1000),
                        program: {
                            duration: 24*60*60*1000,
                            icon: FALLBACK_ICON,
                            showTitle: this.i18next.t("tvGuide.no_channels"),
                            date: formatDateYYYYMMDD(new Date()),
                            summary : this.i18next.t("tvGuide.no_channels_summary")
                        }
                      } )
                ]
            }
        } else {
            for (let i = 0; i < channels.length; i++) {
              if(! channels[i].stealth) {
                let programs = await this.getChannelPrograms(t0, t1, channels[i] );
                result[ channels[i].number ] = programs;
              }
            }
        }
        return result;
    }

    async buildIt(lastRetry) {
        try {
            this.cached = await this.buildItManaged();
            console.log("Internal TV Guide data refreshed at " + (new Date()).toLocaleString() );
            await this.refreshXML();
        } catch(err) {
            console.error("Unable to update internal guide data", err);
            let w = 100;
            if (typeof(lastRetry) !== 'undefined') {
                w = Math.min(w*2, 5 * 60 * 1000);
            }
            await _wait(w);
            console.error("Retrying TV guide...");
            await this.buildIt();

        } finally {
            this.lastUpdate = this.currentUpdate;
            this.currentUpdate = -1;
        }
    }


    async refreshXML() {
        let xmltvSettings = this.db['xmltv-settings'].find()[0];
        await this.xmltv.WriteXMLTV(this.cached, xmltvSettings, async() => await this._throttle(), this.cacheImageService);
        let t = "" + ( (new Date()) );
        this.emit("xmltv-updated", { time: t } );
        eventService.push(
            "xmltv",
            {
                "message": this.i18next.t("tvGuide.xmltv_updated", {t}),
                "module" : "xmltv",
                "detail" : {
                    "time": new Date(),
                },
                "level" : "info"
            }
        );

    }

    async getStatus() {
        await this.get();
        let channels =  [];

        Object.keys( this.cached )
            .forEach( (k,index) => channels.push(k) );

        return {
            lastUpdate : new Date(this.lastUpdate).toISOString(),
            channelNumbers: channels,
        }
    }

    async getChannelLineup(channelNumber, dateFrom, dateTo) {
        await this.get();
        let t0 = dateFrom.toISOString();
        let t1 = dateTo.toISOString();
        let channel = this.cached[channelNumber];
        if (typeof(channel) === undefined) {
            return null;
        }
        let programs = channel.programs;
        let result = {
            icon: channel.channel.icon,
            name: channel.channel.name,
            number: channel.channel.number,
            programs: [],
        };
        for (let i = 0; i < programs.length; i++) {
            let program = programs[i];
            let a;
            if (program.start > t0) {
                a = program.start;
            } else {
                a = t0;
            }
            let b;
            if (program.stop < t1) {
                b = program.stop;
            } else {
                b = t1;
            }

            if (a < b) {
                result.programs.push( program );
            }
        }
        return result;
    }
    
}


function _wait(t) {
    return new Promise((resolve) => {
      setTimeout(resolve, t);
    });
}


function getChannelStealthDuration(channel) {
    if (
        (typeof(channel.guideMinimumDurationSeconds) !== 'undefined')
        &&
        ! isNaN(channel.guideMinimumDurationSeconds)
    ) {
        return channel.guideMinimumDurationSeconds * 1000;
    } else {
        return constants.DEFAULT_GUIDE_STEALTH_DURATION;
    }
    
}

function isProgramFlex(program, channel) {
    return program.isOffline || program.duration <= getChannelStealthDuration(channel)
}

function clone(o) {
    return JSON.parse( JSON.stringify(o) );
}

function makeChannelEntry(channel) {
    return {
        name: channel.name,
        icon: channel.icon,
        number: channel.number,
    }
}

function makeEntry(channel, x) {
    let title = undefined;
    let icon = undefined;
    let sub = undefined;
    if (isProgramFlex(x.program, channel)) {
        if ( (typeof(channel.guideFlexPlaceholder) === 'string')
         && channel.guideFlexPlaceholder !== "") {
            title = channel.guideFlexPlaceholder;
        } else {
            title = channel.name;
        }
        icon = channel.icon;
    } else {
        title = x.program.showTitle;
        if (typeof(x.program.icon) !== 'undefined') {
            icon = x.program.icon;
        }
        if (x.program.type === 'episode') {
            sub = {
                season: x.program.season,
                episode: x.program.episode,
                title: x.program.title,
            }
        } else if (x.program.type === 'track') {
            title = x.program.title;
            // TODO: Add sub data for tracks here for XML writing
        }
    }
    if (typeof(title)==='undefined') {
        title=".";
    }
    //what data is needed here?
    return {
        start: (new Date(x.start)).toISOString(),
        stop: (new Date(x.start + x.program.duration)).toISOString(),
        summary: x.program.summary,
        date: x.program.date,
        rating: x.program.rating,
        icon: icon,
        title: title,
        sub: sub,
    }
}

function formatDateYYYYMMDD(date) {
    var year = date.getFullYear().toString();
    var month = (date.getMonth() + 101).toString().substring(1);
    var day = (date.getDate() + 100).toString().substring(1);
    return year + "-" + month + "-" + day;
}

module.exports = TVGuideService
