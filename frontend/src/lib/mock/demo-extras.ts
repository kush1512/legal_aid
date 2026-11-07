/**
 * FRONTEND-ONLY demonstration data for screens whose fields are NOT in the
 * backend contract (lawyer experience/fees/portfolio/friend recommendations,
 * threaded comments, lawyer endorsements). Shown only in mock mode and
 * always labelled "Demo". In real mode these screens show "Not provided".
 */
export interface LawyerExtras {
  experience_years: number;
  fee_note: string; // disclosed fee, free text
  availability: string;
  portfolio: Array<{ title: string; outcome: string }>;
  friend_recommendations: number; // aggregate only — no names
  consultation_modes: string[];
}

export const LAWYER_EXTRAS: Record<string, LawyerExtras> = {
  "b0000000-0000-4000-8000-000000000001": { experience_years: 14, fee_note: "First consultation ₹800 (30 min)", availability: "Mon–Sat, 10:00–17:00", portfolio: [{ title: "Possession suit, residential plot", outcome: "Settled with delivery of possession" }, { title: "Tenancy deposit recovery", outcome: "Deposit returned after notice" }], friend_recommendations: 7, consultation_modes: ["In person", "Video call"] },
  "b0000000-0000-4000-8000-000000000002": { experience_years: 9, fee_note: "First consultation ₹1,000 (30 min)", availability: "Weekdays, evenings", portfolio: [{ title: "Card-fraud chargeback dispute", outcome: "Bank reversed the amount" }], friend_recommendations: 4, consultation_modes: ["Video call", "Phone"] },
  "b0000000-0000-4000-8000-000000000003": { experience_years: 18, fee_note: "Fees disclosed after intake call", availability: "Tue–Sat", portfolio: [{ title: "Protection order application", outcome: "Interim order granted" }], friend_recommendations: 11, consultation_modes: ["In person", "Phone"] },
  "b0000000-0000-4000-8000-000000000004": { experience_years: 11, fee_note: "First consultation ₹600", availability: "Mon–Fri, 9:00–15:00", portfolio: [{ title: "Land mutation dispute", outcome: "Mutation corrected" }], friend_recommendations: 3, consultation_modes: ["In person"] },
  "b0000000-0000-4000-8000-000000000005": { experience_years: 7, fee_note: "First consultation ₹700", availability: "Weekends", portfolio: [{ title: "Image-misuse takedown & complaint", outcome: "Content removed; complaint registered" }], friend_recommendations: 5, consultation_modes: ["Video call", "Phone"] },
  "b0000000-0000-4000-8000-000000000006": { experience_years: 16, fee_note: "First consultation ₹1,500", availability: "Mon–Fri", portfolio: [{ title: "UPI fraud recovery", outcome: "Partial recovery through bank process" }], friend_recommendations: 8, consultation_modes: ["Video call", "In person"] },
};

export interface DemoComment {
  id: string;
  author: string; // display name only
  anonymous: boolean;
  lawyer?: "written" | "endorsed";
  body: string;
  votes: number;
  replies?: DemoComment[];
}

export const DEMO_COMMENTS: Record<string, DemoComment[]> = {
  "p0000000-0000-4000-8000-000000000001": [
    { id: "k1", author: "Anonymous", anonymous: true, body: "Take dated photos at move-in and move-out, and keep the rent receipts and every message about repairs.", votes: 9, replies: [{ id: "k1a", author: "Anonymous", anonymous: true, body: "Also ask in writing for an itemised list of deductions.", votes: 4 }] },
    { id: "k2", author: "Adv. Meera Baruah (demo)", anonymous: false, lawyer: "written", body: "General information only: a written request for an itemised statement creates a useful record before any notice.", votes: 15 },
  ],
  "p0000000-0000-4000-8000-000000000002": [
    { id: "k3", author: "Anonymous", anonymous: true, body: "I called my bank's fraud line first, then reported on the national cyber portal and kept the reference number.", votes: 12 },
    { id: "k4", author: "Community member", anonymous: false, lawyer: "endorsed", body: "Endorsed by a verified lawyer (demo): report promptly and keep screenshots and transaction IDs.", votes: 20 },
  ],
};
