interface SendOpts {
    trello_list_id?: string;
    trello_member_ids?: string[];
    trello_label_ids?: string[];
    responsible_id?: string | null;
}
export declare function sendPostToProduction(postId: string, opts?: SendOpts): Promise<{
    post: any;
    trello: any | null;
    task: any | null;
}>;
export {};
//# sourceMappingURL=production.d.ts.map