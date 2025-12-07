import { midiOut, ogInstruments } from "./midiUtils";
import chords from "./chords.json"
import NoRepeat from "no-repeat"
import { chordParserFactory } from "chord-symbol";
import config from "../config.json"

const MAX_INSTRUMENT = config.maxInstrument;
const MIN_INSTRUMENT = config.minInstrument;
const NOTE_DELAY = config.noteDelay;
const CHORD_DELAY = config.chordDelay;

const NOTE_MESSAGE = 144;
const INST_MESSAGE = 192;

const progressions = new NoRepeat(chords.progressions);
const noteRegex = /^([a-gz](?:#|b)?)([0-9]{1,2})?$/i;

// map each note to a note number
const notes: Record<string, number> = {
    "cb": 11, c: 0, "c#": 1,
    "db": 1, d: 2, "d#": 3,
    "eb": 3, e: 4, "e#": 5,
    "fb": 4, f: 5, "f#": 6,
    "gb": 6, g: 7, "g#": 8,
    "ab": 8, a: 9, "a#": 10,
    "bb": 10, b: 11, "b#": 0
}

// Change instruments
export function changeInstrument(instrument: number | string) {
    if (typeof instrument === "string") instrument = parseInt(instrument);

    if (isNaN(instrument) || instrument < MIN_INSTRUMENT || instrument > MAX_INSTRUMENT) {
        return `The instrument has to be between ${MIN_INSTRUMENT} and ${MAX_INSTRUMENT}`;
    }

    midiOut.sendMessage([INST_MESSAGE, instrument]);
    return `The instrument has been changed to #${instrument} (${ogInstruments[instrument]})`;
}

// Note playing functions
function parseNote(noteStr: string) {
    const matched = noteRegex.exec(noteStr);
    if (!matched) return null;

    const [_, noteLetter, strOctave] = matched;

    if (noteLetter!.toLowerCase() === "z") return -1;

    let note = notes[noteLetter!.toLowerCase()];
    if (note === undefined) return null;

    let octave = 2;
    if (strOctave) {
        const parsedOctave = parseInt(strOctave);
        if (!isNaN(parsedOctave)) octave = Math.max(1, Math.min(10, parsedOctave));
    }

    // console.log(octave);

    note += (octave - 1) * 12 + 36;
    if (note < 36) note += 12;
    else if (note > 96) note -= 12;
    
    return note;
}

async function playNote(note: number, duration: number = NOTE_DELAY) {
    if (note === -1) return wait(duration);
    midiOut.sendMessage([NOTE_MESSAGE, note, 50]);
    await wait(duration);
    midiOut.sendMessage([NOTE_MESSAGE, note, 0]);
}

const chordParser = chordParserFactory({ notationSystems: ["english"] });

function playChord(chordStr: string, duration = CHORD_DELAY) {
    const chord = chordParser(chordStr);
    if ("normalized" in chord) {
        const firstNote = parseNote(chord.normalized.rootNote);
        console.log(chord.normalized.notes)
        if (firstNote || firstNote === 0) {
            for (const offset of chord.normalized.semitones) {
                playNote(firstNote + offset, duration);
            }
            return true;
        }
    }
    return false;
}

function wait(duration: number) {
    return new Promise<void>((res) => {
      setTimeout(() => {
        res()
      }, duration);
    })
}

export async function playNoteSequence(rawInput: string) {
    const parts = rawInput.split(" ");
    for (const part of parts) {
        const chord = playChord(part);
        if (chord) {
            await wait(NOTE_DELAY);
            continue;
        }

        const note = parseNote(part);
        if (!note && note !== 0) return;

        // console.log(note);
        await playNote(note, NOTE_DELAY);
    }
}

// Play a random chord progression
export async function randomChords() {
    const progression = progressions.getRandom();
    for (const rawChord of progression) {
        const chord = playChord(rawChord);

        if (chord) await wait(CHORD_DELAY);
        else break;
    }
}

// Randomized chords
function randomChord(count: number) {
    for (let i = 0; i < count; i++) {
        const num = Math.floor(Math.random() * 96) + 1;
        playNote(num, CHORD_DELAY);
    }
}

export async function keySmash() {
    for (let i = 0; i < Math.floor(Math.random() * 5) + 3; i++) {
        randomChord(Math.floor(Math.random() * 5) + 3);
        await wait(NOTE_DELAY);
    }
}

