"use client";
import { Badge } from "@/components/ui";

const EXAMPLES = [
  { category: "Property & Real Estate", title: "What should I verify before buying a plot?", question: "I am planning to purchase a residential plot. Apart from the sale deed, what should I verify?", replies: ["Check the title chain, land records, encumbrance information and applicable local approvals.", "Keep copies of the agreement, payment records and written communication. Ask an independent property lawyer to review the documents."] },
  { category: "Digital Fraud & Cybercrime", title: "An unknown UPI transaction appeared in my account", question: "I noticed a transfer I did not make. What information should I preserve?", replies: ["Save the transaction reference, bank messages and screenshots. Contact your bank promptly.", "For suspected financial cyber fraud in India, report promptly through the official 1930 helpline and cybercrime.gov.in."] },
  { category: "Employment & General Rights", title: "What should I keep when salary is delayed?", question: "My employer has delayed salary. What records could help explain the issue?", replies: ["Keep the employment agreement, payslips, attendance records and written requests for payment.", "The correct process depends on the employment arrangement and applicable law; seek qualified advice before formal action."] }
];

export function DemoCommunityExamples() {
  return (
    <section className="mb-6 rounded-xl2 border border-teal/30 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">How community discussions work</h2><Badge tone="amber">Fictional examples</Badge></div>
      <p className="mt-1 text-xs text-navy/70">Sample questions and replies demonstrate the discussion format. They are not real members, verified lawyer responses or legal advice.</p>
      <div className="mt-3 space-y-3">
        {EXAMPLES.map((item) => <article key={item.title} className="rounded-lg bg-ivory/70 p-3">
          <p className="text-xs font-medium text-teal-800">{item.category}</p><h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm">{item.question}</p>
          <div className="mt-2 space-y-2 border-l-2 border-teal/40 pl-3">{item.replies.map((reply) => <p key={reply} className="text-sm text-navy/80">{reply}</p>)}</div>
        </article>)}
      </div>
    </section>
  );
}
