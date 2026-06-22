export declare function isTrelloConfigured(): Promise<boolean>;
export declare function getTrelloBoards(): Promise<any[]>;
export declare function getTrelloLists(boardId?: string): Promise<any[]>;
export declare function getTrelloLabels(boardId?: string): Promise<any[]>;
export declare function getTrelloMembers(boardId?: string): Promise<any[]>;
export declare function getCardAttachments(cardId: string): Promise<any[]>;
export declare function getCardMediaUrls(cardId: string): Promise<string[]>;
export declare function getTrelloCreds(): Promise<{
    key: string;
    token: string;
    settings: any;
} | null>;
export declare function moveCardToList(cardId: string, listId: string): Promise<void>;
export declare function addCardComment(cardId: string, text: string): Promise<void>;
export declare function ensureTrelloWebhook(callbackURL: string, idModel: string): Promise<string | null>;
interface CreateCardOpts {
    name: string;
    desc: string;
    dueISO?: string;
    idList?: string;
    idMembers?: string[];
    idLabels?: string[];
}
export declare function createTrelloCard(opts: CreateCardOpts): Promise<any | null>;
export {};
//# sourceMappingURL=trello.d.ts.map