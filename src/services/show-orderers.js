const random = require('../helperFuncs').random;
const getShowData = require("./get-show-data")();
const randomJS = require("random-js");
const Random = randomJS.Random;



/****
 *
 *  Code shared by random slots and time slots for keeping track of the order
 * of episodes
 *
 **/
function shuffle(array, lo, hi, randomOverride ) {
    let r = randomOverride;
    if (typeof(r) === 'undefined') {
        r = random;
    }
    if (typeof(lo) === 'undefined') {
        lo = 0;
        hi = array.length;
    }
    let currentIndex = hi, temporaryValue, randomIndex
    while (lo !== currentIndex) {
        randomIndex =  r.integer(lo, currentIndex-1);
        currentIndex -= 1
        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }
    return array
}


function getShowOrderer(show) {
    if (typeof(show.orderer) === 'undefined') {

        let sortedPrograms = JSON.parse( JSON.stringify(show.programs) );
        sortedPrograms.sort((a, b) => {
            let showA = getShowData(a);
            let showB = getShowData(b);
            return showA.order - showB.order;
        });

        let position = 0;
        while (
            (position + 1 < sortedPrograms.length )
            &&
            (
                getShowData(show.founder).order
                !==
                getShowData(sortedPrograms[position]).order
            )
        ) {
            position++;
        }


        show.orderer = {

            current : () => {
                return sortedPrograms[position];
            },

            next: () => {
                position = (position + 1) % sortedPrograms.length;
            },

        }
    }
    return show.orderer;
}


function getShowShuffler(show) {
    if (typeof(show.shuffler) === 'undefined') {
        if (typeof(show.programs) === 'undefined') {
            throw Error(show.id + " has no programs?")
        }

        let sortedPrograms = JSON.parse( JSON.stringify(show.programs) );
        sortedPrograms.sort((a, b) => {
            let showA = getShowData(a);
            let showB = getShowData(b);
            return showA.order - showB.order;
        });
        let n = sortedPrograms.length;

        let splitPrograms = [];
        let randomPrograms = [];

        for (let i = 0; i < n; i++) {
            splitPrograms.push( sortedPrograms[i] );
            randomPrograms.push( {} );
        }

     
        let showId = getShowData(show.programs[0]).showId;

        let position = show.founder.shuffleOrder;
        if (typeof(position) === 'undefined') {
            position = 0;
        }

        let localRandom = null;

        let initGeneration = (generation) => {
            let seed = [];
            for (let i = 0 ; i < show.showId.length; i++) {
                seed.push( showId.charCodeAt(i) );
            }
            seed.push(generation);

            localRandom = new Random( randomJS.MersenneTwister19937.seedWithArray(seed) )

            if (generation == 0) {
                shuffle( splitPrograms, 0, n , localRandom );
            }
            for (let i = 0; i < n; i++) {
                randomPrograms[i] = splitPrograms[i];
            }
            let a = Math.floor(n / 2);
            shuffle( randomPrograms, 0, a,  localRandom );
            shuffle( randomPrograms, a, n,  localRandom );
        };
        initGeneration(0);
        let generation = Math.floor( position / n );
        initGeneration( generation );
        
        show.shuffler  = {

            current : () => {
                let prog = JSON.parse(
                    JSON.stringify(randomPrograms[position % n] )
                );
                prog.shuffleOrder = position;
                return prog;
            },

            next: () => {
                position++;
                if (position % n == 0) {
                    let generation = Math.floor( position / n );
                    initGeneration( generation );
                }
            },

        }
    }
    return show.shuffler;
}

module.exports = {
    getShowOrderer : getShowOrderer,
    getShowShuffler: getShowShuffler,
}