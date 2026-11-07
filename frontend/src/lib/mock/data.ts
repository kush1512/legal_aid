import type {
  Case, CaseAssessment, CaseDocument, CaseMessage, CommunityPost, Lawyer, LegalCitation, Provision,
} from "../api/types";

/** ALL DATA IN THIS FILE IS SYNTHETIC and exists only to demonstrate the UI. */
export const MOCK_DISCLAIMER =
  "Synthetic demonstration output. Not verified legal advice, and no real AI model or legal database produced it.";

const iso = (daysAgo: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const ids = {
  case1: "c0000001-0000-4000-8000-000000000001",
  case2: "c0000002-0000-4000-8000-000000000002",
  case3: "c0000003-0000-4000-8000-000000000003",
};

export const cite = (n: number, act: string, section: string, title: string, excerpt: string): LegalCitation => ({
  id: `a0000000-0000-4000-8000-00000000000${n}`,
  legal_document_id: `d0000000-0000-4000-8000-00000000000${n}`,
  act_name: act,
  section_label: section,
  title,
  source_url: "https://www.indiacode.nic.in/",
  source_status: "unverified",
  effective_from: null,
  effective_to: null,
  excerpt: `[Synthetic placeholder for UI demonstration] ${excerpt}`,
});

export const CITATIONS: LegalCitation[] = [
  cite(1, "Transfer of Property Act, 1882", "Section 55", "Rights and liabilities of buyer and seller", "Describes duties of seller and buyer on a sale, including delivery of possession on payment."),
  cite(2, "Specific Relief Act, 1963", "Section 10", "Cases in which specific performance enforceable", "Describes when a court may order a contract to be performed."),
  cite(3, "Registration Act, 1908", "Section 17", "Documents of which registration is compulsory", "Lists documents that must be registered, including certain instruments concerning immovable property."),
  cite(4, "Information Technology Act, 2000", "Section 66D", "Cheating by personation using computer resource", "Addresses cheating by personation using a computer resource or communication device."),
  cite(5, "Bharatiya Nyaya Sanhita, 2023", "Section 318", "Cheating", "Defines cheating and prescribes punishment."),
  cite(6, "Protection of Women from Domestic Violence Act, 2005", "Section 12", "Application to Magistrate", "Describes how an aggrieved person may apply to a Magistrate for relief."),
];

export const PROVISIONS: Record<string, Provision> = Object.fromEntries(
  CITATIONS.map((c) => [
    c.id,
    {
      citation: c,
      full_text:
        `[Synthetic placeholder text — the real statutory text is not included in mock mode.]\n\n${c.act_name}, ${c.section_label}\n${c.title}\n\n` +
        "In live mode this panel shows the exact indexed text of the provision, retrieved from the backend's verified legal knowledge base, together with its document version and effective dates.",
      document_version: "mock-0",
      effective_from: null,
      effective_to: null,
      jurisdiction: "IN",
    } satisfies Provision,
  ]),
);

export const SEED_CASES: Case[] = [
  {
    id: ids.case1, title: "Seller has not handed over possession after full payment", category: "property_real_estate",
    status: "analysed", jurisdiction: { country: "IN", state: "Assam", district: "Kamrup" }, preferred_language: "en",
    sensitive: false, created_at: iso(12), updated_at: iso(2), latest_message_at: iso(2),
  },
  {
    id: ids.case2, title: "Unauthorised UPI debit of ₹18,500", category: "digital_fraud_cybercrime",
    status: "needs_information", jurisdiction: { country: "IN", state: "Assam" }, preferred_language: "hi",
    sensitive: true, created_at: iso(3), updated_at: iso(3), latest_message_at: iso(3),
  },
  {
    id: ids.case3, title: "Rental deposit not returned after vacating", category: "property_real_estate",
    status: "intake", jurisdiction: { country: "IN", state: "Assam", city: "Guwahati" }, preferred_language: "en",
    sensitive: false, created_at: iso(1), updated_at: iso(1), latest_message_at: iso(1),
  },
];

const m = (id: string, caseId: string, role: "user" | "assistant", content: string, d: number, h: number): CaseMessage => ({
  id, case_id: caseId, role, content, created_at: iso(d, h),
  ai_metadata: role === "assistant" ? { provider: "mock", model: "mock-intake", is_mock: true } : null,
});

export const SEED_MESSAGES: Record<string, CaseMessage[]> = {
  [ids.case1]: [
    m("m0000001-0000-4000-8000-000000000001", ids.case1, "user", "I paid ₹14 lakh in full for a plot in March under a written agreement. The seller keeps postponing handing over possession and now stopped answering calls.", 12, 10),
    m("m0000001-0000-4000-8000-000000000002", ids.case1, "assistant", "Thanks for the detail. I have noted the payment and the delay. To understand your position: was the agreement registered, and do you have proof of how the payment was made?", 12, 10),
    m("m0000001-0000-4000-8000-000000000003", ids.case1, "user", "The agreement is on stamp paper but not registered. Payment was by bank transfer in two parts; I have the statements.", 2, 9),
    m("m0000001-0000-4000-8000-000000000004", ids.case1, "assistant", "Understood. I have updated the preliminary assessment with the unregistered agreement and the bank evidence. Review it, and consider speaking to a verified lawyer before sending any notice.", 2, 9),
  ],
  [ids.case2]: [
    m("m0000002-0000-4000-8000-000000000001", ids.case2, "user", "मेरे खाते से अनजान UPI लेनदेन में ₹18,500 कट गए। मैंने कोई OTP साझा नहीं किया।", 3, 11),
    m("m0000002-0000-4000-8000-000000000002", ids.case2, "assistant", "This case is marked sensitive. No external AI provider was contacted. You can continue by adding dates, the transaction reference and steps already taken. If money is still at risk, contact your bank's fraud helpline immediately and report at cybercrime.gov.in or call 1930.", 3, 11),
  ],
  [ids.case3]: [
    m("m0000003-0000-4000-8000-000000000001", ids.case3, "user", "My landlord is refusing to return a ₹40,000 security deposit although I vacated a month ago and left the flat clean.", 1, 15),
  ],
};

export const SEED_ASSESSMENTS: Record<string, CaseAssessment> = {
  [ids.case1]: {
    id: "e0000001-0000-4000-8000-000000000001", case_id: ids.case1, generated_at: iso(2, 9),
    summary: "You say you paid the full price of ₹14 lakh for a plot under a written agreement, and the seller has not delivered possession and is no longer responding.",
    parties: [
      { name: "You", role: "Buyer", description: "Paid in full by bank transfer in two parts" },
      { name: "Seller (name not provided)", role: "Seller", description: "Has not handed over possession; not responding" },
    ],
    timeline: [
      { date: "March (year not stated)", event: "Agreement on stamp paper signed; full payment made in two transfers", source: "user_provided" },
      { event: "Seller repeatedly postponed handing over possession", source: "user_provided" },
      { event: "Seller stopped answering calls", source: "user_provided" },
    ],
    evidence: [
      { item: "Agreement on stamp paper", status: "held", relevance: "Not registered — may affect enforceability and should be reviewed by a lawyer" },
      { item: "Bank statements for both transfers", status: "held", relevance: "Proves payment" },
      { item: "Call logs / messages with the seller", status: "unknown", relevance: "Would show postponements and non-response" },
    ],
    established_facts: ["Full price of ₹14 lakh paid by bank transfer", "Agreement exists on stamp paper", "Possession not delivered"],
    assumptions: ["The plot is identifiable from the agreement", "Seller is the registered owner (not confirmed)"],
    unknowns: ["Whether the seller holds clear title", "Agreed date for possession", "Whether any part of the agreement was registered"],
    legal_position:
      "Based only on what you have said, this looks like a dispute over delivery of possession after payment. Which remedies are open depends on registration status, title and the agreement's terms, which a lawyer must review. This is general information, not an opinion on your case.",
    potentially_relevant_laws: [
      { citation: CITATIONS[0], explanation: "Describes duties of seller and buyer on a sale. May be relevant to delivery of possession after payment.", applicability: "possible" },
      { citation: CITATIONS[1], explanation: "A court may in some circumstances order a contract to be performed. Depends on the agreement's validity and terms.", applicability: "uncertain" },
      { citation: CITATIONS[2], explanation: "Certain property documents must be registered. Your agreement is unregistered, so this needs lawyer review.", applicability: "uncertain" },
    ],
    options: [
      { title: "Send a legal notice", description: "A written demand for possession or refund, giving a reasonable deadline.", risks: ["May escalate the dispute", "Should be reviewed by a lawyer first"], next_steps: ["Collect the agreement and bank statements", "Draft a notice in the Document studio", "Have a verified lawyer review it"] },
      { title: "Consult a property lawyer", description: "Check title, registration issues and the right forum before acting.", risks: ["Consultation fees apply"], next_steps: ["Shortlist lawyers who practise property law in your district", "Bring all documents to the first meeting"] },
    ],
    follow_up_questions: ["Did the agreement name a date for possession?", "Have you checked the title with the sub-registrar's office?"],
    overall_uncertainty: "high", confidence: 0.35, escalation_required: false, escalation_reason: null,
    disclaimer: MOCK_DISCLAIMER,
    model: { provider: "mock", name: "mock-assessment", version: "0", is_mock: true },
  },
};

export const SEED_DOCUMENTS: Record<string, CaseDocument[]> = {
  [ids.case1]: [
    { id: "f0000001-0000-4000-8000-000000000001", case_id: ids.case1, file_name: "agreement_stamp_paper.pdf", mime_type: "application/pdf", size_bytes: 482113, created_at: iso(12) },
    { id: "f0000001-0000-4000-8000-000000000002", case_id: ids.case1, file_name: "bank_statement_march.pdf", mime_type: "application/pdf", size_bytes: 221904, created_at: iso(12) },
  ],
};

const lw = (n: number, name: string, areas: Lawyer["practice_areas"], langs: string[], city: string, state: string, juris: string[], bio: string): Lawyer => ({
  id: `b0000000-0000-4000-8000-00000000000${n}`, display_name: name,
  bar_council_enrolment: `DEMO/${1000 + n}/20${10 + n}`, jurisdictions: juris, practice_areas: areas,
  languages: langs, verification_status: "verified", bio, city, state,
});

export const SEED_LAWYERS: Lawyer[] = [
  lw(1, "Adv. Meera Baruah (demo)", ["property_real_estate", "marriage_family"], ["en", "as", "hi"], "Guwahati", "Assam", ["Gauhati High Court", "Kamrup District Courts"], "Synthetic profile. Handles title disputes, possession suits and rental matters."),
  lw(2, "Adv. Rohan Iyer (demo)", ["digital_fraud_cybercrime", "personal_safety_privacy"], ["en", "hi", "ta"], "Chennai", "Tamil Nadu", ["Madras High Court"], "Synthetic profile. Focus on online financial fraud and privacy complaints."),
  lw(3, "Adv. Farida Sheikh (demo)", ["marriage_family"], ["en", "hi", "bn"], "Kolkata", "West Bengal", ["Calcutta High Court"], "Synthetic profile. Family law and domestic-violence protection matters."),
  lw(4, "Adv. Dhiraj Kalita (demo)", ["property_real_estate"], ["as", "en"], "Dibrugarh", "Assam", ["Dibrugarh District Courts", "Gauhati High Court"], "Synthetic profile. Land and revenue matters in Upper Assam."),
  lw(5, "Adv. Sunita Deshmukh (demo)", ["personal_safety_privacy", "marriage_family"], ["en", "mr", "hi"], "Pune", "Maharashtra", ["Bombay High Court"], "Synthetic profile. Harassment, stalking and image-misuse complaints."),
  lw(6, "Adv. Imran Qureshi (demo)", ["digital_fraud_cybercrime", "property_real_estate"], ["en", "hi"], "Delhi", "Delhi", ["Delhi High Court", "Supreme Court of India"], "Synthetic profile. Cyber-fraud recovery and consumer disputes."),
];

const p = (n: number, title: string, content: string, cat: CommunityPost["category"], anon: boolean, name: string, d: number, comments: number, votes: number): CommunityPost => ({
  id: `p0000000-0000-4000-8000-00000000000${n}`, title, content, category: cat, anonymous: anon,
  display_name: anon ? "Anonymous" : name, created_at: iso(d, 12), comment_count: comments, vote_count: votes,
});

export const SEED_POSTS: CommunityPost[] = [
  p(1, "How do I document a rental deposit dispute?", "My landlord says the deposit is adjusted against 'damages' but never gave a list. What records should I keep?", "property_real_estate", true, "", 1, 3, 24),
  p(2, "Lost money to a UPI refund scam — what did the first 24 hours look like for you?", "Looking for practical experiences on reporting to the bank and the cyber portal, and what proof helped.", "digital_fraud_cybercrime", true, "", 2, 4, 41),
  p(3, "Is an unregistered sale agreement worth anything?", "General question for people who went through this: what options did you explore?", "property_real_estate", false, "Community member", 4, 2, 17),
  p(4, "Someone is posting my photos with false claims. Where do I start?", "I'm trying to understand preserving evidence before reporting. Any general guidance?", "personal_safety_privacy", true, "", 5, 3, 33),
  p(5, "Questions to ask a lawyer in a first family-law consultation", "Compiling a checklist for people nervous about their first meeting.", "marriage_family", false, "Community member", 7, 1, 12),
];
