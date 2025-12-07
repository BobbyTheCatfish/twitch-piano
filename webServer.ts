import express from "express";
import config from "./config.json";
import { changeInstrument, keySmash, playNoteSequence, randomChords } from "./midiPlayer/playNotes";
import { playMidiFile } from "./midiPlayer/playMidiFiles";

const app = express();

app.use(express.json());

app.get("/play", (req, res) => {
    res.sendStatus(200);

    const msg: string = (req.headers["twitch-msg"] as string) || "";
    if (msg.startsWith("!")) return;
    if (!msg) return;

    playNoteSequence(msg);
})

app.get("/smash", (req, res) => {
    res.sendStatus(200);
    keySmash();
})

app.get("/randomchords", (req,res) => {
    res.sendStatus(200);
    randomChords();
})

app.get("/instrument", (req, res) => {
    res.sendStatus(200);
    const instrument: string = (req.headers["instrument"] as string) || "";
    changeInstrument(instrument);
})

function songRoute(file: string) {
    app.get(`/song/${file}`, async (req, res) => {
        res.send({ status: playMidiFile(file) ?? false });
    })
}

songRoute("moon")
songRoute("yeah")
songRoute("90s")
songRoute("no1")
songRoute("yakety")
songRoute("evangelion")

app.listen(config.port, () => {
    console.log(`Listening on port ${config.port}`)
});

export default app;