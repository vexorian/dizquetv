const EventEmitter = require("events");

class EventsService {
    constructor() {
        this.stream = new EventEmitter();
        let that = this;
        let fun = () => {
            that.push( "heartbeat", "{}");
            setTimeout(fun, 5000)
        };
        fun();

    }

    setup(app) {
        app.get("/api/events", (request, response) => {
            console.log("Open event channel.");
            response.writeHead(200, {
                "Content-Type" : "text/event-stream",
                "Cache-Control" : "no-cache",
                "connection" : "keep-alive",
            } );
            let listener = (event,data) => {
                //console.log( String(event) + " " + JSON.stringify(data) );
                response.write("event: " + String(event) + "\ndata: "
                    + JSON.stringify(data) + "\nretry: 5000\n\n" );
            };
            
            this.stream.on("push", listener );
            response.on( "close", () => {
                console.log("Remove event channel.");
                this.stream.removeListener("push", listener);
            } );
        } );
    }

    push(event, data) {
        if (typeof(data.message) !== 'undefined') {
            console.log("Push event: " + data.message );
        }
        this.stream.emit("push", event, data );
    }


}

module.exports = EventsService;