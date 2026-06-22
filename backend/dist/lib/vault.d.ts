export interface Encrypted {
    enc: string;
    iv: string;
    tag: string;
}
export declare function encrypt(plaintext: string): Encrypted;
export declare function decrypt(enc: string, iv: string, tag: string): string;
//# sourceMappingURL=vault.d.ts.map