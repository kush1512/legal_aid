import { readJson, writeJson } from "./store";

export interface Prefs {
  language: string;
  /** Default for the "allow external AI" checkbox. Always re-confirmed per action. */
  defaultExternalAiConsent: boolean;
  /** Default for the community "post anonymously" switch. */
  defaultAnonymousPosting: boolean;
  /** Default for new cases' "sensitive" flag. Contract defaults to true. */
  defaultSensitive: boolean;
  shareAggregateInsights: boolean;
  consentLog: Array<{ at: string; scope: string; granted: boolean }>;
}

export const DEFAULT_PREFS: Prefs = {
  language: "en",
  defaultExternalAiConsent: false,
  defaultAnonymousPosting: true,
  defaultSensitive: false,
  shareAggregateInsights: false,
  consentLog: [],
};
const KEY = "la.prefs.v1";

export const loadPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...readJson<Partial<Prefs>>(KEY, {}) });
export const savePrefs = (p: Prefs) => writeJson(KEY, p);
