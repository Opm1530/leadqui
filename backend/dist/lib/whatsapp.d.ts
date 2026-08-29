export declare function detectMedia(data: any): {
    type: string;
    mime?: string;
    name?: string;
} | null;
export declare function fetchMediaBase64(instance: string, data: any): Promise<{
    buffer: Buffer;
    mime?: string;
} | null>;
export declare function sendWhatsappAudio(instance: string, jid: string, base64: string): Promise<any>;
export declare function sendWhatsappMedia(instance: string, jid: string, mediatype: string, url: string, opts?: {
    caption?: string;
    fileName?: string;
}): Promise<any>;
export declare function evolutionConfig(): Promise<{
    baseUrl: string;
    apiKey: string;
} | null>;
export declare function sendWhatsappText(instance: string, jid: string, text: string): Promise<any>;
export declare function isInboxInstance(instance: string): Promise<boolean>;
export declare function clearInboxInstanceCache(): void;
export declare function syncGroupNames(instances: string[]): Promise<void>;
export declare function recordMessage(opts: {
    instance: string;
    chatJid: string;
    text: string;
    fromMe: boolean;
    waMessageId?: string | null;
    authorName?: string | null;
    authorUserId?: string | null;
    name?: string | null;
    timestamp?: Date;
    mediaType?: string | null;
    mediaKey?: string | null;
    mediaMime?: string | null;
    mediaName?: string | null;
}): Promise<any>;
//# sourceMappingURL=whatsapp.d.ts.map