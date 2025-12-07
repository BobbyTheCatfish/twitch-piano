import * as Discord from "discord.js"
import axios, { AxiosError } from "axios"
import path from "path"
import fs from "fs"
import config from "./config.json"
import fileMap from "../midiFiles/fileMap.json"
import midiConfig from "../config.json"

const OUTPUT_FILE = "./command-snowflakes"

const instrument = new Discord.SlashCommandBuilder()
    .setName("instrument")
    .setDescription("Change the main instrument")
    .addIntegerOption(
      new Discord.SlashCommandIntegerOption()
        .setName("new-instrument")
        .setDescription("The number of the instrument")
        .setMinValue(midiConfig.minInstrument)
        .setMaxValue(midiConfig.maxInstrument)
        .setRequired(true)
    );


const play = new Discord.SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a series of notes and or chords")
  .addStringOption(
    new Discord.SlashCommandStringOption()
      .setName("notes")
      .setDescription("The notes/chords to play. a-g, z for rest, octave is specified like a4")
      .setRequired(true)
  );

const progression = new Discord.SlashCommandBuilder()
  .setName("progression")
  .setDescription("Play a random chord progression");

const smash = new Discord.SlashCommandBuilder()
  .setName("smash")
  .setDescription("Smash the piano keys like you're a 5 year old");

const song = new Discord.SlashCommandBuilder()
  .setName("song")
  .setDescription("Play a premade song!")
  .addStringOption(
    new Discord.SlashCommandStringOption()
      .setName("song")
      .setDescription("The song to play")
      .setChoices(fileMap)
      .setRequired(true)
  )

const globalCommands: RegFile[] = [
    instrument.toJSON(),
    play.toJSON(),
    progression.toJSON(),
    smash.toJSON(),
    song.toJSON()
]

interface RegisteredCommand {
    type: number;
    id: string;
    name: string;
}

type RegFile = Discord.RESTPostAPIChatInputApplicationCommandsJSONBody | Discord.RESTPostAPIContextMenuApplicationCommandsJSONBody;

function getCommandType(typeId: number) {
  switch (typeId) {
    case 1: return "slash";
    case 2: return "user";
    case 3: return "message";
    default: return typeId;
  }
}

function displayError(error: AxiosError) {
  if (error.response) {
    if (error.response.status === 429) {
      console.log("You're being rate limited! try again after " + (error.response.data as any).retry_after + " seconds. Starting countdown...");
      setTimeout(() => {
        console.log("try now!");
        process.exit();
      }, (error.response.data as any).retry_after * 1000);
    } else if (error.response.status === 400) {
      console.log("You've got a bad bit of code somewhere! Unfortunately it won't tell me where :(");
    } else if (error.response.status === 401) {
      console.log("It says you're unauthorized...");
    } else {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    }
  } else if (error.request) {
    // The request was made but no response was received
    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    // http.ClientRequest in node.js
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log('Error', error.message);
    console.trace(error);
  }
  process.exit();
}

async function patch(commands: RegFile[], isOwner = false) {
  if (commands.length === 0) return;

  const registered: { data: RegisteredCommand[]; } | void = await axios({
    method: "put",
    url: `https://discord.com/api/v8/applications/${config.applicationId}/commands`,
    headers: { Authorization: `Bot ${config.token}` },
    data: commands
  }).catch(displayError);

  if (registered) {
    console.log(`\n=====${isOwner ? "Owner" : "Global"} commands registered=====`);
    const cmds = registered.data;
    console.log(cmds.map(c => {
      const commandType = getCommandType(c.type);
      return `${c.name} (${commandType}): ${c.id}`;
    }).join("\n"));
  }

  return registered?.data;
}

async function register() {
  const applicationId = config.applicationId;
  if (!applicationId) return console.log("Please put your application ID in config.json\nYou can find the ID here:\nhttps://discord.com/developers/applications");

  const global = await patch(globalCommands) ?? [];

  const commands: Record<string, string> = Object.fromEntries(global
      // turn into camel case
      .map(cmd => {
        const name = cmd.name.split(" ")
          .map(n => n[0]!.toUpperCase() + n.slice(1).toLowerCase())
          .join("");
        return [`${getCommandType(cmd.type)}${name}`, cmd.id];
      })
      .sort((a, b) => a[0]!.localeCompare(b[0]!))
  );

  fs.writeFileSync(path.resolve(__dirname, OUTPUT_FILE + ".json"), JSON.stringify(commands, null, 2));

  // write new example file commands only if there are new ones
  // this prevents weirdness with git
  const exampleFilePath = path.resolve(__dirname, OUTPUT_FILE + "-example.json");
  if (!fs.existsSync(exampleFilePath)) fs.writeFileSync(exampleFilePath, "{}");

  const oldExample = import(exampleFilePath);
  const oldKeys = Object.keys(oldExample);
  const newKeys = Object.keys(commands);
  const diff = oldKeys.filter(c => !newKeys.includes(c)).concat(newKeys.filter(c => !oldKeys.includes(c)));

  if (diff.length > 0) fs.writeFileSync(exampleFilePath, JSON.stringify(Object.fromEntries(newKeys.map(f => [f, ""])), null, 2));

  console.log("\nCommand snowflake files updated\n");
  process.exit();
}

register();