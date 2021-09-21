
const constants = require("../constants");

const SLACK = constants.SLACK;


class OnDemandService
{
    /****
     *
     **/
    constructor(channelService) {
        this.channelService = channelService;
        this.channelService.setOnDemandService(this);
        this.activeChannelService = null;
    }

    setActiveChannelService(activeChannelService) {
        this.activeChannelService = activeChannelService;
    }

    activateChannelIfNeeded(moment, channel) {
        if ( this.isOnDemandChannelPaused(channel) ) {
            channel = this.resumeOnDemandChannel(moment, channel);
            this.updateChannelAsync(channel);
        }
        return channel;
    }

    async registerChannelStopped(channelNumber, stopTime, waitForSave) {
        try {
            let channel = await this.channelService.getChannel(channelNumber);
            if (channel == null) {
                console.error("Could not stop channel " + channelNumber + " because it apparently no longer exists"); // I guess if someone deletes the channel just in the grace period?
                return
            }

            if ( (typeof(channel.onDemand) !== 'undefined') && channel.onDemand.isOnDemand && ! channel.onDemand.paused) {
                //pause the channel
                channel = this.pauseOnDemandChannel( channel , stopTime );
                if (waitForSave) {
                    await this.updateChannelSync(channel);
                } else {
                    this.updateChannelAsync(channel);
                }
            }
        } catch (err) {
            console.error("Error stopping channel", err);
        }
    
    }



    pauseOnDemandChannel(originalChannel, stopTime) {
        console.log("Pause on-demand channel : " + originalChannel.number);
        let channel = clone(originalChannel);
        // first find what the heck is playing
        let t = stopTime;
        let s = new Date(channel.startTime).getTime();
        let onDemand = channel.onDemand;
        onDemand.paused = true;
        if ( channel.programs.length == 0) {
            console.log("On-demand channel has no programs. That doesn't really make a lot of sense...");
            onDemand.firstProgramModulo = s % onDemand.modulo;
            onDemand.playedOffset = 0;

        } else if (t < s) {
            // the first program didn't even play.
            onDemand.firstProgramModulo = s % onDemand.modulo;
            onDemand.playedOffset = 0;
        } else {
            let i = 0;
            let total = 0;
            while (true) {
                let d = channel.programs[i].duration;
                if ( (s + total  <= t) && (t <  s + total + d) ) {
                    break;
                }
                total += d;
                i = (i + 1) % channel.programs.length;
            }
            // rotate
            let programs = [];
            for (let j = i; j < channel.programs.length; j++) {
                programs.push( channel.programs[j] );
            }
            for (let j = 0; j <i; j++) {
                programs.push( channel.programs[j] );
            }
            onDemand.firstProgramModulo = (s + total) % onDemand.modulo;
            onDemand.playedOffset = t - (s + total);
            channel.programs = programs;
            channel.startTime = new Date(s + total).toISOString();
        }
        return channel;
    }

    async updateChannelSync(channel) {
        try {
            await this.channelService.saveChannel(
                channel.number,
                channel,
                {ignoreOnDemand: true}
            );
            console.log("Channel " + channel.number + " saved by on-demand service...");
        } catch (err) {
            console.error("Error saving resumed channel: " + channel.number, err);
        }
    }

    updateChannelAsync(channel) {
        this.updateChannelSync(channel);
    }

    fixupChannelBeforeSave(channel) {
        let isActive = false;
        if (this.activeChannelService != null && this.activeChannelService.isActive(channel.number) ) {
            isActive = true;
        }
        if (typeof(channel.onDemand) === 'undefined') {
            channel.onDemand = {};
        }
        if (typeof(channel.onDemand.isOnDemand) !== 'boolean') {
            channel.onDemand.isOnDemand = false;
        }
        if ( channel.onDemand.isOnDemand !== true ) {
            channel.onDemand.modulo = 1;
            channel.onDemand.firstProgramModulo = 1;
            channel.onDemand.playedOffset = 0;
            channel.onDemand.paused = false;
        } else {
            if ( typeof(channel.onDemand.modulo) !== 'number') {
                channel.onDemand.modulo = 1;
            }
            if (isActive) {
                // if it is active, the channel isn't paused
                channel.onDemand.paused = false;
            } else {
                let s =  new Date(channel.startTime).getTime();
                channel.onDemand.paused = true;
                channel.onDemand.firstProgramModulo = s % channel.onDemand.modulo;
                channel.onDemand.playedOffset = 0;
            }

        }
    }
    
    resumeOnDemandChannel(t, originalChannel) {
        let channel = clone(originalChannel);
        console.log("Resume on-demand channel: " + channel.name);
        let programs = channel.programs;
        let onDemand = channel.onDemand;
        onDemand.paused = false; //should be the invariant
        if (programs.length == 0) {
            console.log("On-demand channel is empty. This doesn't make a lot of sense...");
            return channel;
        }
        let i = 0;
        let backupFo = onDemand.firstProgramModulo;
        
        while (i < programs.length) {
            let program = programs[i];
            if (  program.isOffline && (program.type !== 'redirect') ) {
                //skip flex
                i++;
                onDemand.playedOffset = 0;
                onDemand.firstProgramModulo = ( onDemand.firstProgramModulo + program.duration ) % onDemand.modulo;
            } else {
                break;
            }
        }
        if (i == programs.length) {
            console.log("Everything in the channel is flex... This doesn't really make a lot of sense for an onDemand channel, you know...");
            i = 0;
            onDemand.playedOffset = 0;
            onDemand.firstProgramModulo = backupFo;
        }
        // Last we've seen this channel, it was playing program #i , played the first playedOffset milliseconds.
        // move i to the beginning of the program list
        let newPrograms = []
        for (let j = i; j < programs.length; j++) {
            newPrograms.push( programs[j] );
        }
        for (let j = 0; j < i; j++) {
            newPrograms.push( programs[j] );
        }
        // now the start program is 0, and the "only" thing to do now is change the start time
        let startTime = t - onDemand.playedOffset;
        // with this startTime, it would work perfectly if modulo is 1. But what about other cases?
    
        let tm = t % onDemand.modulo;
        let pm = (onDemand.firstProgramModulo + onDemand.playedOffset) % onDemand.modulo;
        
        if (tm < pm) {
            startTime += (pm - tm);
        } else {
            let o = (tm - pm);
            startTime = startTime - o;
            //It looks like it is convenient to make the on-demand a bit more lenient SLACK-wise tha
            //other parts of the schedule process. So SLACK*2 instead of just SLACK
            if (o >= SLACK*2) {
                startTime += onDemand.modulo;
            }
        }
        channel.startTime = (new Date(startTime)).toISOString();
        channel.programs = newPrograms;
        return channel;
    }
    
    isOnDemandChannelPaused(channel) {
        return (
            (typeof(channel.onDemand) !== 'undefined')
            &&
            (channel.onDemand.isOnDemand === true)
            &&
            (channel.onDemand.paused === true)
        );
    }

}
function clone(channel) {
    return JSON.parse( JSON.stringify(channel) );
}

module.exports = OnDemandService
