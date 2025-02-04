const { Client, Events, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { token, clientId, guildId } = require("./config.json");
const fs = require("fs");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Load streak data from file
let streaks = {};
const STREAK_FILE = "./streaks.json";

if (fs.existsSync(STREAK_FILE)) {
    streaks = JSON.parse(fs.readFileSync(STREAK_FILE, "utf8"));
}

// Function to save streak data
function saveStreaks() {
    fs.writeFileSync(STREAK_FILE, JSON.stringify(streaks, null, 2));
}

const DAILY_CHECKUP_CHANNEL_ID = "1313632236435935282"; // **VERVANG DIT MET DE JUISTE CHANNEL ID**

// Daily Questions (customize these)
const dailyQuestions = [
    "to do's gehaald?",
    "workout gedaan?",
    "boek gelezen?",
    "voldoende slaap?",
    "doelen morgen?"
];

// Slash Command Setup
const commands = [
    new SlashCommandBuilder().setName("streak").setDescription("Bekijk je streak!"),
    new SlashCommandBuilder().setName("daily").setDescription("Beantwoord de dagelijkse vragen.")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
    try {
        console.log("⏳ Slash commands worden geregistreerd...");
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        console.log("✅ Slash commands succesvol geladen!");
    } catch (error) {
        console.error(error);
    }
})();

// Slash Command Listener
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === "streak") {
        const userId = interaction.user.id;

        if (!streaks[userId]) {
            await interaction.reply("❌ Je hebt nog geen streak! Begin vandaag met je daily check-in! ");
            return;
        }

        const streakCount = streaks[userId].streak;
        await interaction.reply(` ${interaction.user}, je huidige streak is **${streakCount}** dagen! Keep it up!`);
    } else if (commandName === "daily") {
        const modal = new ModalBuilder()
            .setCustomId('dailyModal')
            .setTitle('Dagelijkse Check-in');

        const rows = dailyQuestions.map((question, index) => {
            const input = new TextInputBuilder()
                .setCustomId(`answer${index}`)
                .setLabel(question)
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            return new ActionRowBuilder().addComponents(input);
        });

        modal.addComponents(rows);

        await interaction.showModal(modal);
    }
});

// Modal Submit Handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'dailyModal') {
        const answers = dailyQuestions.map((_, index) => interaction.fields.getTextInputValue(`answer${index}`));
        const userId = interaction.user.id;
        const streak = streaks[userId] ? streaks[userId].streak : 0;
        const today = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const userTag = `<@${userId}>`; // Tag de gebruiker

        let messageContent = `**${today}**\nDagelijkse Check-in van ${userTag} (${streak}):\n`; // Datum en tag bovenaan
        messageContent += dailyQuestions.map((question, index) => `**${question}:** ${answers[index]}`).join('\n');

        try {
            const dailyChannel = client.channels.cache.get(DAILY_CHECKUP_CHANNEL_ID);
            if (dailyChannel) {
                await dailyChannel.send(messageContent);
                await interaction.reply({ content: "Je dagelijkse check-in is succesvol verstuurd!", ephemeral: true });
            } else {
                console.error("Daily check-up channel not found!");
                await interaction.reply({ content: "Er is een fout opgetreden. Probeer het later opnieuw.", ephemeral: true });
            }
        } catch (error) {
            console.error("Error sending daily check-in:", error);
            await interaction.reply({ content: "Er is een fout opgetreden. Probeer het later opnieuw.", ephemeral: true });
        }
    }
});


// Streak Message Handler (Existing Code)
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== DAILY_CHECKUP_CHANNEL_ID) return;

    const userId = message.author.id;
    const today = new Date().toISOString().split("T")[0];

    if (!streaks[userId]) {
        streaks[userId] = { streak: 1, lastMessageDate: today };
    } else {
        const lastDate = streaks[userId].lastMessageDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        if (lastDate === today) {
            return;
        } else if (lastDate === yesterdayStr) {
            streaks[userId].streak += 1;
        } else {
            streaks[userId].streak = 1;
        }

        streaks[userId].lastMessageDate = today;
    }

    saveStreaks();

    message.channel.send(` ${message.author}, je streak is: **${streaks[userId].streak}** dagen! Keep it up!`);
});


// Bot login

require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;

client.login(TOKEN);
client.login(token);