declare const router: import("express-serve-static-core").Router;
export default router;
export declare function runAdsAnalysis(connectionId: string, userId: string, triggeredBy: string): Promise<void>;
export declare function handleIncomingComment(comment: {
    comment_id: string;
    post_id: string;
    text: string;
    username: string;
    account_id?: string;
}): Promise<void>;
//# sourceMappingURL=techqui.d.ts.map