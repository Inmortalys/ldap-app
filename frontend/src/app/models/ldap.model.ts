export interface LdapUser {
    dn: string;
    cn: string;
    sAMAccountName: string;
    sn?: string;
    givenName?: string;
    mail?: string;
    isLocked: boolean;
    isDisabled?: boolean;
    lockoutTime?: Date | null;
    pwdChangedTime?: Date | null;
    pwdExpiryDate?: Date | null;
    daysUntilExpiry?: number | null;
}

export interface LdapConfig {
    server: string;
    port: number;
    baseDN: string;
    adminDN: string;
    adminPassword?: string;
    searchBase?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
