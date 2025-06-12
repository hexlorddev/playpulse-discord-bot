"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
module.exports = {
    name: discord_js_1.Events.InteractionCreate,
    async execute(interaction, bot) {
        if (!interaction.isChatInputCommand())
            return;
        const logger = bot.getLogger();
        const rateLimiter = bot.getRateLimiter();
        const security = bot.getSecurity();
        const client = bot.getClient();
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            logger.warn(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        try {
            // Check rate limits
            const rateLimitCheck = await rateLimiter.checkRateLimit(interaction);
            if (!rateLimitCheck.allowed) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('⏱️ Rate Limited')
                    .setDescription(`You're being rate limited. Please try again in ${rateLimitCheck.retryAfter} seconds.`)
                    .setColor(0xFF6B6B)
                    .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check if command requires admin permissions
            if (command.adminOnly && !await isAdmin(interaction)) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🚫 Access Denied')
                    .setDescription('This command requires administrator permissions.')
                    .setColor(0xFF6B6B)
                    .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check if command requires premium
            if (command.premiumOnly && !await isPremiumUser(interaction)) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('💎 Premium Required')
                    .setDescription('This command requires a premium subscription.')
                    .addFields({
                    name: 'Upgrade Now',
                    value: `[Get Premium](${process.env.BILLING_PORTAL_URL || 'https://playpulse.com/premium'})`
                })
                    .setColor(0xFFD700)
                    .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // Check 2FA requirements
            if (await security.requires2FA(interaction.user.id, interaction.commandName)) {
                const has2FA = await security.verify2FASession(interaction, interaction.commandName);
                if (!has2FA) {
                    const embed = security.create2FAChallenge(interaction.user.id, interaction.commandName);
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                    return;
                }
            }
            // Log security event for sensitive commands
            if (command.category === 'admin' || command.category === 'security') {
                await security.logSecurityEvent({
                    userId: interaction.user.id,
                    event: 'command_execution',
                    ip: security.getUserIP(interaction),
                    userAgent: 'Discord Bot',
                    timestamp: new Date(),
                    metadata: {
                        command: interaction.commandName,
                        guild: interaction.guildId,
                        channel: interaction.channelId
                    }
                });
            }
            // Execute the command
            await command.execute(interaction);
            // Log successful command execution
            logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id})`);
        }
        catch (error) {
            logger.error(`Error executing command ${interaction.commandName}:`, error);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('❌ Command Error')
                .setDescription('There was an error while executing this command!')
                .setColor(0xFF6B6B)
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
            // Send error to user
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            }
            else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            // Send detailed error to debug channel
            const debugChannelId = process.env.DEBUG_CHANNEL_ID;
            if (debugChannelId) {
                try {
                    const debugChannel = await client.channels.fetch(debugChannelId);
                    if (debugChannel && debugChannel.isTextBased()) {
                        const debugEmbed = new discord_js_1.EmbedBuilder()
                            .setTitle('🐛 Command Error Debug')
                            .setDescription('```\n' + error + '\n```')
                            .addFields({ name: 'Command', value: interaction.commandName, inline: true }, { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }, { name: 'Guild', value: interaction.guildId || 'DM', inline: true })
                            .setColor(0xFF0000)
                            .setTimestamp();
                        await debugChannel.send({ embeds: [debugEmbed] });
                    }
                }
                catch (debugError) {
                    logger.error('Failed to send debug message:', debugError);
                }
            }
        }
    }
};
async function isAdmin(interaction) {
    if (!interaction.guild || !interaction.member)
        return false;
    const member = interaction.member;
    // Check if user has administrator permission
    if (member.permissions && typeof member.permissions !== 'string') {
        return member.permissions.has('Administrator');
    }
    return false;
}
async function isPremiumUser(interaction) {
    if (!interaction.guild || !interaction.member)
        return false;
    const premiumRoleId = process.env.PREMIUM_ROLE_ID;
    if (!premiumRoleId)
        return false;
    const member = interaction.member;
    if (member.roles && typeof member.roles !== 'string') {
        return member.roles.cache.has(premiumRoleId);
    }
    return false;
}
//# sourceMappingURL=interactionCreate.js.map