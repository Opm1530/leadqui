interface ExtractionParams {
    categoria?: string;
    cidade?: string;
    hashtag?: string;
    quantidade: number;
    tag_id?: string | null;
}
export declare const startGoogleMapsExtraction: (extractionId: string, userId: string, params: ExtractionParams) => Promise<void>;
export declare const startInstagramExtraction: (extractionId: string, userId: string, params: ExtractionParams) => Promise<void>;
export {};
//# sourceMappingURL=extractionService.d.ts.map