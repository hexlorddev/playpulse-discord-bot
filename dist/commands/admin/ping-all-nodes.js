"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const pingAllNodesCommand = {
    category: 'admin',
    adminOnly: true,
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ping-all-nodes')
        .setDescription('Test connection to all hosting nodes (Admin only)'),
    async execute(interaction) {
        if (!interaction.isChatInputCommand())
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const nodes = await getAllNodes();
            if (nodes.length === 0) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('📡 No Nodes Found')
                    .setDescription('No hosting nodes are configured.')
                    .setColor(0xFFA500)
                    .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('📡 Pinging All Nodes...')
                .setDescription('Testing connection to all hosting infrastructure nodes.')
                .setColor(0x0099FF)
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            // Ping all nodes
            const pingResults = await Promise.allSettled(nodes.map(node => pingNode(node)));
            // Process results
            const successfulPings = [];
            const failedPings = [];
            pingResults.forEach((result, index) => {
                const node = nodes[index];
                if (result.status === 'fulfilled' && result.value.success) {
                    const ping = result.value.ping;
                    successfulPings.push(`🟢 **${node.name}** (${node.region}) - ${ping}ms`);
                }
                else {
                    const error = result.status === 'rejected' ? result.reason : result.value.error;
                    failedPings.push(`🔴 **${node.name}** (${node.region}) - ${error}`);
                }
            });
            // Create results embed
            const resultsEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('📊 Node Ping Results')
                .setColor(failedPings.length === 0 ? 0x00FF00 : failedPings.length < nodes.length ? 0xFFA500 : 0xFF0000)
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' })
                .setTimestamp();
            if (successfulPings.length > 0) {
                resultsEmbed.addFields({
                    name: `✅ Online Nodes (${successfulPings.length})`,
                    value: successfulPings.join('\n') || 'None',
                    inline: false
                });
            }
            if (failedPings.length > 0) {
                resultsEmbed.addFields({
                    name: `❌ Offline/Failed Nodes (${failedPings.length})`,
                    value: failedPings.join('\n') || 'None',
                    inline: false
                });
            }
            resultsEmbed.addFields({ name: '🎯 Success Rate', value: `${Math.round((successfulPings.length / nodes.length) * 100)}%`, inline: true }, { name: '⏱️ Total Time', value: `${Date.now() - interaction.createdTimestamp}ms`, inline: true });
            await interaction.editReply({ embeds: [resultsEmbed] });
            // If there are failures, send alert to admin channel
            if (failedPings.length > 0) {
                await sendNodeFailureAlert(failedPings);
            }
        }
        catch (error) {
            console.error('Node ping error:', error);
            const errorEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('❌ Node Ping Failed')
                .setDescription('Failed to ping hosting nodes. Check the configuration.')
                .setColor(0xFF6B6B)
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
async function getAllNodes() {
    try {
        const response = await axios_1.default.get(`${process.env.PANEL_API_URL}/nodes`, {
            headers: {
                'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
            },
            timeout: 10000
        });
        return response.data.nodes || [];
    }
    catch (error) {
        console.error('Failed to get nodes:', error);
        return [];
    }
}
async function pingNode(node) {
    const startTime = Date.now();
    try {
        await axios_1.default.get(`${node.apiUrl}/health`, {
            timeout: 5000,
            headers: {
                'Authorization': `Bearer ${node.apiKey}`
            }
        });
        const ping = Date.now() - startTime;
        return { success: true, ping };
    }
    catch (error) {
        return {
            success: false,
            error: error.code === 'ECONNABORTED' ? 'Timeout' : 'Connection Failed'
        };
    }
}
async function sendNodeFailureAlert(failedNodes) {
    try {
        const adminChannelId = process.env.ADMIN_CHANNEL_ID;
        if (!adminChannelId)
            return;
        // This would send an alert to the admin channel
        console.log('Node failures detected:', failedNodes);
        // In a real implementation, you would send this to the admin channel
        // const adminChannel = await client.channels.fetch(adminChannelId);
        // if (adminChannel && adminChannel.isTextBased()) {
        //   const alertEmbed = new EmbedBuilder()...
        //   await adminChannel.send({ embeds: [alertEmbed] });
        // }
    }
    catch (error) {
        console.error('Failed to send node failure alert:', error);
    }
}
module.exports = pingAllNodesCommand;
//# sourceMappingURL=ping-all-nodes.js.map