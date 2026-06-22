export interface DemandResult {
    is_demand: boolean;
    summary: string;
    category: string;
}
export declare function classifyDemand(text: string): Promise<DemandResult | null>;
//# sourceMappingURL=demandClassifier.d.ts.map