"use client";

import type { CaseCategory } from "@/lib/api";

export type SampleTurn = { role: "user" | "assistant"; content: string };
export type SampleCase = {
  id: string;
  category: CaseCategory;
  title: string;
  summary: string;
  turns: SampleTurn[];
};

export const SAMPLE_CASE_CONVERSATIONS: SampleCase[] = [
  {
    id: "C01", category: "property_real_estate", title: "Landlord has not returned the security deposit",
    summary: "A tenant has moved out and is unsure why the deposit is being withheld.",
    turns: [
      { role: "user", content: "I left my rented flat last month but my landlord is not returning my 18,000 rupees deposit." },
      { role: "assistant", content: "When did you hand over the keys, and did the landlord inspect the flat at that time?" },
      { role: "user", content: "I gave the keys on 30 September. He checked the flat and said everything looked okay." },
      { role: "assistant", content: "Did you both discuss when the deposit would be returned, either in the agreement or over messages?" },
      { role: "user", content: "Agreement says within 15 days. I messaged him after that but he just says he will check." },
      { role: "assistant", content: "Have you received any written list of deductions or an explanation for keeping the money?" },
      { role: "user", content: "No list. Yesterday he said painting charges will be deducted but did not tell me the amount." },
      { role: "assistant", content: "Have you got the rent agreement, proof of the deposit payment and the messages about the handover and deductions? You can describe what you have; you do not need to upload anything here." }
    ]
  },
  {
    id: "C02", category: "property_real_estate", title: "Builder keeps postponing possession",
    summary: "A homebuyer has paid instalments but the possession date keeps changing.",
    turns: [
      { role: "user", content: "I booked a flat and the builder has still not given possession. They keep giving a new date." },
      { role: "assistant", content: "Which city is the property in, and what possession date was first promised in your documents?" },
      { role: "user", content: "It is in Guwahati. The allotment letter said June 2026." },
      { role: "assistant", content: "Have you paid the full amount or are instalments still pending?" },
      { role: "user", content: "Around 12.5 lakh paid so far. There are two instalments left, which I have not paid." },
      { role: "assistant", content: "What explanation has the builder given for the delay, and was it sent in writing?" },
      { role: "user", content: "They said approvals are pending in a WhatsApp group. Last week they told us possession may happen in December." },
      { role: "assistant", content: "Do you have the allotment letter, payment receipts and the messages mentioning the revised possession dates?" }
    ]
  },
  {
    id: "C03", category: "property_real_estate", title: "Landlord asks tenant to vacate before the agreement ends",
    summary: "A tenant receives a request to leave early and wants to understand the agreement and communications.",
    turns: [
      { role: "user", content: "My landlord is asking me to leave the flat even though my rental agreement has not ended." },
      { role: "assistant", content: "When does your current agreement end, and how long have you been staying there?" },
      { role: "user", content: "It ends in March next year. I moved in around eight months ago." },
      { role: "assistant", content: "Did the landlord give a reason for asking you to leave early?" },
      { role: "user", content: "He says his relatives are coming and he needs the flat. He told me on a phone call." },
      { role: "assistant", content: "Does your written agreement mention early termination or a notice period?" },
      { role: "user", content: "There is a two-month notice clause, but I have not received any written notice." },
      { role: "assistant", content: "Have you replied to the landlord in writing, and do you have a copy of the signed agreement and rent-payment records?" }
    ]
  },
  {
    id: "C04", category: "property_real_estate", title: "Online seller is refusing a refund",
    summary: "A customer received a defective product and the seller is not resolving the complaint.",
    turns: [
      { role: "user", content: "I ordered a mixer online for 4,999 rupees. It arrived damaged and the seller is not refunding me." },
      { role: "assistant", content: "When was it delivered, and did you report the damage through the shopping platform?" },
      { role: "user", content: "It came on 14 September. I raised a return request the same evening." },
      { role: "assistant", content: "What response did the platform give for rejecting or delaying the return?" },
      { role: "user", content: "They said the return window is over, but I reported it on the delivery day." },
      { role: "assistant", content: "Have you contacted the seller separately, or only the platform's customer support?" },
      { role: "user", content: "Only support. I have the chat transcript and photos from when I opened the box." },
      { role: "assistant", content: "Is the order still visible in your account, and do you have the invoice and return-request reference number?" }
    ]
  },
  {
    id: "C05", category: "digital_fraud_cybercrime", title: "Money debited after a UPI scam",
    summary: "A person reports an unauthorised transfer and is gathering bank complaint details.",
    turns: [
      { role: "user", content: "Someone called saying they were from my bank. After I shared an OTP, 25,000 rupees got debited." },
      { role: "assistant", content: "If this just happened, contact your bank immediately and report the suspected online financial fraud on 1930. When did the debit occur?" },
      { role: "user", content: "It happened around 20 minutes ago." },
      { role: "assistant", content: "Have you called your bank's official number to block or secure the affected account and payment method?" },
      { role: "user", content: "Yes, I called the number on my card. They blocked UPI and gave me a complaint number." },
      { role: "assistant", content: "Have you also called 1930 or submitted a complaint at the National Cyber Crime Reporting Portal?" },
      { role: "user", content: "I called 1930 and got an acknowledgement SMS. I have not filled the online form yet." },
      { role: "assistant", content: "Keep the bank complaint number, transaction reference, SMS and statement. Do not share another OTP or caller's link. Have you noted the transaction ID and exact debit time?" }
    ]
  },
  {
    id: "C06", category: "digital_fraud_cybercrime", title: "Someone is impersonating me on social media",
    summary: "A user finds a fake profile using their photos and contacting friends.",
    turns: [
      { role: "user", content: "There is an Instagram account using my photos and messaging my friends for money." },
      { role: "assistant", content: "Have any friends sent money, or has the account only asked them so far?" },
      { role: "user", content: "One friend almost paid but called me first. Nobody has sent money." },
      { role: "assistant", content: "Do you have screenshots showing the profile, messages and the account handle?" },
      { role: "user", content: "Yes, I took screenshots yesterday. The account has my name and old profile pictures." },
      { role: "assistant", content: "Have you reported the impersonating account through the platform's reporting option?" },
      { role: "user", content: "I reported it but it is still active. I also warned my friends in our group." },
      { role: "assistant", content: "Is the account contacting people outside your friend group, and has anyone received threats or requests for sensitive information?" }
    ]
  },
  {
    id: "C07", category: "marriage_family", title: "Siblings disagree about inherited land",
    summary: "Family members disagree about a parent's land and the effect of a will.",
    turns: [
      { role: "user", content: "My father passed away and now my brother says the land belongs only to him. We are three siblings." },
      { role: "assistant", content: "I am sorry for your loss. In which state is the land, and did your father leave a will?" },
      { role: "user", content: "The land is in Assam. There is a will but my brother has the original." },
      { role: "assistant", content: "Do you know approximately when the will was made, and whether it names all three siblings?" },
      { role: "user", content: "It was made in 2024. I saw a photocopy earlier and all our names were mentioned, but I do not remember the exact wording." },
      { role: "assistant", content: "Has anyone started a mutation or transfer process in the land records?" },
      { role: "user", content: "My brother says he has applied. I have not seen any notice or application." },
      { role: "assistant", content: "Do you have the photocopy of the will, land records or any communication about the mutation application? Please avoid sharing private family identifiers here." }
    ]
  },
  {
    id: "C08", category: "personal_safety_privacy", title: "Repeated harassment and unwanted visits",
    summary: "A person is documenting unwanted contact and considering safe reporting options.",
    turns: [
      { role: "user", content: "A person I know keeps messaging me and coming near my home even after I told them to stop." },
      { role: "assistant", content: "Are you in immediate danger right now, or is the person currently nearby?" },
      { role: "user", content: "Not right now. They came yesterday evening and waited outside for some time." },
      { role: "assistant", content: "Have there been earlier visits or threats, and roughly when did they happen?" },
      { role: "user", content: "This has happened three times in the last month. The messages started before that." },
      { role: "assistant", content: "Do you feel safe at home, and is there someone you trust who knows what has been happening?" },
      { role: "user", content: "I am staying with my cousin for now. I have screenshots but I am scared they will find out." },
      { role: "assistant", content: "Prioritise your immediate safety and do not confront the person. If danger becomes immediate, call 112. Would you like to describe whether any direct threats were made, without sharing names or addresses?" }
    ]
  }
];
