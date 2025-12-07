// @ts-check
import player from "midi-player-js"
import { midiOut, channels, instrumentMap, stdInstruments, ogInstruments } from "./midiUtils";
import fs from "fs"

const Player = new player.Player();

const tracksOff = channels.map(t => parseInt(`1000${t}`, 2))
const tracksOn = channels.map(t => parseInt(`1001${t}`, 2))
const controlChange = channels.map(t => parseInt(`1011${t}`, 2))
const programChange = channels.map(t => parseInt(`1100${t}`, 2))

// Reset
// const stdin = process.stdin;
// stdin.setRawMode(true);
// stdin.resume();
// stdin.setEncoding("utf8")
// process.stdin.on("data", (c) => {
//     const input = c.toString();
//     if (input === '\u0003') {
//         midiOut.sendMessage = (msg) => {}
//         resetPiano();
//         setTimeout(() => {
//             process.exit();
//         }, 1000);
//     }
// })

const ignore = [
    "Time Signature",
    "Key Signature",
    "MIDI Port",
    "Unknown: 8",
    "Unknown: a",
    "Sequence/Track Name",
    "End of Track"
]

type event = {
    tick: number;
    message: number[]
}

let events: event[] = [];
let channelInstruments: number[] = [];
let bpmChanges: { bpm: number, tick: number }[] = [];
let playing = false;

function tickToTime(tick: number) {
    let total = 0;

    for (let i  = 0; i < bpmChanges.length; i++) {
        const cur = bpmChanges[i];
        const next = bpmChanges[i + 1];

        const segRate = cur!.bpm;
        const segStart = cur!.tick;
        const segEnd = next ? next.tick : tick;

        if (tick <= segStart) break;
        const segTicks = Math.min(tick, segEnd) - segStart;
        total += segTicks * (segRate / Player.division);
    }
    total
    return total;
}

function scheduleEvents() {
    const start = process.hrtime.bigint();
    playing = true;

    for (let i = 0; i < events.length; i++) {
        const e = events[i]!;
        try {
            const time = tickToTime(e.tick);
            const targetNs = BigInt(Math.round(time * 1e9));
    
            const wait = () => {
                if (process.hrtime.bigint() - start >= targetNs) {
                    midiOut.sendMessage(e.message);
                    if (i >= events.length - 1) {
                        playing = false;
                        resetPiano();
                    }
                }
                else setImmediate(wait);
            };
            wait();

        } catch(err) {
            console.log(err)
            console.log(e)
            return;
        }
    }
}

function loadEvents() {
    for (const event of Player.getEvents().flat()) {
        const { channel, noteNumber, name } = event;

        if (ignore.includes(name)) continue;
        // console.log(e);

        if (name === "Set Tempo") {
            bpmChanges.push({ bpm: 60 / event.data!, tick: event.tick });
            continue;
        }

        if (name === "Controller Change") {
            const signal = controlChange[channel! - 1]!
            if (!signal) {
                console.log(event)
                throw new Error("No signal")
            }

            
            events.push({tick: event.tick, message: [signal, event.number!, event.value!]})
            continue;
        }


        if (name === "Program Change") {
            const signal = programChange[channel! - 1]!

            const newInstrument = instrumentMap[event.value!] ?? 0;
            if (channel !== 10) {
                console.log("INSTRUMENT", event.channel! - 1, stdInstruments[event.value!], "->", ogInstruments[newInstrument])
                event.value = newInstrument;
                channelInstruments[channel!] = newInstrument;
            }

            if (!signal) {
                console.log(event)
                throw new Error("No signal")
            }

            events.push({tick: event.tick, message: [signal, event.value!]})
            continue;
        }

        const isOn = name == "Note on" && event.velocity !== 0;
        const signal = (isOn ? tracksOn : tracksOff)[channel! - 1]!

        // if (channelInstruments[channel!] === 23) {
        //     event.velocity = 70;
        // }

        if (!signal) {
                console.log(event)
                throw new Error("No signal")
            }
        // console.log(signal);
        events.push({tick: event.tick, message: [signal, noteNumber!, event.velocity!]})
        // events.push({tick: event.tick, message: [signal, noteNumber!, 70]}) // static velocity for when instruments are too muted
    }
}

function resetPiano() {
    console.log("resetting...")
        for (const channel of channels) {
            midiOut.sendMessage([parseInt(`1011${channel}`, 2), 120, 0])
            midiOut.sendMessage([parseInt(`1011${channel}`, 2), 123, 0])
            midiOut.sendMessage([parseInt(`1011${channel}`, 2), 121, 0])
        }
}

export function playMidiFile(file: string) {
    if (playing) return false;
    playing = true;

    bpmChanges = [];
    channelInstruments = [];
    events = [];

    const path = `./midiFiles/${file}.mid`
    if (!fs.existsSync(path)) return null;
    Player.loadFile(path);

    loadEvents();

    bpmChanges.sort((a, b) => a.tick - b.tick);
    bpmChanges.unshift({ tick: 0, bpm: 6e7 / 120 }); // default tempo

    scheduleEvents();
    
    return true;
}

if (module === require.main) {
    resetPiano();
    // playMidiFile("animalcrossing")
    // playMidiFile("moon")
    // playMidiFile("megalovania")
    // playMidiFile("howls")
    playMidiFile("yeah")
    // playMidiFile("90s")
    // playMidiFile("no1")
    // playMidiFile("Yakety")
    // playMidiFile("evangelion")
    // playMidiFile("sonic")
    // playMidiFile("sonic 2")
}