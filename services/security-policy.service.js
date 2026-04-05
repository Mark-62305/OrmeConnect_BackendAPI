const db = require("../config/db");

const DEFAULT_SECURITY_POLICIES = {
    minPasswordLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecialChar: false,
    sessionTimeoutMinutes: 30,
    enforceAdmin2FA: false,
};

function safeNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function normalizePolicies(raw = {}) {
    return {
        minPasswordLength: Math.min(128, Math.max(6, safeNumber(raw.minPasswordLength, DEFAULT_SECURITY_POLICIES.minPasswordLength))),
        requireUppercase: !!raw.requireUppercase,
        requireNumber: !!raw.requireNumber,
        requireSpecialChar: !!raw.requireSpecialChar,
        sessionTimeoutMinutes: Math.min(720, Math.max(5, safeNumber(raw.sessionTimeoutMinutes, DEFAULT_SECURITY_POLICIES.sessionTimeoutMinutes))),
        enforceAdmin2FA: !!raw.enforceAdmin2FA,
    };
}

function parseSettingValue(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
        return JSON.parse(raw);
    } catch (_) {
        return {};
    }
}

async function getSecurityPolicies() {
    try {
        const [rows] = await db.query(
            "SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1", ["securityPolicies"]
        );

        if (!Array.isArray(rows) || rows.length === 0) {
            return {...DEFAULT_SECURITY_POLICIES };
        }

        const parsed = parseSettingValue(rows[0].setting_value);
        return normalizePolicies({...DEFAULT_SECURITY_POLICIES, ...parsed });
    } catch (_) {
        return {...DEFAULT_SECURITY_POLICIES };
    }
}

function validatePasswordAgainstPolicy(password, policy = DEFAULT_SECURITY_POLICIES) {
    const pwd = String(password || "");
    const rules = normalizePolicies(policy);
    const errors = [];

    if (pwd.length < rules.minPasswordLength) {
        errors.push(`Password must be at least ${rules.minPasswordLength} characters.`);
    }

    if (rules.requireUppercase && !/[A-Z]/.test(pwd)) {
        errors.push("Password must include at least one uppercase letter.");
    }

    if (rules.requireNumber && !/\d/.test(pwd)) {
        errors.push("Password must include at least one number.");
    }

    if (rules.requireSpecialChar && !/[^A-Za-z0-9]/.test(pwd)) {
        errors.push("Password must include at least one special character.");
    }

    return errors;
}

module.exports = {
    DEFAULT_SECURITY_POLICIES,
    getSecurityPolicies,
    validatePasswordAgainstPolicy,
};