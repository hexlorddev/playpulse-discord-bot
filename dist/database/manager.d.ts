import { UserData, ServerData, TicketData, SecurityEvent } from '../types';
export declare class DatabaseManager {
    private db;
    private initialized;
    constructor();
    initialize(): Promise<void>;
    createUser(userData: Partial<UserData>): Promise<void>;
    getUser(discordId: string): Promise<UserData | null>;
    createServer(serverData: ServerData): Promise<void>;
    getUserServers(userId: string): Promise<ServerData[]>;
    createTicket(ticketData: TicketData): Promise<void>;
    logSecurityEvent(event: SecurityEvent): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map