module.exports = function ($timeout, dizquetv, commonProgramTools, getShowData) {
    return {
        restrict: 'E',
        templateUrl: 'templates/filler-config.html',
        replace: true,
        scope: {
            linker: "=linker",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            scope.showTools = false;
            scope.showPlexLibrary = false;
            scope.content = [];
            scope.visible = false;
            scope.error = undefined;
            scope.modes = [ {
                name: "import",
                description: "Collection/Playlist from Plex",
            }, {
                name: "custom",
                description: "Custom List of Clips",
            } ];
            scope.servers = [];
            scope.libraries = [];
            scope.sources = [];

            function refreshContentIndexes() {
                for (let i = 0; i < scope.content.length; i++) {
                    scope.content[i].$index = i;
                }
            }

            scope.contentSplice = (a,b) => {
                scope.content.splice(a,b)
                refreshContentIndexes();
            }

            scope.dropFunction = (dropIndex, program) => {
                let y = program.$index;
                let z = dropIndex + scope.currentStartIndex - 1;
                scope.content.splice(y, 1);
                if (z >= y) {
                    z--;
                }
                scope.content.splice(z, 0, program );
                refreshContentIndexes();
                $timeout();
                return false;
            }
            scope.setUpWatcher = function setupWatchers() {
                this.$watch('vsRepeat.startIndex', function(val) {
                    scope.currentStartIndex = val;
                });
            };

            scope.movedFunction = (index) => {
                console.log("movedFunction(" + index + ")");
            }

            scope.serverChanged = async () => {
                if (scope.server === "") {
                    scope.libraryKey = "";
                    return;
                }
                scope.loadingLibraries = true;
                try {
                    let libraries = (await dizquetv.getFromPlexProxy(scope.server, "/library/sections")).Directory;
                    if ( typeof(libraries) === "undefined") {
                        libraries = []
                    }
                    let officialLibraries = libraries.map( (library) => {
                        return {
                            "key" : library.key,
                            "description" : library.title,
                        }
                    } );

                    let defaultLibrary = {
                            "key": "",
                            "description" : "Select a Library...",
                        }
                    let playlists = [
                        {
                            "key": "$PLAYLISTS",
                            "description" : "Playlists",
                        }
                    ];
                    let combined = officialLibraries.concat(playlists);
                    if (! combined.some( (library) => library.key === scope.libraryKey) ) {
                        scope.libraryKey = "";
                        scope.libraries = [defaultLibrary].concat(combined);
                    } else {
                        scope.libraries = combined;
                    }
                } catch (err) {
                    scope.libraries = [ { name: "", description: "Unable to load libraries"} ];
                    scope.libraryKey = ""
                    throw err;
                } finally {
                    scope.loadingLibraries = false;
                    $timeout( () => {}, 0);
                }
            }


            scope.libraryChanged = async () => {
                if (scope.libraryKey == null) {
                    throw Error(`null libraryKey? ${scope.libraryKey} ${new Date().getTime()} `);
                }
                if (scope.libraryKey === "") {
                    scope.sourceKey = "";
                    return;
                }
                scope.loadingCollections = true;
                try {
                    let collections;
                    if (scope.libraryKey === "$PLAYLISTS") {
                        collections = (await dizquetv.getFromPlexProxy(scope.server, `/playlists`)).Metadata;
                    } else {
                        collections = (await dizquetv.getFromPlexProxy(scope.server, `/library/sections/${scope.libraryKey}/collections`));
                        collections = collections.Metadata
                    }
                    if (typeof(collections) === "undefined") {
                        //when the library has no collections it returns size=0
                        //and no array
                        collections = [];
                    }
                    let officialCollections = collections.map( (col) => {
                        return {
                            "key" : col.key,
                            "description" : col.title,
                        }
                    } );
                    let defaultSource = {
                        "key": "",
                        "description" : "Select a Source...",
                    };
                    if (officialCollections.length == 0) {
                        defaultSource = {
                            "key": "",
                            "description" : "(No collections/lists found)",
                        }
                    }
                    if (! officialCollections.some( (col) => col.key === scope.sourceKey ) ) {
                        scope.sourceKey = "";
                        scope.sources = [defaultSource].concat(officialCollections);
                    } else {
                        scope.sources = officialCollections;
                    }
                } catch (err) {
                    scope.sources = [ { name: "", description: "Unable to load collections"} ];
                    scope.sourceKey = "";
                    throw err;
                } finally {
                    scope.loadingCollections = false;
                    $timeout( () => {}, 0);
                }
            }

            let reloadServers = async() => {
                scope.loadingServers = true;
                try {
                    let servers = await dizquetv.getPlexServers();
                    scope.servers = servers.map( (s) => {
                        return {
                            "name" : s.name,
                            "description" : `Plex - ${s.name}`,
                        }
                    } );
                    let defaultServer = {
                        name: "",
                        description: "Select a Plex server..."
                    };
                    if (! scope.servers.some( (server) => server.name === scope.server) ) {
                        scope.server = "";
                        scope.servers = [defaultServer].concat(scope.servers);
                    }
                } catch (err) {
                    scope.server = "";
                    scope.servers = [ {name:"", description:"Could not load servers"} ];
                    throw err;
                } finally {
                    scope.loadingServers = false;
                    $timeout( () => {}, 0);
                }

                await scope.serverChanged();
                await scope.libraryChanged();

            };




            scope.linker( async (filler) => {

                if ( typeof(filler) === 'undefined') {
                    scope.name = "";
                    scope.content = [];
                    scope.id = undefined;
                    scope.title = "Create Filler List";
                    scope.mode = "import";
                    scope.server = "";
                    scope.libraryKey = "";
                    scope.sourceKey = "";
                } else {
                    scope.name = filler.name;
                    scope.content = filler.content;
                    scope.id = filler.id;
                    scope.title = "Edit Filler List";
                    scope.mode = filler.mode;
                    scope.server = filler?.import?.serverName;
                    if ( typeof(scope.server) !== "string" ) {
                        scope.server = "";
                    }
                    scope.libraryKey = filler?.import?.meta?.libraryKey;
                    if ( typeof(scope.libraryKey) !== "string" ) {
                        scope.libraryKey = "";
                    }
                    scope.sourceKey = filler?.import?.key;
                    if ( typeof(scope.sourceKey) !== "string" ) {
                        scope.sourceKey = "";
                    }
                }
                await reloadServers();
                scope.source = "";
                refreshContentIndexes();
                scope.visible = true;
            } );

            scope.finished = (cancelled) => {
                if (cancelled) {
                    scope.visible = false;
                    return scope.onDone();
                }
                if ( (typeof(scope.name) === 'undefined') || (scope.name.length == 0) ) {
                    scope.error = "Please enter a name";
                }
                if ( scope?.mode === "import" ) {
                    if ( (typeof(scope?.server) !== "string" ) || (scope?.server === "") ) {
                        scope.error = "Please select a server"
                    }
                    if ( (typeof(scope?.source) !== "string" ) && (scope?.source === "") ) {
                        scope.error = "Please select a source."
                    }
                 } else {
                    if ( scope.content.length == 0) {
                        scope.error = "Please add at least one clip.";
                    }
                }
                if (typeof(scope.error) !== 'undefined') {
                    $timeout( () => {
                        scope.error = undefined;
                    }, 30000);
                    return;
                }
                scope.visible = false;
                let object = {
                    name: scope.name,
                    content: scope.content.map( (c) => {
                        delete c.$index
                        return c;
                    } ),
                    id: scope.id,
                    mode: scope.mode,

                };
                if (object.mode === "import") {
                    object.content = [];
                    //In reality  dizqueTV only needs to know the server name
                    //and the source key, the meta object is for extra data
                    //that is useful for external things like this UI.
                    object.import = {
                        serverName : scope.server,
                        key: scope.sourceKey,
                        meta: {
                            libraryKey : scope.libraryKey,
                        }
                    }
                }
                scope.onDone( object );
            }
            scope.getText = (clip) => {
                let show = getShowData(clip);
                if (show.hasShow && show.showId !== "movie." ) {
                    return show.showDisplayName + " - " + clip.title;
                } else {
                    return clip.title;
                }
            }
            scope.showList = () => {
                return ! scope.showPlexLibrary;
            }
            scope.sortFillersByLength = () => {
                scope.content.sort( (a,b) => { return a.duration - b.duration } );
                refreshContentIndexes();
            }
            scope.sortFillersCorrectly = () => {
                scope.content = commonProgramTools.sortShows(scope.content);
                refreshContentIndexes();
            }

            scope.fillerRemoveAllFiller = () => {
                scope.content = [];
                refreshContentIndexes();
            }
            scope.fillerRemoveDuplicates = () => {
                function getKey(p) {
                    return p.serverKey + "|" + p.plexFile;
                }
                let seen = {};
                let newFiller = [];
                for (let i = 0; i < scope.content.length; i++) {
                    let p = scope.content[i];
                    let k = getKey(p);
                    if ( typeof(seen[k]) === 'undefined') {
                        seen[k] = true;
                        newFiller.push(p);
                    }
                }
                scope.content = newFiller;
                refreshContentIndexes();
            }
            scope.importPrograms = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l; i++) {
                    selectedPrograms[i].commercials = []
                }
                scope.content = scope.content.concat(selectedPrograms);
                refreshContentIndexes();
                scope.showPlexLibrary = false;
            }


            scope.durationString = (duration) => {
                var date = new Date(0);
                date.setSeconds( Math.floor(duration / 1000) ); // specify value for SECONDS here
                return date.toISOString().substr(11, 8);
            }

            let interpolate = ( () => {
                let h = 60*60*1000 / 6;
                let ix = [0, 1*h, 2*h, 4*h, 8*h, 24*h];
                let iy = [0, 1.0, 1.25, 1.5, 1.75, 2.0];
                let n = ix.length;

                return (x) => {
                    for (let i = 0; i < n-1; i++) {
                        if( (ix[i] <= x) && ( (x < ix[i+1]) || i==n-2 ) ) {
                            return iy[i] + (iy[i+1] - iy[i]) * ( (x - ix[i]) / (ix[i+1] - ix[i]) );
                        }
                    }
                }

            } )();

            scope.programSquareStyle = (program, dash) => {
                let background = "rgb(255, 255, 255)";
                let ems = Math.pow( Math.min(60*60*1000, program.duration), 0.7 );
                ems = ems / Math.pow(1*60*1000., 0.7);
                ems = Math.max( 0.25 , ems);
                let top = Math.max(0.0, (1.75 - ems) / 2.0) ;
                if (top == 0.0) {
                    top = "1px";
                }
                let solidOrDash = (dash? 'dashed' : 'solid');
                let f = interpolate;
                let w = 5.0;
                let t = 4*60*60*1000;
                let a = ( f(program.duration) *w) / f(t);
                a = Math.min( w, Math.max(0.3, a) );
                b = w - a + 0.01;

                return {
                    'width': `${a}%`,
                    'height': '1.3em',
                    'margin-right': `${b}%`,
                    'background': background,
                    'border': `1px ${solidOrDash} black`,
                    'margin-top': top,
                    'margin-bottom': '1px',
                };
            }

        }
    };
}
