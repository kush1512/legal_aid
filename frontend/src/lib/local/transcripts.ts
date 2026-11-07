import type { CaseMessage } from "../api/types";
import { readJson, writeJson, removeKey } from "./store";

/**
 * The backend contract has no endpoint to list a case's messages. The UI
 * therefore keeps the conversation it has seen in this browser TAB
 * (sessionStorage — cleared when the tab closes) so the case page can
 * show it. This is a known gap: see API_INTEGRATION.md "Backend gaps".
 */
const key = (caseId: string) => `la.transcript.${caseId}`;

export function loadTranscript(caseId: string): CaseMessage[] {
  return readJson<CaseMessage[]>(key(caseId), [], "session");
}
export function saveTranscript(caseId: string, messages: CaseMessage[]) {
  writeJson(key(caseId), messages, "session");
}
export function appendToTranscript(caseId: string, ...messages: CaseMessage[]) {
  const cur = loadTranscript(caseId);
  const ids = new Set(cur.map((m) => m.id));
  saveTranscript(caseId, [...cur, ...messages.filter((m) => !ids.has(m.id))]);
}
export function clearTranscript(caseId: string) {
  removeKey(key(caseId), "session");
}
