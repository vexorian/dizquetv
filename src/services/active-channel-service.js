
const constants = require("../constants");

/* Keeps track of which channels are being played, calls on-demand service
 when they stop playing.
*/

class ActiveChannelService
{
    /****
     *
     **/
    constructor(onDemandService, channelService ) {
        this.cache = {};
        this.onDemandService = onDemandService;
        this.onDemandService.setActiveChannelService(this);
        this.channelService = channelService;
        this.timeNoDelta = new Date().getTime();

        this.loadChannelsForFirstTry();
        this.setupTimer();
    }

    loadChannelsForFirstTry() {
        let fun = async() => {
            try {
                let numbers = await this.channelService.getAllChannelNumbers();
                numbers.forEach( (number) => {
                    this.ensure(this.timeNoDelta, number);
                } );
                this.checkChannels();
            } catch (err) {
                console.error("Unexpected error when checking channels for the first time.", err);
            }
        }
        fun();
    }

    async shutdown() {
        try {
            let t = new Date().getTime() - constants.FORGETFULNESS_BUFFER;
            for (const [channelNumber, value] of Object.entries(this.cache)) {
                console.log("Forcefully registering channel " + channelNumber + " as stopped...");
                delete this.cache[ channelNumber ];
                await this.onDemandService.registerChannelStopped( channelNumber, t , true);
            }
        } catch (err) {
            console.error("Unexpected error when shutting down active channels service.", err);
        }
    }

    setupTimer() {
        this.handle = setTimeout( () => this.timerLoop(),   constants.PLAYED_MONITOR_CHECK_FREQUENCY );
    }

    checkChannel(t, channelNumber, value) {
        if (value.active === 0) {
            let delta = t - value.lastUpdate;
            if ( (delta >= constants.MAX_CHANNEL_IDLE) ||  (value.lastUpdate <= this.timeNoDelta) ) {
                console.log("Channel : " + channelNumber + " is not playing...");
                onDemandService.registerChannelStopped(channelNumber, value.stopTime);
                delete this.cache[channelNumber];
            }
        }
    }

    checkChannels() {
        let t = new Date().getTime();
        for (const [channelNumber, value] of Object.entries(this.cache)) {
            this.checkChannel(t, channelNumber, value);
        }
    }

    timerLoop() {
        try {
            this.checkChannels();
        } catch (err) {
            console.error("There was an error in active channel timer loop", err);
        } finally {
            this.setupTimer();
        }

    }


    registerChannelActive(t, channelNumber) {
        this.ensure(t, channelNumber);
        if (this.cache[channelNumber].active === 0) {
            console.log("Channel is being played: " + channelNumber );
        }
        this.cache[channelNumber].active++;
        //console.log(channelNumber + " ++active=" + this.cache[channelNumber].active );
        this.cache[channelNumber].stopTime = 0;
        this.cache[channelNumber].lastUpdate =  new Date().getTime();
    }

    registerChannelStopped(t, channelNumber) {
        this.ensure(t, channelNumber);
        if (this.cache[channelNumber].active === 1) {
            console.log("Register that channel is no longer being played: " + channelNumber );
        }
        if (this.cache[channelNumber].active === 0) {
            console.error("Serious issue with channel active service, double delete");
        } else {
            this.cache[channelNumber].active--;
            //console.log(channelNumber + " --active=" + this.cache[channelNumber].active );
            let s = this.cache[channelNumber].stopTime;
            if ( (typeof(s) === 'undefined') || (s < t) ) {
                this.cache[channelNumber].stopTime = t;
            }
            this.cache[channelNumber].lastUpdate = new Date().getTime();
        }
    }

    ensure(t, channelNumber) {
        if (typeof(this.cache[channelNumber]) === 'undefined') {
            this.cache[channelNumber] = {
                active: 0,
                stopTime: t,
                lastUpdate: t,
            }
        }
    }

    peekChannel(t, channelNumber) {
        this.ensure(t, channelNumber);
    }

    isActiveWrapped(channelNumber) {
        if (typeof(this.cache[channelNumber]) === 'undefined') {
            return false;
        }
        if (typeof(this.cache[channelNumber].active) !== 'number') {
            return false;
        }
        return (this.cache[channelNumber].active !== 0);

    }

    isActive(channelNumber) {
        let bol = this.isActiveWrapped(channelNumber);
        return bol;
        

    }

    
}

module.exports = ActiveChannelService
