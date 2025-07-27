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
  process.env.BOT_TOKEN,
  process.env.CHANNEL_ID,
  process.env.RESPONSE_CHANNEL_ID,
  process.env.CHECK_IN_CHANNEL_ID,
  questions
);

// Handle shutdown gracefully
process.on("SIGINT", () => {
  console.log("Shutting down bot...");
  bot.cleanup();
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);s
});

// Start the bot
bot.run().catch((error) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});
