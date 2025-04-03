import Discord, { GatewayIntentBits, User } from 'discord.js';
import cron from 'node-cron';
import fs from 'fs';

export default class Bot {
    constructor(token, checkInChannelId, responseChannelId, responsesFilePath) {
        this.client = new Discord.Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ],
        });
        this.token = token;
        this.checkInChannelId = checkInChannelId;
        this.responseChannelId = responseChannelId;
        this.responsesFilePath = responsesFilePath;
        this.responses = this.loadResponses();

        this.client.once('ready', () => {
            console.log('Bot is ready!');
            this.scheduleCheckIn();
        });

        this.client.on('messageCreate', async (message) => {
            this.handleCommand(message);
        });

        this.initializeCommands();
    }

    initializeCommands() {
        this.commands = {
            addComment: this.addComment.bind(this),
            showResponses: this.showResponses.bind(this),
            sendCheckInNow: this.sendCheckInNow.bind(this),
        };
    }

    login() {
        this.client.login(this.token);
    }

    getCheckInQuestions() {
        return [
            'How did yesterday\'s work on "{{yesterdaysWork}}" go?',
            'How are you feeling today? 👍 or 👎',
            'What are you working on today?',
            'Do you have any blockers?',
        ];
    }

    async scheduleCheckIn() {
        try {
            const guild = this.client.guilds.cache.get(this.checkInChannelId);
            console.log(this.sendCheckInNow(guild));
            if (!guild) {
                return console.error('Guild not found.');
            }

            await guild.members.fetch();

            guild.members.cache.forEach(async (member) => {
                if (!member.user.bot) {
                    cron.schedule(
                        '1 * * * *',
                        async () => {
                            await this.sendCheckIn(member);
                        },
                        {
                            scheduled: true,
                            timezone: 'UTC',
                        }
                    );
                }
            });
        } catch (error) {
            console.error('Error scheduling check-ins:', error);
        }
    }

  async sendCheckIn(user) {
    try {
      const questions = this.getCheckInQuestions();
      const dmChannel = await user.createDM();

            await dmChannel.send(
                '**Daily Check-in: Please answer the following questions:**'
            );

            let yesterdaysWork = {};

            let questionsMessage = '**Daily Check-in: Please answer the following questions:**\n\n';
            for (let i = 0; i < questions.length; i++) {
                let question = questions[i];

                if (
                    question.includes('{{yesterdaysWork}}') &&
                    this.responses[user.id] &&
                    this.responses[user.id].responses &&
                    this.responses[user.id].responses[
                        this.responses[user.id].responses.length - 3
                    ] &&
                    this.responses[user.id].responses[
                        this.responses[user.id].responses.length - 3
                    ].question === 'What are you working on today?'
                ) {
                    question = question.replace(
                        '{{yesterdaysWork}}',
                        this.responses[user.id].responses[
                            this.responses[user.id].responses.length - 3
                        ].answer
                    );
                }

                questionsMessage += `**${i + 1}. ${question}**\n> _Please provide your answer below:_\n\n`;
            }

            await dmChannel.send(questionsMessage);

            for (let i = 0; i < questions.length; i++) {
                let answer = '';
                if (i === 1) {
                    const message = await dmChannel.send('👍 or 👎');
                    await message.react('👍');
                    await message.react('👎');

                    const collected = await message.awaitReactions({
                        filter: (reaction, user) =>
                            user.id !== this.client.user.id &&
                            (reaction.emoji.name === '👍' || reaction.emoji.name === '👎'),
                        max: 1,
                        time: 600000,
                        errors: ['time'],
                    }).catch(() => null);

                    if (collected && collected.first()) {
                        answer = collected.first().emoji.name;
                    } else {
                        answer = 'No response';
                    }
                } else {
                    const collected = await dmChannel.awaitMessages({
                        max: 1,
                        time: 600000,
                    }).catch(() => null);

                    if (collected && collected.first()) {
                        answer = collected.first().content;
                    } else {
                        answer = 'No response';
                    }
                }

                if (i === 2) {
                    yesterdaysWork[user.id] = answer;
                }

                if (!this.responses[user.id]) {
                    this.responses[user.id] = { responses: [] };
                }

                this.responses[user.id].responses.push({
                    question: questions[i],
                    answer: answer,
                    date: new Date(),
                });
                this.saveResponses();
            }

            await dmChannel.send('Thank you for completing the check-in!');
        } catch (error) {
            console.error(`Error sending check-in to ${user.username}:`, error);
        }
    }

    saveResponses() {
        try {
            fs.writeFileSync(
                this.responsesFilePath,
                JSON.stringify(this.responses, null, 2)
            );
        } catch (error) {
            console.error('Error saving responses:', error);
        }
    }

    loadResponses() {
        try {
            if (fs.existsSync(this.responsesFilePath)) {
                return JSON.parse(fs.readFileSync(this.responsesFilePath));
            }
            return {};
        } catch (error) {
            console.error('Error loading responses:', error);
            return {};
        }
    }

    async showResponses(guild) {
        try {
            const responseChannel = guild.channels.cache.get(this.responseChannelId);
            if (!responseChannel) {
                return console.log('Response channel not found');
            }

            for (const userId in this.responses) {
                const user = await guild.members.fetch(userId).catch(console.error);
                if (user) {
                    await responseChannel.send(`**${user.user.username}'s Responses:**`);
                    for (const response of this.responses[userId].responses) {
                        await responseChannel.send(
                            `**${response.question}**\n${response.answer} \nDate: ${response.date}`
                        );
                        if (response.comments && response.comments.length > 0) {
                            for (const comment of response.comments) {
                                await responseChannel.send(
                                    `    **${comment.author}:** ${comment.text} (Date: ${comment.date})`
                                );
                            }
                        }
                    }
                    await responseChannel.send('---');
                }
            }
        } catch (error) {
            console.error('Error showing responses:', error);
        }
    }

    async addComment(message, args) {
        try {
            if (args.length < 3) {
                return message.reply(
                    'Usage: !addComment <user_id> <question_index> <comment>'
                );
            }

            const userId = args[0];
            const questionIndex = parseInt(args[1]);
            const comment = args.slice(2).join(' ');

            if (
                !this.responses[userId] ||
                !this.responses[userId].responses ||
                !this.responses[userId].responses[questionIndex]
            ) {
                return message.reply('Invalid user ID or question index.');
            }

            if (!this.responses[userId].responses[questionIndex].comments) {
                this.responses[userId].responses[questionIndex].comments = [];
            }

            this.responses[userId].responses[questionIndex].comments.push({
                author: message.author.username,
                text: comment,
                date: new Date(),
            });
            this.saveResponses();
            message.reply('Comment added successfully!');
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    }

    async handleCommand(message) {
        const prefix = '!';
        if (!message.content.startsWith(prefix) || message.author.bot) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (this.commands[command]) {
            this.commands[command](message, args);
        }
    }

    async sendCheckInNow(guild) {
        try {
            if (!guild) {
                return console.error('Guild not found.');
            }

            await guild.members.fetch();

            guild.members.cache.forEach(async (member) => {
                if (!member.user.bot) {
                    await this.sendCheckIn(member.user);
                }
            });
        } catch (error) {
            console.error('Error sending check-ins immediately:', error);
        }
    }
}