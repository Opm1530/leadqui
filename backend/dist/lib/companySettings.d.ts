export declare function getCompanySettingsUserId(): Promise<string | null>;
export declare function getCompanySettings(): Promise<{
    id: string;
    created_at: Date;
    updated_at: Date;
    user_id: string;
    evolution_api_url: string | null;
    evolution_api_key: string | null;
    serper_api_key: string | null;
    apify_api_key: string | null;
    openai_api_key: string | null;
    anthropic_api_key: string | null;
    notification_phone: string | null;
    notification_instance: string | null;
    notification_group_id: string | null;
    notification_group_name: string | null;
    r2_account_id: string | null;
    r2_access_key_id: string | null;
    r2_secret_key: string | null;
    r2_bucket: string | null;
} | null>;
//# sourceMappingURL=companySettings.d.ts.map