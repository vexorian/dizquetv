module.exports = {
    SLACK: 9999,
    TVGUIDE_MAXIMUM_PADDING_LENGTH_MS:    30*60*1000,
    DEFAULT_GUIDE_STEALTH_DURATION: 5 * 60* 1000,
    TVGUIDE_MAXIMUM_FLEX_DURATION : 6 * 60 * 60 * 1000,
    TOO_FREQUENT: 1000,

    // Duration of things like the loading screen and the interlude (the black
    // frame that appears between videos). The goal of these things is to
    // prevent the video from getting stuck on the last second, which looks bad
    // for some reason ~750 works well. I raised the fps to 60 and now 420 works
    // but I wish it was lower.
    GAP_DURATION: 10*42,

    //when a channel is forcibly stopped due to an update, let's mark it as active
    // for a while during the transaction just in case.
    CHANNEL_STOP_SHIELD : 5000,

    START_CHANNEL_GRACE_PERIOD: 15 * 1000,

    // if a channel is stopped while something is playing, subtract
    // this amount of milliseconds from the last-played timestamp, because
    // video playback has latency and also because maybe the user wants
    // the last 30 seconds to remember what was going on...
    FORGETFULNESS_BUFFER:  30 * 1000,

    // When a channel stops playing, this is a grace period before the channel is
    // considered offline. It could be that the client halted the playback for some
    // reason and is about to start playing again. Or maybe the user switched
    // devices or something. Otherwise we would have on-demand channels constantly
    // reseting on their own.
    MAX_CHANNEL_IDLE: 60*1000,

    // there's a timer that checks all active channels to see if they really are
    // staying active, it checks every 5 seconds
    PLAYED_MONITOR_CHECK_FREQUENCY: 5*1000,

    VERSION_NAME: "1.5.3"
}
