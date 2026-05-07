type RegexDef = { source: string; flags: string };
type ValidationRegexCatalog = Record<string, RegexDef>;
type ValidationLimits = Record<string, any>;

type BackendModule = {
  validationRegex: ValidationRegexCatalog;
  validationLimits: ValidationLimits;
  toRegExp: (def: RegexDef) => RegExp;
};

const fallback: BackendModule = {
  // Keep this fallback strictly identical to `backend/shared/validationRegex.ts`.
  // It is only used when the backend file isn't present in this workspace.
  validationLimits: {
    name: { min: 2, max: 30 },
    subject: { min: 2, max: 50 },
    message: { min: 8, max: 2000 },
    password: { min: 8, max: 72, maxBytesForBcrypt: 72 },
    filename: { max: 200 },
  },
  validationRegex: {
    name: { source: "^[\\p{L}][\\p{L}\\p{M}'’ -]*$", flags: "u" },
    subject: { source: "^[\\p{L}\\p{M}0-9'’ -]+$", flags: "u" },
    email: {
      source: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,80}$",
      flags: "",
    },
    otp6: { source: "^\\d{6}$", flags: "" },
    passwordLower: { source: "[a-z]", flags: "" },
    passwordUpper: { source: "[A-Z]", flags: "" },
    passwordDigit: { source: "\\d", flags: "" },
    passwordSpecial: { source: "[^\\w\\s]", flags: "" },
    password: {
      source: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{8,72}$",
      flags: "",
    },
    message: { source: "^[\\s\\S]*$", flags: "" },
    filename: { source: "^[^\\0]*$", flags: "" },
  } satisfies ValidationRegexCatalog,
  toRegExp: (def: RegexDef) => new RegExp(def.source, def.flags),
};

const backendImporters = import.meta.glob<BackendModule>(
  "../../backend/shared/validationRegex.ts",
  { eager: true }
);

const backendModule: BackendModule =
  (Object.values(backendImporters)[0] as BackendModule | undefined) ?? fallback;

export const validationLimits = backendModule.validationLimits;
export const validationRegex = backendModule.validationRegex;
export const toRegExp = backendModule.toRegExp;

export const REGEX = {
  name: toRegExp(validationRegex.name),
  subject: toRegExp(validationRegex.subject),
  email: toRegExp(validationRegex.email),
  otp6: toRegExp(validationRegex.otp6),
  password: toRegExp(validationRegex.password),
  passwordLower: toRegExp(validationRegex.passwordLower),
  passwordUpper: toRegExp(validationRegex.passwordUpper),
  passwordDigit: toRegExp(validationRegex.passwordDigit),
  passwordSpecial: toRegExp(validationRegex.passwordSpecial),
  message: toRegExp(validationRegex.message),
  filename: toRegExp(validationRegex.filename),
} as const;
