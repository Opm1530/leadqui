import { Readable } from "stream";
export declare function isStorageConfigured(): Promise<boolean>;
export declare function uploadFile(key: string, body: Buffer, mime?: string): Promise<void>;
export declare function uploadStream(key: string, body: Readable, mime?: string, contentLength?: number): Promise<void>;
export declare function uploadTempFile(key: string, filePath: string, mime?: string, size?: number): Promise<void>;
export declare function getFile(key: string): Promise<{
    body: any;
    mime?: string;
}>;
export declare function deleteFile(key: string): Promise<void>;
//# sourceMappingURL=storage.d.ts.map