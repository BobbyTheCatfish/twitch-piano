import config from "./config.json";
import commandSF from "./command-snowflakes.json"
import { AllowedMentionsTypes, Client, InteractionResponse, Partials } from "discord.js";
import { changeInstrument, keySmash, playNoteSequence, randomChords } from "../midiPlayer/playNotes";
import { playMidiFile } from "../midiPlayer/playMidiFiles";

function clean(response: InteractionResponse) {
    try {
        response.delete();
    } catch (error) {
        return;
    }
}

const client = new Client({
    allowedMentions: {
      parse: [AllowedMentionsTypes.Role, AllowedMentionsTypes.User],
      repliedUser: true
    },
    intents: ["Guilds"],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.on("interactionCreate", async (int) => {
    if (!int.isChatInputCommand()) return;
    switch (int.commandId) {
        case commandSF.slashInstrument:
            const instrument = int.options.getInteger("new-instrument", true);
            const result = changeInstrument(instrument);

            return int.reply(result).then(clean);
    
        case commandSF.slashPlay:
            const notes = int.options.getString("notes", true);
            playNoteSequence(notes);
            
            return int.reply("Attempting to play notes...");

        case commandSF.slashProgression:
            randomChords();
            return int.reply("Playing a random chord progression...");

        case commandSF.slashSmash:
            keySmash();
            return int.reply("Playing like a 5 year old...");

        case commandSF.slashSong:
            const file = int.options.getString("song", true);
            const playStatus = playMidiFile(file)

            if (playStatus) return int.reply(`Playing your favorite song!`);
            if (playStatus === false) return int.reply("Wait your turn! Something is already playing.");
            return int.reply("I don't know that song. Sorry!");

        default:
            throw new Error("Unhandled Command" + int.commandName);
    }
})

client.login(config.token);

export default client