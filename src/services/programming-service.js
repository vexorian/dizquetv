
const helperFuncs = require("../helperFuncs");

/* Tells us what is or should be playing in some channel
   If the channel is a an on-demand channel and is paused, resume the channel.
   Before running the logic.

   This hub for the programming logic used to be helperFuncs.getCurrentProgramAndTimeElapsed.

   This class will still call that function, but this should be the entry point
   for that logic.

   Eventually it looks like a good idea to move that logic here.

*/

class ProgrammingService
{
    /****
     *
     **/
    constructor(onDemandService) {
        this.onDemandService = onDemandService;
    }

    getCurrentProgramAndTimeElapsed(moment, channel) {
        channel = onDemandService.activateChannelIfNeeded(moment, channel);
        return helperFuncs.getCurrentProgramAndTimeElapsed(moment, channel);
    }



}

module.exports = ProgrammingService
