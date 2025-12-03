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
    searchBase?: string; // Keep for backward compatibility
    searchBases?: string[]; // New: array of search bases
}

export interface PasswordPolicy {
    minLength: number;
    complexityEnabled: boolean;
    historyCount: number;
    minAge: number;
    maxAge: number;
    lockoutThreshold: number;
    lockoutDuration: number;
    lockoutObservationWindow: number;
}

export interface PasswordChangeRequest {
    userDN: string;
    newPassword: string;
    userId?: string;
}

export interface PasswordValidation {
    valid: boolean;
    errors: string[];
    requirements: {
        minLength: boolean;
        hasUppercase: boolean;
        hasLowercase: boolean;
        hasNumber: boolean;
        hasSpecial: boolean;
        notContainsUsername: boolean;
    };
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
