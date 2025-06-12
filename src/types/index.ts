import { Client, CommandInteraction, SlashCommandBuilder } from 'discord.js';

export interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
  category: 'hosting' | 'ticket' | 'admin' | 'billing' | 'security' | 'ai' | 'automation' | 'domains' | 'monitoring' | 'analytics' | 'gaming' | 'devops' | 'cloud' | 'networking' | 'reporting' | 'backup' | 'recovery' | 'workflow' | 'scheduler';
  adminOnly?: boolean;
  premiumOnly?: boolean;
  cooldown?: number;
}

export interface ExtendedClient extends Client {
  commands: Map<string, BotCommand>;
}

export interface ServerData {
  id: string;
  name: string;
  plan: string;
  region: string;
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'crashed';
  ip: string;
  port: number;
  userId: string;
  createdAt: Date;
  lastReboot?: Date;
}

export interface TicketData {
  id: string;
  userId: string;
  guildId: string;
  channelId: string;
  category: 'support' | 'upgrade' | 'security' | 'billing';
  status: 'open' | 'pending' | 'closed' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  closedAt?: Date;
  assignedTo?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface UserData {
  discordId: string;
  email?: string;
  panelUserId?: string;
  subscriptionTier: 'free' | 'premium' | 'enterprise';
  twoFactorEnabled: boolean;
  apiKeyHash?: string;
  lastLogin?: Date;
  totalServers: number;
  monthlyUsage: number;
  settings: {
    notifications: boolean;
    autoRenewal: boolean;
    securityAlerts: boolean;
  };
}

export interface PanelAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ServerCreationOptions {
  plan: 'basic' | 'premium' | 'enterprise' | 'custom';
  region: 'us-east' | 'us-west' | 'eu-central' | 'asia-pacific';
  serverType: 'minecraft' | 'discord-bot' | 'web-app' | 'game-server';
  name: string;
  autoStart?: boolean;
}

export interface BillingInfo {
  userId: string;
  subscriptionId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  nextBillingDate: Date;
  amount: number;
  currency: string;
}

export interface SecurityEvent {
  userId: string;
  event: 'login' | 'command_execution' | 'api_access' | '2fa_setup' | 'failed_auth';
  ip: string;
  userAgent?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface NodeStatus {
  nodeId: string;
  region: string;
  status: 'online' | 'offline' | 'maintenance';
  cpu: number;
  memory: number;
  disk: number;
  load: number;
  lastUpdate: Date;
}

export interface EmbedTemplate {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: boolean;
  footer?: {
    text: string;
    iconURL?: string;
  };
  thumbnail?: string;
  image?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}