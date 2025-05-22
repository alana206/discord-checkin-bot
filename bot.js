// bot.js
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import schedule from 'node-schedule';
import "dotenv/config";


export default class Bot {
  constructor(token, channelId, responseChannelId, checkInChannelId, questions) {
    this.token = token;
    this.channelId = channelId;
    this.responseChannelId = responseChannelId;
    this.checkInChannelId = checkInChannelId;
    this.questions = questions;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ],
    });
  }

  async run() {
    this.client.once('ready', () => {
      console.log('Bot is ready!');
      this.scheduleQuestions();
      this.scheduleDailyCheckin();
      this.client.user.setPresence({ 
        activities: [{ name: 'Tracking Check-ins', type: 'Watching' }], 
        status: 'online' 
      });
    });

    this.client.login(this.token);
  }

  scheduleQuestions() {
    // Schedule the job to run every weekday at 8 AM
    // Using cron syntax: '0 8 * * 1-5' means at 08:00 AM every weekday (Monday to Friday)
    schedule.scheduleJob('0 8 * * 1-5', async () => {
      try {
        const channel = await this.client.channels.fetch(this.channelId);
        if (!channel) {
          console.error(`Channel with ID ${this.channelId} not found.`);
          return;
        }

        const members = await channel.guild.members.fetch();
        const textChannel = await this.client.channels.fetch(this.responseChannelId);
        if (!textChannel) {
          console.error(`Response channel with ID ${this.responseChannelId} not found.`);
          return;
        }

        for (const member of members.values()) {
          if (member.user.bot) continue; // Skip bots
            
          const responses = {};
          for (const question of this.questions) {
            try {
              const dmChannel = await member.user.createDM();
              await dmChannel.send(question);
              const collected = await dmChannel.awaitMessages({
                filter: (m) => m.author.id === member.user.id,
                max: 1,
                time: 60 * 60 * 1000, // 1 hour timeout
                errors: ['time'],
              });
              responses[question] = collected.first().content;
            } catch (error) {
              console.error(`Error sending DM to ${member.user.tag}:`, error);
              responses[question] = 'No response';
            }
          }
          // Send the responses to the specific channel.
          await textChannel.send({
            content: `Responses from ${member.user.tag}:`,
            embeds: [
              new EmbedBuilder()
                .setTitle('Weekly Check-in')
                .setDescription(
                  Object.entries(responses)
                    .map(([question, answer]) => `**${question}**\n${answer}`)
                    .join('\n\n')
                ),
            ],
          });
        }
      } catch (error) {
        console.error('Error during scheduled job:', error);
      }
    });
  }

  scheduleDailyCheckin() {
    if (this.checkInChannelId) {
      schedule.scheduleJob({ hour: 9, minute: 0, tz: 'America/Los_Angeles' }, async () => {
        try {
          const checkInChannel = await this.client.channels.fetch(this.checkInChannelId);
          if (checkInChannel && checkInChannel.isTextBased()) {
            await checkInChannel.send("**Daily Check-in!** 👋 Please react to this message or say 'here' to indicate you're present and ready to code today!");
          } else {
            console.error('Could not find or access the check-in channel.');
          }
        } catch (error) {
          console.error('Error sending daily check-in message:', error);
        }
      });
      console.log('Daily check-in message scheduled.');
    } else {
      console.warn('CHECK_IN_CHANNEL_ID not found. Daily check-in not scheduled.');
    }
  }
}