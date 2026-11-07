"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, FileText, Home, MessagesSquare, Scale, Search, ShieldPlus, UserRound, FlaskConical, EyeOff, LogIn, type LucideIcon } from "lucide-react";
import { useApp } from "./AppProvider";
import { cn } from "@/lib/utils";

const TABS: Array<{ href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" || p.startsWith("/case") && !p.startsWith("/cases") },
  { href: "/community", label: "Community", icon: MessagesSquare, match: (p) => p.startsWith("/community") },
  { href: "/lawyers", label: "Lawyers", icon: Scale, match: (p) => p.startsWith("/lawyers") },
  { href: "/cases", label: "My Cases", icon: BriefcaseBusiness, match: (p) => p.startsWith("/cases") },
  { href: "/profile", label: "Profile", icon: UserRound, match: (p) => p.startsWith("/profile") },
];
const TOOLS = [
  { href: "/legal", label: "Search the law", icon: Search },
  { href: "/studio", label: "Document studio", icon: FileText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const { mode, session, hasIdentity } = useApp();
  const bare = path.startsWith("/login");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-lg bg-navy px-3 py-2 text-white">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="no-print hidden border-r border-navy/10 bg-white lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen">
        <Link href="/" className="flex items-center gap-2.5 px-6 pb-2 pt-6" aria-label="Legal Aid home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-white"><ShieldPlus className="h-5 w-5" aria-hidden /></span>
          <span><span className="block font-display text-lg font-semibold leading-tight">Legal Aid</span><span className="block text-xs text-navy/70">First Aid for Legal Advice</span></span>
        </Link>
        <nav aria-label="Main" className="mt-6 flex-1 px-3">
          <ul className="space-y-1">
            {TABS.map((t) => {
              const active = t.match(path);
              return (
                <li key={t.href}>
                  <Link href={t.href} aria-current={active ? "page" : undefined}
                    className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold", active ? "bg-navy text-white" : "text-navy hover:bg-mist/70")}>
                    <t.icon className="h-5 w-5" aria-hidden />{t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mb-1 mt-7 px-3 text-xs font-semibold text-navy/60">Tools</p>
          <ul className="space-y-1">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} aria-current={path.startsWith(t.href) ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", path.startsWith(t.href) ? "bg-mist font-semibold" : "text-navy/85 hover:bg-mist/70")}>
                  <t.icon className="h-4 w-4" aria-hidden />{t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4"><IdentityChip /></div>
      </aside>

      <div className="min-w-0">
        {mode === "mock" && (
          <div className="no-print flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700 border-b border-amber-700/20">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Demo mode: synthetic data and sample AI output. Nothing here is verified legal advice.
          </div>
        )}
        {/* Mobile top bar */}
        <header className="no-print flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2" aria-label="Legal Aid home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-white"><ShieldPlus className="h-4 w-4" aria-hidden /></span>
            <span className="font-display text-base font-semibold">Legal Aid</span>
          </Link>
          {!bare && (hasIdentity && (session || mode === "mock")
            ? <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-teal-700"><EyeOff className="h-3 w-3" aria-hidden />Private</span>
            : <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><LogIn className="h-4 w-4" aria-hidden />Sign in</Link>)}
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      {!bare && (
        <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="grid grid-cols-5">
            {TABS.map((t) => {
              const active = t.match(path);
              return (
                <li key={t.href}>
                  <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-teal-700" : "text-navy/70")}>
                    <t.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} aria-hidden />{t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

/** Makes the split between account identity (private) and public identity (anonymous by default) visible. */
function IdentityChip() {
  const { session, mode, prefs } = useApp();
  const signedIn = mode === "mock" || Boolean(session);
  return (
    <div className="rounded-xl bg-mist/70 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-semibold text-teal-700"><EyeOff className="h-3.5 w-3.5" aria-hidden />Your identity stays private</p>
      <dl className="mt-2 space-y-1 text-navy/85">
        <div className="flex justify-between gap-2"><dt>Account</dt><dd className="truncate font-medium">{signedIn ? (mode === "mock" ? "Demo user" : session?.email ?? "Signed in") : "Not signed in"}</dd></div>
        <div className="flex justify-between gap-2"><dt>Public name</dt><dd className="font-medium">{prefs.defaultAnonymousPosting ? "Anonymous" : "Community member"}</dd></div>
      </dl>
      {!signedIn && <Link href="/login" className="mt-2 inline-flex items-center gap-1 font-semibold text-teal-700 underline"><LogIn className="h-3.5 w-3.5" aria-hidden />Sign in</Link>}
    </div>
  );
}
