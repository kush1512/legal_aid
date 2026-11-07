"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowBigDown, ArrowBigUp, BadgeCheck, EyeOff, Flag, MessageCircle, MessageSquareLock, PenLine, ShieldBan, Eye, EyeOff as Hide, Gavel } from "lucide-react";
import { api, describeError, type CaseCategory, type CommunityPost } from "@/lib/api";
import { CATEGORIES, categoryShort } from "@/lib/constants";
import { isMock } from "@/lib/config";
import { useAsync } from "@/lib/hooks/useAsync";
import { loadCommunity, saveCommunity, type CommunityLocal } from "@/lib/local/community";
import { DEMO_COMMENTS, type DemoComment } from "@/lib/mock/demo-extras";
import { cn, timeAgo, uid } from "@/lib/utils";
import { useApp } from "@/components/AppProvider";
import { MessageDialog } from "@/components/MessageDialog";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingBlock, Notice, PageHeader, PrivacyHint, Switch, Tabs, inputCls } from "@/components/ui";
import { ConsentCheckbox } from "@/components/domain";
import { SEED_POSTS } from "@/lib/mock/data";

type Tab = "latest" | "trending" | "helpful";
const REPORT_REASONS = ["Contains personal information", "Harassment or abuse", "Misleading legal claim", "Spam", "Other"];
const PII = [/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/, /[\w.+-]+@[\w-]+\.[\w.]+/, /\b\d{4}\s?\d{4}\s?\d{4}\b/];

function useLocal() {
  const [s, setS] = useState<CommunityLocal>({ votes: {}, hidden: [], blocked: [], reported: {}, comments: {}, messages: {} });
  useEffect(() => setS(loadCommunity()), []);
  const update = (fn: (c: CommunityLocal) => CommunityLocal) => setS((cur) => { const n = fn(cur); saveCommunity(n); return n; });
  return [s, update] as const;
}

export default function CommunityPage() {
  const { prefs } = useApp();
  const [tab, setTab] = useState<Tab>("latest");
  const [category, setCategory] = useState<CaseCategory | "">("");
  const [composer, setComposer] = useState(false);
  const [mine, setMine] = useState<CommunityPost[]>([]);
  const [local, updateLocal] = useLocal();
  const [dm, setDm] = useState<{ key: string; title: string } | null>(null);
  const res = useAsync(() => api.listPosts({ category: category || undefined, sort: tab === "latest" ? "newest" : "popular", limit: 50 }), [category, tab]);

  const hasLawyerReply = (id: string) => (DEMO_COMMENTS[id] ?? []).some((c) => c.lawyer) || (local.comments[id] ?? []).some((c) => c.lawyer);
  const posts = useMemo(() => {
    const demoPosts = isMock ? [] : SEED_POSTS;
    const base = [...mine.filter((m) => !category || m.category === category), ...demoPosts.filter((m) => !category || m.category === category), ...(res.data?.items ?? [])];
    return tab === "helpful" ? base.filter((p) => hasLawyerReply(p.id)) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data, mine, tab, category, local.comments]);

  return (
    <>
      <PageHeader title="Community" subtitle="Learn from other people’s experiences. Posts are general discussion, not legal advice." actions={<Button icon={PenLine} onClick={() => setComposer((v) => !v)} aria-expanded={composer}>New post</Button>} />
      {!isMock && <DemoCommunityExamples />}
      <Notice tone="privacy" title="Public here, private in your account" className="mb-5">Your account identity is never shown. You choose how each post appears. Anonymous posting hides your display name, but it is a display option, not a guarantee of anonymity, so keep identifying details out.</Notice>

      {composer && <Composer onDone={(p) => { setMine((m) => [p, ...m]); }} onClose={() => setComposer(false)} defaultAnon={prefs.defaultAnonymousPosting} />}

      <div className="mb-4 space-y-3">
        <Tabs<Tab> label="Sort posts" value={tab} onChange={setTab} tabs={[{ id: "latest", label: "Latest" }, { id: "trending", label: "Trending" }, { id: "helpful", label: "Helpful" }]} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {[{ value: "" as const, short: "All" }, ...CATEGORIES].map((c) => (
            <button key={c.value} type="button" aria-pressed={category === c.value} onClick={() => setCategory(c.value)}
              className={cn("rounded-full border px-3 py-1 text-sm font-semibold", category === c.value ? "border-navy bg-navy text-white" : "border-navy/20 bg-white hover:bg-mist/60")}>{c.short}</button>))}
        </div>
        {tab === "helpful" && <p className="text-xs text-navy/70">Posts with a reply written or endorsed by a verified lawyer.</p>}
      </div>

      {res.loading ? <LoadingBlock rows={3} /> : res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : posts.length === 0 ? (
        <EmptyState icon={MessageCircle} title={tab === "helpful" ? "No lawyer-backed posts yet" : "No posts here yet"} action={<Button onClick={() => setComposer(true)}>Start a discussion</Button>}>
          {tab === "helpful" && !isMock ? "Lawyer replies aren’t available from the API yet." : "Be the first to share a general question or experience."}</EmptyState>
      ) : <ul className="space-y-4">{posts.map((p) => <PostCard key={p.id} post={p} local={local} update={updateLocal} onMessage={(key, title) => setDm({ key, title })} defaultAnon={prefs.defaultAnonymousPosting} />)}</ul>}

      <MessageDialog open={dm !== null} onClose={() => setDm(null)} threadKey={dm?.key ?? "x"} title={dm?.title ?? ""} />
    </>
  );
}

function Composer({ onDone, onClose, defaultAnon }: { onDone: (p: CommunityPost) => void; onClose: () => void; defaultAnon: boolean }) {
  const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const [category, setCategory] = useState<CaseCategory>("property_real_estate");
  const [anonymous, setAnonymous] = useState(defaultAnon); const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null); const [done, setDone] = useState(false); const [touched, setTouched] = useState(false);
  const pii = PII.some((r) => r.test(`${title} ${content}`));
  const tErr = touched && (title.trim().length < 5 || title.length > 180) ? "Title must be 5–180 characters." : undefined;
  const cErr = touched && (content.trim().length < 10 || content.length > 6000) ? "Post must be 10–6000 characters." : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setTouched(true);
    if (title.trim().length < 5 || content.trim().length < 10 || !ack) return;
    setBusy(true); setError(null);
    try { const r = await api.createPost({ title: title.trim(), content: content.trim(), category, anonymous }); onDone(r.post); setDone(true); setTitle(""); setContent(""); setAck(false); setTouched(false); }
    catch (err) { setError(err); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate className="mb-6 space-y-4 rounded-xl2 border border-teal/40 bg-white p-5 shadow-card" aria-label="New community post">
      {done && <Notice tone="info" title="Post submitted">New posts may be reviewed before they appear to others.</Notice>}
      {error != null && <Notice tone="danger" title={describeError(error).title}>{describeError(error).hint}</Notice>}
      <Field id="pt" label="Title" error={tErr}><input id="pt" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} /></Field>
      <Field id="pc" label="What would you like to discuss?" error={cErr} hint="Keep it general. Don’t paste case documents."><textarea id="pc" rows={5} className={inputCls} value={content} onChange={(e) => setContent(e.target.value)} maxLength={6000} /></Field>
      <Field id="pcat" label="Category"><select id="pcat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as CaseCategory)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
      <Switch id="panon" checked={anonymous} onChange={setAnonymous} label="Post anonymously" description={anonymous ? "Shown as “Anonymous”. Your account name is never displayed." : "Shown as “Community member”. Your account email and phone are still never displayed."} />
      {pii && <Notice tone="warn" title="This looks like it may contain personal details">Phone numbers, emails or ID numbers would be public. Remove them before posting.</Notice>}
      <ConsentCheckbox id="pack" checked={ack} onChange={setAck}>This post will be <strong>public</strong>. I have removed names, contact details, addresses, ID numbers and private case documents, and I understand this is not legal advice.</ConsentCheckbox>
      {touched && !ack && <p role="alert" className="text-sm font-medium text-danger">Confirm the notice above to post.</p>}
      <div className="flex gap-2"><Button type="submit" loading={busy}>Post publicly</Button><Button type="button" variant="ghost" onClick={onClose}>Close</Button></div>
    </form>
  );
}

function countTree(list: DemoComment[], local: CommunityLocal): number { return list.reduce((n, c) => n + 1 + countTree([...(c.replies ?? []), ...(local.comments[c.id] ?? [])], local), 0); }

function PostCard({ post, local, update, onMessage, defaultAnon }: { post: CommunityPost; local: CommunityLocal; update: (f: (c: CommunityLocal) => CommunityLocal) => void; onMessage: (k: string, t: string) => void; defaultAnon: boolean }) {
  const [open, setOpen] = useState(false);
  const mineVote = local.votes[post.id] ?? 0;
  const top = [...(DEMO_COMMENTS[post.id] ?? []), ...(local.comments[post.id] ?? [])];
  const total = Math.max(post.comment_count, countTree(top, local));
  const vote = (v: 1 | -1) => update((c) => { const votes = { ...c.votes }; if (votes[post.id] === v) delete votes[post.id]; else votes[post.id] = v; return { ...c, votes }; });
  const pending = post.moderation_status === "pending";
  return (
    <li>
      <article className="rounded-xl2 border border-navy/10 bg-white p-4 shadow-card" aria-labelledby={`t-${post.id}`}>
        <div className="flex gap-3">
          <div className="flex flex-col items-center" role="group" aria-label="Vote">
            <button type="button" aria-label="Upvote" aria-pressed={mineVote === 1} onClick={() => vote(1)} className={cn("rounded p-0.5", mineVote === 1 ? "text-teal-700" : "text-navy/50 hover:text-navy")}><ArrowBigUp className={cn("h-6 w-6", mineVote === 1 && "fill-current")} aria-hidden /></button>
            <span className="text-sm font-semibold" aria-label={`${post.vote_count + mineVote} votes`}>{post.vote_count + mineVote}</span>
            <button type="button" aria-label="Downvote" aria-pressed={mineVote === -1} onClick={() => vote(-1)} className={cn("rounded p-0.5", mineVote === -1 ? "text-danger" : "text-navy/50 hover:text-navy")}><ArrowBigDown className={cn("h-6 w-6", mineVote === -1 && "fill-current")} aria-hidden /></button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-navy/70">
              <Badge tone="mist">{categoryShort(post.category)}</Badge>
              <span className="inline-flex items-center gap-1 font-medium">{post.anonymous && <EyeOff className="h-3 w-3" aria-hidden />}{post.display_name}</span><span>· {timeAgo(post.created_at)}</span>
              {pending && <Badge tone="amber">Pending review</Badge>}\n              {post.id.startsWith("p0000000-") && <Badge tone="amber">Demo conversation</Badge>}
              {isMock && DEMO_COMMENTS[post.id]?.some((c) => c.lawyer) && <Badge tone="teal" icon={BadgeCheck}>Lawyer reply</Badge>}
            </div>
            <h3 id={`t-${post.id}`} className="mt-1.5 font-display text-lg font-semibold leading-snug">{post.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" icon={MessageCircle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{total} {total === 1 ? "comment" : "comments"}</Button>
              <ReportButton id={post.id} local={local} update={update} />
            </div>
          </div>
        </div>
        {open && <Thread postId={post.id} comments={top} local={local} update={update} onMessage={onMessage} defaultAnon={defaultAnon} />}
      </article>
    </li>
  );
}

function ReportButton({ id, local, update }: { id: string; local: CommunityLocal; update: (f: (c: CommunityLocal) => CommunityLocal) => void }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(REPORT_REASONS[0]);
  if (local.reported[id]) return <Badge tone="neutral" icon={Flag}>Reported</Badge>;
  return open ? (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); update((c) => ({ ...c, reported: { ...c.reported, [id]: reason } })); setOpen(false); }}>
      <label htmlFor={`r-${id}`} className="sr-only">Reason for reporting</label>
      <select id={`r-${id}`} className={cn(inputCls, "w-auto py-1.5")} value={reason} onChange={(e) => setReason(e.target.value)}>{REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
      <Button type="submit" size="sm" variant="danger">Send report</Button><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    </form>
  ) : <Button variant="ghost" size="sm" icon={Flag} onClick={() => setOpen(true)}>Report</Button>;
}

function Thread({ postId, comments, local, update, onMessage, defaultAnon }: { postId: string; comments: DemoComment[]; local: CommunityLocal; update: (f: (c: CommunityLocal) => CommunityLocal) => void; onMessage: (k: string, t: string) => void; defaultAnon: boolean }) {
  return (
    <div className="mt-4 space-y-3 border-t border-navy/10 pt-4">
      <PrivacyHint>In this prototype, comments, votes, reports, blocks and private messages are saved on this device only. They are not synced across accounts or devices.</PrivacyHint>
      {comments.length === 0 && <p className="text-sm text-navy/70">No comments yet.</p>}
      <ul className="space-y-3">{comments.map((c) => <CommentNode key={c.id} c={c} depth={0} parent={postId} local={local} update={update} onMessage={onMessage} defaultAnon={defaultAnon} />)}</ul>
      <CommentForm parent={postId} update={update} defaultAnon={defaultAnon} label="Add a comment" />
    </div>
  );
}

function CommentForm({ parent, update, defaultAnon, label, onDone }: { parent: string; update: (f: (c: CommunityLocal) => CommunityLocal) => void; defaultAnon: boolean; label: string; onDone?: () => void }) {
  const [text, setText] = useState(""); const [anon, setAnon] = useState(defaultAnon); const id = useMemo(uid, []);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return;
      const c: DemoComment = { id: uid(), author: anon ? "Anonymous" : "Community member", anonymous: anon, body: text.trim(), votes: 0 };
      update((s) => ({ ...s, comments: { ...s.comments, [parent]: [...(s.comments[parent] ?? []), c] } })); setText(""); onDone?.(); }} className="space-y-2">
      <label htmlFor={`cm-${id}`} className="text-sm font-semibold">{label}</label>
      <textarea id={`cm-${id}`} rows={2} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="h-4 w-4 accent-teal-600" />Comment anonymously</label>
        <Button type="submit" size="sm" disabled={!text.trim()}>Post comment</Button>
      </div>
    </form>
  );
}

function CommentNode({ c, depth, parent, local, update, onMessage, defaultAnon }: { c: DemoComment; depth: number; parent: string; local: CommunityLocal; update: (f: (s: CommunityLocal) => CommunityLocal) => void; onMessage: (k: string, t: string) => void; defaultAnon: boolean }) {
  const [reply, setReply] = useState(false);
  const hidden = local.hidden.includes(c.id);
  const blocked = !c.anonymous && local.blocked.includes(c.author);
  const my = local.votes[c.id] ?? 0;
  const kids = [...(c.replies ?? []), ...(local.comments[c.id] ?? [])];
  const toggleHidden = () => update((s) => ({ ...s, hidden: s.hidden.includes(c.id) ? s.hidden.filter((x) => x !== c.id) : [...s.hidden, c.id] }));
  const toggleBlock = () => update((s) => ({ ...s, blocked: s.blocked.includes(c.author) ? s.blocked.filter((x) => x !== c.author) : [...s.blocked, c.author] }));
  if (hidden || blocked) return (
    <li className={cn("rounded-lg bg-ivory-200 px-3 py-2 text-sm text-navy/75", depth > 0 && "ml-5")}>
      {blocked ? `Comment from ${c.author} (blocked). ` : "You hid this comment. "}
      <button type="button" className="font-semibold text-teal-700 underline" onClick={blocked ? toggleBlock : toggleHidden}>{blocked ? "Unblock" : "Show"}</button>
    </li>);
  return (
    <li className={cn(depth > 0 && "ml-5 border-l-2 border-mist pl-3")}>
      <div className="rounded-xl bg-ivory/70 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-navy/70">
          <span className="font-semibold text-navy">{c.author}</span>
          {c.lawyer === "written" && <Badge tone="teal" icon={Gavel}>Lawyer-written</Badge>}
          {c.lawyer === "endorsed" && <Badge tone="teal" icon={BadgeCheck}>Lawyer-endorsed</Badge>}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button type="button" aria-pressed={my === 1} aria-label="Upvote comment" onClick={() => update((s) => { const v = { ...s.votes }; if (v[c.id] === 1) delete v[c.id]; else v[c.id] = 1; return { ...s, votes: v }; })} className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-xs font-semibold", my === 1 ? "text-teal-700" : "text-navy/70 hover:bg-white")}><ArrowBigUp className={cn("h-4 w-4", my === 1 && "fill-current")} aria-hidden />{c.votes + my}</button>
          <Button variant="ghost" size="sm" onClick={() => setReply((r) => !r)} aria-expanded={reply}>Reply</Button>
          <Button variant="ghost" size="sm" icon={Hide} onClick={toggleHidden}>Hide</Button>
          {!c.anonymous && !c.lawyer && <Button variant="ghost" size="sm" icon={ShieldBan} onClick={toggleBlock}>Block</Button>}
          {!c.anonymous && <Button variant="ghost" size="sm" icon={MessageSquareLock} onClick={() => onMessage(`member:${c.author}`, c.author)}>Message privately</Button>}
          <ReportButton id={c.id} local={local} update={update} />
        </div>
      </div>
      {reply && <div className="mt-2 ml-3"><CommentForm parent={c.id} update={update} defaultAnon={defaultAnon} label={`Reply to ${c.author}`} onDone={() => setReply(false)} /></div>}
      {kids.length > 0 && <ul className="mt-2 space-y-2">{kids.map((k) => <CommentNode key={k.id} c={k} depth={depth + 1} parent={c.id} local={local} update={update} onMessage={onMessage} defaultAnon={defaultAnon} />)}</ul>}
    </li>
  );
}
