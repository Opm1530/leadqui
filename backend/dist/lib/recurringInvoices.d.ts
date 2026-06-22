/**
 * Gera faturas mensais para todos os clientes com contrato ativo.
 * Roda diariamente — só cria fatura no dia de vencimento definido no contrato.
 */
export declare function generateRecurringInvoices(): Promise<void>;
/**
 * Inicia o job diário de geração de faturas.
 * Roda uma vez na inicialização e depois a cada 24h.
 */
export declare function startRecurringInvoicesJob(): void;
//# sourceMappingURL=recurringInvoices.d.ts.map