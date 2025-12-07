import "./webServer"
import "./discordBot/client"

// LAST DITCH ERROR HANDLING
process.on("unhandledRejection", (error, p) => p.catch(e => console.log("Unhandled Rejection", e)));
process.on("uncaughtException", (error) => console.log("Uncaught Exception", error));