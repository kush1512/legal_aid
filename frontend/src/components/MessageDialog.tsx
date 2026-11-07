"use client";
import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { loadCommunity, saveCommunity } from "@/lib/local/community";
import { timeAgo } from "@/lib/utils";
import { Button, Notice, inputCls } from "./ui";

/**
 * Private-message UI. The API contract has no messaging endpoint, so threads
 * live only on this device and the dialog says so.
 */
export function MessageDialog({ open, onClose, threadKey, title }: { open: boolean; onClose: () => void; threadKey: string; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [thread, setThread] = useState<Array<{ from: "me" | "them"; text: string; at: string }>>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); setThread(loadCommunity().messages[threadKey] ?? []); }
    if (!open && d.open) d.close();
  }, [open, threadKey]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const c = loadCommunity();
    const next = [...(c.messages[threadKey] ?? []), { from: "me" as const, text: text.trim(), at: new Date().toISOString() }];
    saveCommunity({ ...c, messages: { ...c.messages, [threadKey]: next } });
    setThread(next); setText("");
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title" className="w-[min(32rem,calc(100vw-2rem))] rounded-xl2 p-0 text-navy backdrop:bg-navy/50">
      <div className="flex items-center justify-between border-b border-navy/10 p-4">
        <h2 id="dlg-title" className="text-lg font-semibold">Private message to {title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-navy/5"><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <div className="space-y-3 p-4">
        <Notice tone="privacy">Preview only: messages are saved on this device and are not delivered yet. Don’t share sensitive details here.</Notice>
        <ul className="max-h-60 space-y-2 overflow-y-auto" aria-live="polite">
          {thread.length === 0 && <li className="text-sm text-navy/70">No messages yet.</li>}
          {thread.map((m, i) => <li key={i} className={m.from === "me" ? "ml-8 rounded-xl bg-navy p-2.5 text-sm text-white" : "mr-8 rounded-xl bg-mist p-2.5 text-sm"}>{m.text}<span className="mt-1 block text-xs opacity-70">{timeAgo(m.at)}</span></li>)}
        </ul>
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="dm-text" className="sr-only">Message</label>
          <textarea id="dm-text" rows={3} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <div className="flex justify-end"><Button type="submit" icon={Send} disabled={!text.trim()}>Save message</Button></div>
        </form>
      </div>
    </dialog>
  );
}
