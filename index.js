const youtubedl = require('youtube-dl-exec');
const fs = require("fs");
const axios = require('axios');
const schedule = require('node-schedule');
const http = require('http');

/*
Main Part
 */

const args = process.argv.slice(2);

let json = {
    "previous" : [],
    "current" : null,
    "title" : "",
    "artist" : "",
    "album" : "",
    "ytdl_src" : ""
};

const pantryid = "0911ba7f-da52-4ccf-9aee-8ee0b3e48cd3";
let currentArtist = null;
let onlyRefresh = false;

function run(args) {
    if (args.length === 2 && args[1] === '--reset') {
        post(args[0]);
    } else if (args.length === 2 && args[1] === '--refresh') {
        onlyRefresh = true;
        setNextSong(args[0]);
    } else if (args.length === 0) {
        console.log("artist key as argument required");
    } else {
        setNextSong(args[0]);
    }
}

function setNextSong(artist) {
    console.log('Set next song for ' + artist);
    currentArtist = artist;
    //callApi("GET",,null,handleGet);

    axios.get(`https://getpantry.cloud/apiv1/pantry/${pantryid}/basket/${artist}`)
        .then(response => {
            console.log("Loaded previous data", response.data.json);
            handleGet(response.data.json);
        })
        .catch(error => {
            if (error.code === 'ERR_BAD_REQUEST') {
                console.log('Basket not found');
                post(artist);
                return;
            }
            console.error(error);
        });
}

function getRandomNum(previous, length) {
    let rdm = Math.floor(Math.random() * (length));
    for (let num in previous) {
        if (rdm === previous[num]) {
            return getRandomNum(previous, length);
        }
    }
    return rdm;
}

function handleGet(jsondata) {
    fs.readFile(`files/${currentArtist}.json`, (err, data) => {
        if (err) throw err;
        console.log(`Loaded songlib ${currentArtist}.json`);
        const allsongs = JSON.parse(data).songs;

        console.log(jsondata);
        let current = jsondata.current;
        if (!onlyRefresh) {
            console.log("Updating to next song");
            if (jsondata.current !== null) {
                if (jsondata.previous === undefined) {
                    jsondata.previous = [jsondata.current];
                } else {
                    jsondata.previous.push(jsondata.current);
                }
            }
            current = getRandomNum(jsondata.previous, allsongs.length);
            jsondata.current = current;
        } else {
            console.log("Refreshing url only");
        }
        const currentSong = allsongs[current];
        jsondata.title = currentSong.name;
        jsondata.artist = currentSong.artist;
        jsondata.album = currentSong.album;

        json = jsondata;

        fs.unlink('audiooutput.mp3', function(err) {
            if(err && err.code === 'ENOENT') {
                // file doens't exist
                console.info("File doesn't exist, won't remove it.");
            } else if (err) {
                // other errors, e.g. maybe we don't have enough permission
                console.error("Error occurred while trying to remove file");
            }
        });
        youtubedl("https://www.youtube.com/watch?v=DmWWqogr_r8", {
            //getUrl : true,
            extractAudio : true,
            audioFormat : "mp3",
            geoBypass : true,
            geoBypassCountry : 'DE',
            referer : "https://www.youtube.com/watch?v=DmWWqogr_r8",
            output : "audiooutput.%(ext)s"
        }).then(output => collectOutputNew(output));

        /*
        youtubedl(currentSong.src, {
            getUrl : true,
            geoBypass : true,
            geoBypassCountry : 'DE',
            referer : currentSong.src
        }).then(output => collectOutputNew(output))*/
    });
    /*if (this.status === 200) {

    } else if (this.status === 400) {
        console.log(`> Basket ${currentArtist} not found, creating new one`);
        post(currentArtist);
    } else {
        console.error(`> Error ${this.status}: ${this.responseText}`);
    }*/
}

function collectOutputNew(output) {
    json.ytdl_src = "https://yeardleapp.herokuapp.com"
    post(currentArtist);
    startServer();
}

function startServer() {
    http.createServer(function(req, res) {
        res.writeHead(200, {'Content-Type': 'audio/mp3'});
        const rstream = fs.createReadStream('audiooutput.mp3');
        rstream.pipe(res);


    }).listen(process.env.PORT || 8080);
    console.log(`[INFO] Server running on Port ${process.env.PORT || 8080}`);
}

function collectOutput(output) {
    console.log('fetching youtube audio url');
    let url = output.split("\n")[1];
    if (url !== null) {
        console.log(url);
        json.ytdl_src = url;
        post(currentArtist);
        //open(url);
    } else {
        console.error(`Not found ${currentArtist} with Song #${json.current}`);
    }
}

function post(artist) {
    console.log('Posting...', json);
    axios.post(`https://getpantry.cloud/apiv1/pantry/${pantryid}/basket/${artist}`, {
        json
    })
        .then(function (response) {
            console.log('Success!');
        })
        .catch(function (error) {
            console.log(error);
        });
}

function handlePost() {
    if (this.status === 200) {
        console.log(`Success 200: ${this.response}`);
    } else {
        console.error(`> Error ${this.status}: ${this.responseText}`);
    }
}

/*
    Scheduler
 */

console.log("[INFO] Starting Scheduler");
let refreshonce = false;

run(["kanye","--refresh"]);

const logger = schedule.scheduleJob('0 * * * * *', function(fireDate){
    console.log(`[INFO] Scheduler is active`);
});

/*
const job = schedule.scheduleJob('0 * * * *', function(fireDate){
    console.log(`[INFO][${fireDate}] Running scheduled refresh job`);
    run(["kanye","--refresh"]);
});*/

const job2 = schedule.scheduleJob('* * 0 * *', function(fireDate){
    console.log(`[INFO][${fireDate}] Running scheduled job`);
    run(["kanye"]);
});

process.on('SIGINT', function () {
    console.error("[ERROR] Shutdown Scheduled Processes");
    schedule.gracefulShutdown()
        .then(() => process.exit(0))
});

/* Starting webserver for heroku to run sucessfully */

/*
http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("Scheduler is active");
    res.end();
}).listen(process.env.PORT || 8080);
console.log(`[INFO] Server running on Port ${process.env.PORT || 8080}`);
*/