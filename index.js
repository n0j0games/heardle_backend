const youtubedl = require('youtube-dl-exec');
const fs = require("fs");
const axios = require('axios');

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

if (args.length === 2 && args[1] === '--reset') {
    post(args[0]);
} else {
    if (args.length === 0) {
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
        if (jsondata.current !== null) {
            if (jsondata.previous === undefined) {
                jsondata.previous = [jsondata.current];
            } else {
                jsondata.previous.push(jsondata.current);
            }
        }
        const current = getRandomNum(jsondata.previous, allsongs.length);
        jsondata.current = current;
        const currentSong = allsongs[current];
        jsondata.title = currentSong.name;
        jsondata.artist = currentSong.artist;
        jsondata.album = currentSong.album;

        json = jsondata;

        youtubedl(currentSong.src, {
            getUrl : true
        }).then(output => collectOutput(output))
    });
    /*if (this.status === 200) {

    } else if (this.status === 400) {
        console.log(`> Basket ${currentArtist} not found, creating new one`);
        post(currentArtist);
    } else {
        console.error(`> Error ${this.status}: ${this.responseText}`);
    }*/
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
