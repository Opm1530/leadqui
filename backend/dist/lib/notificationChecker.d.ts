export declare const NOTIF_TYPES: {
    readonly FATURA_ATRASADA: "FATURA_ATRASADA";
    readonly TAREFA_VENCIDA: "TAREFA_VENCIDA";
    readonly DESPESA_FIXA_VENCENDO: "DESPESA_FIXA_VENCENDO";
    readonly POST_APROVACAO: "POST_APROVACAO";
};
export declare function checkNotifications(): Promise<void>;
export declare function startNotificationChecker(): void;
//# sourceMappingURL=notificationChecker.d.ts.map