import { readJson, writeJson } from "./store";
import type { DemoComment } from "../mock/demo-extras";

/**
 * Community interactions that the backend contract does not yet support
 * (votes, comments, reporting, blocking, hiding, private messages).
 * They are stored in THIS browser only and the UI labels them accordingly.
 */
export interface CommunityLocal {
  votes: Record<string, 1 | -1>; // post/comment id -> my vote
  hidden: string[]; // hidden comment/post ids
  blocked: string[]; // blocked display names
  reported: Record<string, string>; // id -> reason
  comments: Record<string, DemoComment[]>; // postId -> my additional comments
  messages: Record<string, Array<{ from: "me" | "them"; text: string; at: string }>>; // lawyer/user key -> thread
}
const KEY = "la.community.v1";
const EMPTY: CommunityLocal = { votes: {}, hidden: [], blocked: [], reported: {}, comments: {}, messages: {} };

export const loadCommunity = (): CommunityLocal => ({ ...EMPTY, ...readJson<Partial<CommunityLocal>>(KEY, {}) });
export const saveCommunity = (c: CommunityLocal) => writeJson(KEY, c);
