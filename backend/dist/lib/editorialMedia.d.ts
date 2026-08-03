export declare function signMedia(id: string): string;
export declare function verifyMedia(token: string): string | null;
export declare function publicApiBase(): string;
export declare function guessMime(name?: string): string | undefined;
export declare function resolveContentMedia(content: any): Promise<{
    key: string;
    name: string;
    mime?: string;
} | null>;
export declare function mediaTypeFor(content: any): "IMAGE" | "REELS";
//# sourceMappingURL=editorialMedia.d.ts.map