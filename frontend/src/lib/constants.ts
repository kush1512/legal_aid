import type { CaseCategory, CaseStatus, DocumentType } from "./api/types";

export const CATEGORIES: Array<{
  value: CaseCategory;
  label: string;
  short: string;
  blurb: string;
  icon: "Home" | "Users" | "ShieldAlert" | "Lock";
}> = [
  { value: "property_real_estate", label: "Property & Real Estate", short: "Property", blurb: "Possession, sale deeds, tenancy, deposits, boundaries.", icon: "Home" },
  { value: "marriage_family", label: "Marriage, Divorce & Family", short: "Family", blurb: "Maintenance, custody, domestic disputes, succession.", icon: "Users" },
  { value: "digital_fraud_cybercrime", label: "Digital Fraud & Cybercrime", short: "Cyber fraud", blurb: "UPI and card fraud, phishing, account takeover, scams.", icon: "ShieldAlert" },
  { value: "personal_safety_privacy", label: "Personal Safety & Privacy", short: "Safety & privacy", blurb: "Harassment, stalking, image misuse, data privacy.", icon: "Lock" },
];

export const categoryLabel = (c: CaseCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const categoryShort = (c: CaseCategory) => CATEGORIES.find((x) => x.value === c)?.short ?? c;

export const LANGUAGES: Array<{ code: string; label: string; native: string }> = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "as", label: "Assamese", native: "অসমীয়া" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
];
export const languageLabel = (c: string) => LANGUAGES.find((l) => l.code === c)?.label ?? c;

export const STATUS_META: Record<CaseStatus, { label: string; progress: number; tone: "neutral" | "amber" | "teal" | "navy" }> = {
  intake: { label: "Intake started", progress: 20, tone: "neutral" },
  needs_information: { label: "More information needed", progress: 45, tone: "amber" },
  analysed: { label: "Preliminary assessment ready", progress: 80, tone: "teal" },
  closed: { label: "Closed", progress: 100, tone: "navy" },
};

export const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string; blurb: string }> = [
  { value: "legal_notice", label: "Legal notice", blurb: "A formal written demand sent to the other party." },
  { value: "complaint", label: "Complaint", blurb: "A written complaint for the police or another authority." },
  { value: "reply", label: "Reply", blurb: "A response to a notice or allegation you received." },
  { value: "application", label: "Application", blurb: "A request to an office, court or authority." },
  { value: "incident_summary", label: "Incident summary", blurb: "A dated, factual account of what happened." },
  { value: "evidence_checklist", label: "Evidence checklist", blurb: "What to collect and preserve for your case." },
];

export const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

export const EMERGENCY_NOTE = "If you or someone else is in immediate danger, call 112 (national emergency number) now.";

export const DRAFT_KEY = "la.intake.draft";
export const consentKey = (caseId: string) => `la.consent.${caseId}`;
export const localDocsKey = (caseId: string) => `la.localdocs.${caseId}`;
