import Bot from "./bot.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "DISCORD_TOKEN",
  "CHANNEL_ID",
  "RESPONSE_CHANNEL_ID",
  "CHECK_IN_CHANNEL_ID",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  console.error(
    "Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

const questions = [
  "What did you accomplish today?",
  "What challenges did you face?",
  "What are your goals for tomorrow?",
];

// Initialize bot with environment variables
const bot = new Bot(
  process.env.DISCORD_TOKEN,      // Use DISCORD_TOKEN everywhere!
  process.env.CHANNEL_ID,
  process.env.RESPONSE_CHANNEL_ID,
  process.env.CHECK_IN_CHANNEL_ID,
  questions
);

// Handle shutdown gracefully
process.on("SIGINT", async () => {
  console.log("Shutting down bot...");
  try {
    // Call cleanup and await if it returns a Promise
    const result = bot.cleanup && bot.cleanup();
    if (result && typeof result.then === "function") {
      await result;
    }
  } catch (e) {
    console.error("Error during cleanup:", e && e.stack ? e.stack : e);
  }
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error && error.stack ? error.stack : error);
});

// Start the bot
bot.run().catch((error) => {
  console.error("Failed to start bot:", error && error.stack ? error.stack : error);
  process.exit(1);
});