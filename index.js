// index.js
import Bot from './bot.js';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const responseChannelId = process.env.DISCORD_RESPONSE_CHANNEL_ID;
const checkInChannelId = process.env.CHECK_IN_CHANNEL_ID;

const questions = [
  'What did you accomplish today? ',
  'What challenges did you face?',
  'What are your goals for tomorrow?',
];

const bot = new Bot(token, channelId, responseChannelId, checkInChannelId, questions);
bot.client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
bot.run();