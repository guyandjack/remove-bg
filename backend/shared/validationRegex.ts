export type RegexDef = {
  /**
   * Pattern source without leading/trailing slashes.
   * Keep it in sync across backend/frontend by importing this module.
   */
  source: string;
  /**
   * JS RegExp flags (ex: "u"). Keep empty string when no flags.
   * Note: do NOT use "i" (case-insensitive): validations must stay case-sensitive.
   */
  flags: string;
};

export type ValidationRegexCatalog = {
  name: RegexDef;
  subject: RegexDef;
  email: RegexDef;
  otp6: RegexDef;
  passwordLower: RegexDef;
  passwordUpper: RegexDef;
  passwordDigit: RegexDef;
  passwordSpecial: RegexDef;
  password: RegexDef;
  message: RegexDef;
  filename: RegexDef;
};

export type ValidationLimits = {
  name: { min: number; max: number };
  subject: { min: number; max: number };
  message: { min: number; max: number };
  password: { min: number; max: number; maxBytesForBcrypt: number };
  filename: { max: number };
};

export const validationLimits: ValidationLimits = {
  name: { min: 2, max: 30 },
  subject: { min: 2, max: 50 },
  message: { min: 8, max: 2000 },
  // bcrypt truncates at 72 bytes. Keep max=72 to match existing backend behavior.
  password: { min: 8, max: 72, maxBytesForBcrypt: 72 },
  filename: { max: 200 },
};

/**
 * Single source of truth for validation regex (backend + frontend).
 * Requirements:
 * - accept apostrophes in names/subjects
 * - case-sensitive (no "i" flag)
 */
export const validationRegex: ValidationRegexCatalog = {
  // Letters (Unicode) + combining marks, with apostrophes and dashes/spaces.
  // Examples: "Jean-Pierre", "D'Amour", "Élodie", "João", "O’Connor"
  name: { source: "^[\\p{L}][\\p{L}\\p{M}'’ -]*$", flags: "u" },

  // Subject: letters + marks + digits + spaces/dashes/apostrophes.
  subject: { source: "^[\\p{L}\\p{M}0-9'’ -]+$", flags: "u" },

  // Email: intentionally case-sensitive (A-Z included explicitly).
  // Backend normalizes toLowerCase, but frontend must not block uppercase.
  email: {
    source: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,80}$",
    flags: "",
  },

  otp6: { source: "^\\d{6}$", flags: "" },

  passwordLower: { source: "[a-z]", flags: "" },
  passwordUpper: { source: "[A-Z]", flags: "" },
  passwordDigit: { source: "\\d", flags: "" },
  passwordSpecial: { source: "[^\\w\\s]", flags: "" },

  // Password rules (aligned with backend Zod):
  // - 8..72 chars
  // - at least 1 lowercase, 1 uppercase, 1 digit, 1 special (non-word/non-space)
  password: {
    source: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,72}$",
    flags: "",
  },

  // Message: allow any char, length enforced separately (min/max).
  message: { source: "^[\\s\\S]*$", flags: "" },

  // Basic filename sanity: no NUL, length enforced separately.
  filename: { source: "^[^\\0]*$", flags: "" },
};

export function toRegExp(def: RegexDef): RegExp {
  return new RegExp(def.source, def.flags);
}
