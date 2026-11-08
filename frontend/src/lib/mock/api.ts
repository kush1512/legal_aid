import type { LegalAidApi } from "../api/client";
import { ApiError } from "../api/errors";
import type * as T from "../api/types";
import { readJson, writeJson } from "../local/store";
import { uid } from "../utils";
import {
  CITATIONS, MOCK_DISCLAIMER, PROVISIONS, SEED_ASSESSMENTS, SEED_CASES, SEED_DOCUMENTS, SEED_LAWYERS, SEED_MESSAGES, SEED_POSTS,
} from "./data";

interface DB {
  cases: T.Case[];
  messages: Record<string, T.CaseMessage[]>;
  assessments: Record<string, T.CaseAssessment>;
  documents: Record<string, T.CaseDocument[]>;
  posts: T.CommunityPost[];
}
const KEY = "la.mock.v1";
const seed = (): DB => ({
  cases: structuredClone(SEED_CASES), messages: structuredClone(SEED_MESSAGES),
  assessments: structuredClone(SEED_ASSESSMENTS), documents: structuredClone(SEED_DOCUMENTS), posts: structuredClone(SEED_POSTS),
});
let db: DB | null = null;
const state = (): DB => (db ??= readJson<DB | null>(KEY, null) ?? seed());
const persist = () => writeJson(KEY, state());
export function resetMockData() { db = seed(); persist(); }

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 300));
const now = () => new Date().toISOString();
const page = <X,>(all: X[], limit = 20, offset = 0): T.Paginated<X> => ({
  items: all.slice(offset, offset + limit),
  page: { limit, offset, total: all.length, has_more: offset + limit < all.length },
});
const notFound = (what: string) => new ApiError(404, "RESOURCE_NOT_FOUND", `${what} not found`);
const mockAi = (blocked = false): T.AiMetadata => ({ provider: "mock", model: "mock-intake", is_mock: true, blocked });

const FOLLOW_UPS: Record<T.CaseCategory, string[]> = {
  property_real_estate: ["Do you have a written agreement, and is it registered?", "What proof of payment do you have?", "What is the property's exact location (district)?"],
  marriage_family: ["Are there children involved?", "Is anyone's immediate safety at risk?", "What documents (marriage certificate, orders) do you have?"],
  digital_fraud_cybercrime: ["When did the transaction happen and what is its reference number?", "Have you informed your bank and called 1930?", "Did you share any OTP, link or app access?"],
  personal_safety_privacy: ["Is the person still contacting or threatening you?", "Do you have screenshots with dates?", "Have you reported this to the platform or police?"],
};

function buildAssessment(c: T.Case, msgs: T.CaseMessage[], escalate: string | null): T.CaseAssessment {
  const userText = msgs.filter((m) => m.role === "user").map((m) => m.content);
  const laws: Record<T.CaseCategory, number[]> = { property_real_estate: [0, 1, 2], digital_fraud_cybercrime: [3, 4], marriage_family: [5], personal_safety_privacy: [4] };
  return {
    id: uid(), case_id: c.id, generated_at: now(),
    summary: `Preliminary summary from ${userText.length} message(s): ${userText[0].slice(0, 220)}${userText[0].length > 220 ? "…" : ""}`,
    parties: [{ name: "You", role: "Person seeking help" }, { name: "Other party (not named)", role: "Counterparty" }],
    timeline: userText.slice(0, 4).map((t) => ({ event: t.slice(0, 140), source: "user_provided" })),
    evidence: [{ item: "Documents or messages you mentioned", status: "not yet reviewed", relevance: "Upload or list them to strengthen the assessment" }],
    established_facts: userText.slice(0, 3).map((t) => t.slice(0, 120)),
    assumptions: ["Facts are as you described them and have not been verified"],
    unknowns: FOLLOW_UPS[c.category].slice(0, 2),
    legal_position: "Synthetic demonstration output. In live mode this section is generated only after verified legal sources are retrieved. Here it shows how a cautious, non-conclusive position statement is displayed.",
    potentially_relevant_laws: laws[c.category].map((i) => ({
      citation: CITATIONS[i], explanation: "Synthetic example of how the platform explains a provision and its possible relevance.",
      applicability: i === laws[c.category][0] ? "possible" : "uncertain",
    })),
    options: [{ title: "Gather and preserve evidence", description: "Collect dated records before taking any formal step.", risks: ["Delay may weaken some remedies"], next_steps: ["Save screenshots, receipts and messages", "Write a dated account in the Document studio"] }],
    follow_up_questions: FOLLOW_UPS[c.category].slice(0, 2),
    overall_uncertainty: "high", confidence: 0.3, escalation_required: Boolean(escalate), escalation_reason: escalate,
    disclaimer: MOCK_DISCLAIMER, model: { provider: "mock", name: "mock-assessment", version: "0", is_mock: true },
  };
}

const DRAFT_BODY: Record<T.DocumentType, string> = {
  legal_notice: "LEGAL NOTICE\n\nDate: [DATE]\nTo: [RECIPIENT NAME AND ADDRESS]\nFrom: [YOUR NAME AND ADDRESS]\n\nSubject: Notice regarding [SUBJECT]\n\n1. On [DATE OF AGREEMENT], the parties entered into [DESCRIBE AGREEMENT].\n2. I paid [AMOUNT] on [PAYMENT DATES] as agreed.\n3. Despite this, [DESCRIBE BREACH].\n\nYou are requested to [DEMAND] within [NUMBER] days of receiving this notice, failing which I may be advised to take appropriate legal steps.\n\n[YOUR NAME]\n[SIGNATURE]",
  complaint: "To,\nThe Officer In-Charge,\n[POLICE STATION / AUTHORITY]\n\nSubject: Complaint regarding [INCIDENT]\n\nI, [YOUR NAME], resident of [ADDRESS], wish to report that on [DATE] at [PLACE], [DESCRIBE WHAT HAPPENED IN FACTUAL ORDER].\n\nEvidence available: [LIST].\n\nI request that this complaint be recorded and appropriate action taken.\n\n[YOUR NAME]\n[CONTACT DETAILS]",
  reply: "Date: [DATE]\nTo: [SENDER]\n\nSubject: Reply to your communication dated [DATE]\n\n1. I acknowledge receipt of your communication.\n2. The statements in paragraph [NUMBER] are [ADMITTED / DENIED] because [REASON].\n3. My position is as follows: [POSITION].\n\n[YOUR NAME]",
  application: "To,\n[AUTHORITY / OFFICE]\n\nSubject: Application for [REQUEST]\n\nRespected Sir/Madam,\n\nI, [YOUR NAME], request [DESCRIBE REQUEST] because [REASON]. Supporting documents are enclosed: [LIST].\n\nYours faithfully,\n[YOUR NAME]",
  incident_summary: "INCIDENT SUMMARY (prepared by [YOUR NAME] on [DATE])\n\nTimeline\n- [DATE/TIME]: [EVENT]\n- [DATE/TIME]: [EVENT]\n\nPeople involved: [NAMES / ROLES]\nEvidence: [LIST]\nSteps already taken: [LIST]",
  evidence_checklist: "EVIDENCE CHECKLIST\n\n[ ] Agreement or written communication\n[ ] Proof of payment or loss ([BANK STATEMENT / RECEIPT])\n[ ] Screenshots with visible dates\n[ ] Names and contact details of witnesses\n[ ] Reports or complaint numbers already filed ([REFERENCE])",
};

export const mockApi: LegalAidApi = {
  mode: "mock",
  async health() {
    await wait(120);
    return { status: "ok", version: "mock", environment: "mock", dependencies: { database: "browser_storage", llm: "mock", embeddings: "none" } };
  },
  async createCase(req) {
    await wait();
    const s = state();
    const id = uid();
    const t = now();
    const c: T.Case = {
      id, title: req.title || req.description.trim().split("\n")[0].slice(0, 120), category: req.category, status: "intake",
      jurisdiction: req.jurisdiction ?? { country: "IN" }, preferred_language: req.preferred_language ?? "en",
      sensitive: req.sensitive ?? (req.category === "personal_safety_privacy"), synthetic_demo: req.synthetic_demo ?? false, created_at: t, updated_at: t, latest_message_at: t,
    };
    const initial: T.CaseMessage = { id: uid(), case_id: id, role: "user", content: req.description, created_at: t, ai_metadata: null };
    s.cases.unshift(c); s.messages[id] = [initial]; persist();
    return { case: c, initial_message: initial };
  },
  async listCases(q = {}) {
    await wait(250);
    let items = [...state().cases].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (q.category) items = items.filter((c) => c.category === q.category);
    if (q.status) items = items.filter((c) => c.status === q.status);
    return page(items, q.limit, q.offset);
  },
  async getCase(id) {
    await wait(200);
    const c = state().cases.find((x) => x.id === id);
    if (!c) throw notFound("Case");
    return { case: c };
  },
  async updateCasePrivacy(id, privateConversation) {
    await wait(150);
    const c = state().cases.find((x) => x.id === id);
    if (!c) throw notFound("Case");
    c.private_conversation = privateConversation;
    persist();
    return { case: c };
  },
  async updateCaseSensitivity(id, sensitive) {
    await wait(150);
    const c = state().cases.find((x) => x.id === id);
    if (!c) throw notFound("Case");
    c.sensitive = sensitive;
    c.updated_at = now();
    persist();
    return { case: c };
  },
  async sendMessage(id, req) {
    await wait(700);
    const s = state();
    const c = s.cases.find((x) => x.id === id);
    if (!c) throw notFound("Case");
    const t = now();
    const user: T.CaseMessage = { id: uid(), case_id: id, role: "user", content: req.content, created_at: t, ai_metadata: null };
    s.messages[id] = [...(s.messages[id] ?? []), user];
    // Mirrors backend behaviour: sensitive cases without explicit consent never reach an AI provider.
    const blocked = c.sensitive && !req.external_ai_consent;
    let reply: string, ai: T.AiMetadata, followUps: string[] = [], status: T.CaseStatus = "needs_information";
    if (blocked) {
      reply = "This case is marked sensitive and you have not allowed external AI processing, so nothing was sent to an AI service. You can keep adding dates, people involved, documents and steps already taken.";
      ai = { provider: "privacy_gate", model: "none", is_mock: false, blocked: true };
    } else {
      const userCount = s.messages[id].filter((m) => m.role === "user").length;
      const danger = /(threat|kill|hurt|beat|danger|stalk|acid)/i.test(req.content) ? "Your message mentions possible danger to safety." : null;
      status = userCount >= 2 ? "analysed" : "needs_information";
      followUps = userCount >= 2 ? [] : FOLLOW_UPS[c.category].slice(0, 2);
      reply = userCount >= 2
        ? "Thanks — I have updated the preliminary assessment with what you shared. Review it, and consider a verified lawyer before taking formal steps. (Demo reply)"
        : "Thanks for the detail. To understand your position better, please answer the questions below. (Demo reply)";
      ai = mockAi();
      if (userCount >= 2 || danger) s.assessments[id] = buildAssessment(c, s.messages[id], danger);
    }
    const assistant: T.CaseMessage = {
      id: uid(), case_id: id, role: "assistant", content: reply, created_at: now(),
      ai_metadata: { provider: ai.provider, model: ai.model, is_mock: ai.is_mock },
    };
    s.messages[id].push(assistant);
    c.status = status; c.updated_at = assistant.created_at; c.latest_message_at = assistant.created_at;
    persist();
    return { user_message: user, assistant_message: assistant, case_status: status, follow_up_questions: followUps, extracted_facts: [], ai };
  },
  async getAssessment(id) {
    await wait(300);
    if (!state().cases.some((c) => c.id === id)) throw notFound("Case");
    const a = state().assessments[id];
    if (!a) throw new ApiError(404, "ASSESSMENT_NOT_FOUND", "No completed assessment is available yet.");
    return { assessment: a };
  },
  async generateAssessment(id) {
    await wait(500);
    const s = state();
    const c = s.cases.find((item) => item.id === id);
    if (!c) throw notFound("Case");
    const assessment = buildAssessment(c, s.messages[id] ?? [], null);
    s.assessments[id] = assessment;
    c.status = "analysed";
    c.updated_at = assessment.generated_at;
    persist();
    return { assessment };
  },
  async listCaseDocuments(id) {
    await wait(200);
    return page(state().documents[id] ?? []);
  },
  async searchLegal(req) {
    await wait(500);
    const q = req.query.toLowerCase();
    const results = CITATIONS.filter((c) => !req.category || true)
      .filter((c) => `${c.act_name} ${c.section_label} ${c.title} ${c.excerpt}`.toLowerCase().split(/\W+/).some((w) => w.length > 3 && q.includes(w)))
      .slice(0, req.limit ?? 10)
      .map((citation, i) => ({ citation, relevance_score: Math.max(0.3, 0.82 - i * 0.12), retrieval_method: "hybrid" as const }));
    return { results, warning: "Retrieved provisions require fact-specific applicability review. (Mock results — placeholders only.)" };
  },
  async getProvision(id) {
    await wait(250);
    const p = PROVISIONS[id];
    if (!p) throw notFound("Provision");
    return { provision: p };
  },
  async generateDocument(req) {
    await wait(1800);
    const body = DRAFT_BODY[req.document_type];
    const placeholders = Array.from(new Set(body.match(/\[[A-Z0-9 /,'’.()-]+\]/g) ?? []));
    const type = req.document_type.replace(/_/g, " ");
    const draft: T.GeneratedDraft = {
      id: uid(), case_id: req.case_id ?? null, document_type: req.document_type,
      title: type.charAt(0).toUpperCase() + type.slice(1) + " (draft)",
      content: (req.instructions ? `[Your instruction: ${req.instructions}]\n\n` : "") + body,
      placeholders, citations: [], review_required: true, created_at: now(),
      model: { provider: "mock", name: "mock-draft", is_mock: true },
    };
    return { draft };
  },
  async listPosts(q = {}) {
    await wait(300);
    let items = [...state().posts];
    if (q.category) items = items.filter((p) => p.category === q.category);
    items.sort(q.sort === "popular" ? (a, b) => b.vote_count - a.vote_count : (a, b) => b.created_at.localeCompare(a.created_at));
    return page(items, q.limit, q.offset);
  },
  async createPost(req) {
    await wait(500);
    const post: T.CommunityPost = {
      id: uid(), title: req.title, content: req.content, category: req.category, anonymous: req.anonymous,
      display_name: req.anonymous ? "Anonymous" : "Community member", created_at: now(), comment_count: 0, vote_count: 0,
      moderation_status: "pending",
    };
    // Real backend holds new posts for moderation; the mock shows it locally so the creator can see it.
    state().posts.unshift(post); persist();
    return { post };
  },
  async listLawyers(q = {}) {
    await wait(300);
    let items = SEED_LAWYERS.filter((l) => l.verification_status === "verified");
    if (q.category) items = items.filter((l) => l.practice_areas.includes(q.category!));
    if (q.state) items = items.filter((l) => l.state?.toLowerCase() === q.state!.toLowerCase());
    if (q.city) items = items.filter((l) => l.city?.toLowerCase().includes(q.city!.toLowerCase()));
    if (q.language) items = items.filter((l) => l.languages.includes(q.language!));
    return page(items, q.limit, q.offset);
  },
  async getLawyer(id) {
    await wait(250);
    const l = SEED_LAWYERS.find((x) => x.id === id);
    if (!l) throw notFound("Lawyer");
    return { lawyer: l };
  },
  async transcribe(_file, opts) {
    await wait(1200);
    if (!opts.externalAiConsent) throw new ApiError(403, "PRIVACY_GATE_BLOCKED", "External speech processing requires consent.");
    return { transcript: "[Demo transcript] The seller took my payment in March but has not handed over the plot and has stopped answering my calls.", provider: "mock", model: "mock-stt", audio_stored: false };
  },
};
