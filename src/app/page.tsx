"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

// ─── scroll reveal ───────────────────────────────────────────────────────────
// IntersectionObserver-driven fade-up. One-shot: once an element enters,
// it stays visible (no flicker when scrolling back up). Respects
// prefers-reduced-motion — falls back to instantly visible so animation
// is never forced on people who've asked not to see it.

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);
    return reduced;
}

function useInView<T extends HTMLElement>(threshold = 0.12) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry?.isIntersecting) {
                    setInView(true);
                    obs.disconnect();
                }
            },
            { threshold, rootMargin: "0px 0px -10% 0px" },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);

    return { ref, inView };
}

function Reveal({
    children,
    delay = 0,
    className = "",
}: {
    children: ReactNode;
    delay?: number;
    className?: string;
}) {
    const reduced = usePrefersReducedMotion();
    const { ref, inView } = useInView<HTMLDivElement>();
    const show = inView || reduced;

    return (
        <div
            ref={ref}
            className={`transition-[opacity,transform] duration-700 ease-out ${className}`}
            style={{
                opacity: show ? 1 : 0,
                transform: show ? "translateY(0)" : "translateY(20px)",
                transitionDelay: show ? `${delay}ms` : "0ms",
            }}
        >
            {children}
        </div>
    );
}

// ─── shared primitives ───────────────────────────────────────────────────────

const SECTION =
    "px-4 py-16 sm:px-6 sm:py-20 md:px-8 md:py-24 lg:px-12 lg:py-28 xl:px-16 xl:py-32";
const CONTAINER = "mx-auto w-full max-w-6xl";

// Eyebrow — solid white per foreground-white directive. Letter spacing
// carries the small-label feel instead of opacity.
const EYEBROW =
    "font-mono text-[10px] uppercase tracking-[0.2em] text-white " +
    "sm:text-[11px] md:text-xs";

// Section heading — white throughout. Where a sub-phrase needs to read as
// secondary, `font-light` preserves the visual hierarchy without
// introducing opacity (which the foreground-white directive rules out).
const H2 =
    "font-medium tracking-tight text-white leading-[1.08] " +
    "text-2xl sm:text-3xl md:text-4xl lg:text-5xl";

const H2_SUB = "font-light";

const LEAD =
    "text-white leading-relaxed " +
    "text-sm sm:text-base md:text-base lg:text-lg";

// Section label — numbered, minimal, all-white foreground.
function SectionLabel({ n, children }: { n: string; children: ReactNode }) {
    return (
        <Reveal>
            <div className="mb-4 flex items-center gap-3 sm:mb-5">
                <span className="font-mono text-[10px] text-white sm:text-[11px] md:text-xs">
                    {n}
                </span>
                <span className="h-px w-6 bg-white sm:w-8" />
                <span className={EYEBROW}>{children}</span>
            </div>
        </Reveal>
    );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
    return (
        <main className="bg-[#0a0a0a] text-white">
            <Hero />
            <HowItWorks />
            <Pillars />
            <InvoiceShowcase />
            <ForecastShowcase />
            <DemandLetter />
            <FinalCTA />
            <Footer />
        </main>
    );
}

// ─── 1. Hero ─────────────────────────────────────────────────────────────────

function Hero() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className="relative flex min-h-[100svh] w-full flex-col overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <Image
                    src="/bg.png"
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[rgba(17,17,17,0.55)] from-[8%] to-transparent to-[38%]" />
            </div>

            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "linear-gradient(0deg, rgba(0,0,0,0.5), transparent 60%)",
                }}
            />

            <div className="relative z-10 mt-auto p-4 sm:p-6 md:p-8 lg:p-12 xl:p-16">
                <div className="max-w-2xl">
                    <Reveal>
                        <h1 className="font-medium tracking-tight leading-[1.08] text-3xl text-white sm:text-4xl md:text-5xl lg:text-6xl">
                            Money Owed.
                            <br />
                            <span className="font-light">Money Delayed.</span>
                        </h1>
                    </Reveal>

                    <Reveal delay={120}>
                        <p className="mt-5 max-w-xl text-sm leading-relaxed text-white sm:mt-6 sm:text-base md:mt-7 md:text-base lg:mt-8 lg:text-lg">
                            You&apos;ve finished the work. You&apos;ve sent the
                            invoice. The customer said they&apos;d pay. And then
                            weeks pass, and the invoice is still open, and
                            you&apos;re checking the bank balance again.
                            Meanwhile the salaries, the rent, and the GST keep
                            coming due.
                        </p>
                    </Reveal>

                    <Reveal delay={240}>
                        <p className="mt-4 text-sm font-medium text-white sm:mt-5 sm:text-base md:mt-6 md:text-base lg:text-lg">
                            The work is finished. The payment isn&apos;t.
                        </p>
                    </Reveal>
                </div>
            </div>

            <div
                className={`pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-300 sm:bottom-8 ${
                    scrolled ? "opacity-0" : "opacity-100"
                }`}
                aria-hidden="true"
            >
                <div className="flex flex-col items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white sm:text-[10px]">
                        Scroll
                    </span>
                    <span className="block h-8 w-px bg-white sm:h-10" />
                </div>
            </div>

            <div
                className="relative z-10 h-10 w-full flex-shrink-0 sm:h-12 md:h-14 lg:h-16"
                style={{ background: "linear-gradient(transparent, #0a0a0a)" }}
            />
        </header>
    );
}

// ─── 2. How Baaki works ──────────────────────────────────────────────────────

function HowItWorks() {
    return (
        <section id="how" className={SECTION}>
            <div className={CONTAINER}>
                <SectionLabel n="01">How Baaki works</SectionLabel>

                <Reveal>
                    <div className="max-w-2xl">
                        <h2 className={H2}>
                            Five steps between&nbsp;
                            <span className={H2_SUB}>
                                “I&apos;ll pay soon”
                            </span>
                            &nbsp;and getting paid.
                        </h2>
                    </div>
                </Reveal>

                <Reveal delay={80}>
                    <p className={`mt-5 max-w-xl ${LEAD}`}>
                        Every step is grounded in a rule you can cite, a record
                        you can inspect, or a figure you can recompute.
                    </p>
                </Reveal>

                <div className="mt-12 space-y-16 sm:mt-16 sm:space-y-20 md:mt-20 md:space-y-24">
                    <StepCashRisk />
                    <StepChase />
                    <StepMessage />
                    <StepDisputeOrPay />
                    <StepProveIt />
                </div>
            </div>
        </section>
    );
}

function StepHeader({
    n,
    title,
    children,
}: {
    n: string;
    title: string;
    children: ReactNode;
}) {
    return (
        <>
            <Reveal>
                <div className="flex items-baseline gap-3 sm:gap-4">
                    <span className="font-mono text-xs text-white sm:text-sm md:text-base">
                        {n}
                    </span>
                    <h3 className="text-xl font-medium tracking-tight text-white sm:text-2xl md:text-3xl">
                        {title}
                    </h3>
                </div>
            </Reveal>

            <Reveal delay={80}>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white sm:mt-4 sm:text-base md:text-base">
                    {children}
                </p>
            </Reveal>
        </>
    );
}

// ─── 2.1 See Cash Risk ───────────────────────────────────────────────────────

function StepCashRisk() {
    return (
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
                <StepHeader n="01" title="See cash risk">
                    A 13-week forecast that places money when customers actually
                    pay — not when they promised. The first week below your
                    safety buffer is the week that matters.
                </StepHeader>
            </div>

            <Reveal delay={160}>
                <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4 sm:p-5 md:p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                                Cash on hand · 13 weeks
                            </div>
                            <div className="mt-1 text-sm font-medium text-white sm:text-base">
                                ₹1,20,000 closing cash
                            </div>
                        </div>
                        <div className="rounded border border-[#FF9B8F]/40 px-2 py-0.5 text-[10px] font-medium text-white sm:text-xs">
                            Breach · W6
                        </div>
                    </div>

                    <ForecastChart />

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-white sm:text-xs">
                        <div>
                            <div className="font-mono uppercase tracking-wider">
                                Opening
                            </div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums text-white sm:text-base">
                                ₹8,50,000
                            </div>
                        </div>
                        <div>
                            <div className="font-mono uppercase tracking-wider">
                                Lowest
                            </div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums text-white sm:text-base">
                                ₹1,20,000
                            </div>
                        </div>
                        <div>
                            <div className="font-mono uppercase tracking-wider">
                                Buffer
                            </div>
                            <div className="mt-0.5 text-sm font-medium tabular-nums text-white sm:text-base">
                                ₹3,00,000
                            </div>
                        </div>
                    </div>
                </div>
            </Reveal>
        </div>
    );
}

function ForecastChart() {
    const W = 520;
    const H = 220;
    const PAD_L = 36;
    const PAD_R = 16;
    const PAD_T = 16;
    const PAD_B = 20;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;

    const y = (lakhs: number) => PAD_T + chartH - (lakhs / 10) * chartH;
    const x = (i: number) => PAD_L + (i * chartW) / 12;

    const weeks = [8, 7, 5, 4, 3.5, 1.2, 2, 3, 4, 5.5, 7, 8, 9];
    const points = weeks.map((v, i) => `${x(i)},${y(v)}`).join(" ");

    const gridLines = [0, 3, 6, 8, 10];
    const xLabels = [
        { i: 0, label: "W1" },
        { i: 2, label: "W3" },
        { i: 5, label: "W6" },
        { i: 8, label: "W9" },
        { i: 10, label: "W11" },
        { i: 12, label: "W13" },
    ];

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-3 h-auto w-full"
            role="img"
            aria-label="Cash forecast dipping below the safety buffer in week 6"
        >
            <defs>
                <linearGradient id="fc-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#54C48C" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#54C48C" stopOpacity="0" />
                </linearGradient>
            </defs>

            {gridLines.map((v) => (
                <g key={v}>
                    <line
                        x1={PAD_L}
                        x2={W - PAD_R}
                        y1={y(v)}
                        y2={y(v)}
                        stroke="rgba(255,255,255,0.05)"
                        strokeDasharray="3 3"
                    />
                    <text
                        x={PAD_L - 6}
                        y={y(v) + 3}
                        textAnchor="end"
                        fill="white"
                        fontSize="9"
                        fontFamily="ui-monospace, monospace"
                    >
                        ₹{v}L
                    </text>
                </g>
            ))}

            <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(3)}
                y2={y(3)}
                stroke="#FBBF24"
                strokeDasharray="4 4"
                strokeOpacity="0.6"
            />

            <polygon
                points={`${PAD_L},${y(0)} ${points} ${W - PAD_R},${y(0)}`}
                fill="url(#fc-fill)"
            />

            <polyline
                points={points}
                fill="none"
                stroke="#54C48C"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <circle cx={x(5)} cy={y(1.2)} r="3.5" fill="#FF9B8F" />

            {xLabels.map((l) => (
                <text
                    key={l.i}
                    x={x(l.i)}
                    y={H - 6}
                    textAnchor="middle"
                    fill="white"
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                >
                    {l.label}
                </text>
            ))}
        </svg>
    );
}

// ─── 2.2 Chase The Right One ─────────────────────────────────────────────────

function StepChase() {
    return (
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <Reveal className="order-2 lg:order-1">
                <ChaseCard />
            </Reveal>

            <div className="order-1 lg:order-2">
                <StepHeader n="02" title="Chase the right one">
                    Not everyone who owes you money is equally urgent. Baaki
                    ranks every open invoice by how much collecting it now
                    actually protects your cash position.
                </StepHeader>

                <Reveal delay={160}>
                    <div className="mt-6 grid grid-cols-4 gap-2 border-t border-white/10 pt-4 sm:gap-3">
                        {[
                            { label: "Amount", weight: "40%" },
                            { label: "Age", weight: "30%" },
                            { label: "Reliability", weight: "15%" },
                            { label: "Gap", weight: "15%" },
                        ].map((f) => (
                            <div key={f.label}>
                                <div className="font-mono text-[9px] uppercase tracking-wider text-white sm:text-[10px]">
                                    {f.label}
                                </div>
                                <div className="mt-0.5 text-sm font-medium tabular-nums text-white sm:text-base">
                                    {f.weight}
                                </div>
                            </div>
                        ))}
                    </div>
                </Reveal>
            </div>
        </div>
    );
}

function ChaseCard() {
    const customers = [
        {
            rank: 1,
            name: "Krishna Traders",
            amount: "₹1,18,000",
            score: 82,
            reason: "Largest single · 14 days overdue",
            highlight: true,
        },
        {
            rank: 2,
            name: "Patel Brothers",
            amount: "₹86,500",
            score: 71,
            reason: "22 days overdue · reliable payer",
            highlight: false,
        },
        {
            rank: 3,
            name: "Sunrise Agencies",
            amount: "₹54,000",
            score: 62,
            reason: "45 days overdue · new account",
            highlight: false,
        },
    ];

    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                    Chase queue
                </div>
                <div className="text-[10px] text-white sm:text-xs">
                    sorted by score
                </div>
            </div>

            <div className="space-y-2">
                {customers.map((c) => (
                    <div
                        key={c.rank}
                        className={`flex items-start justify-between gap-3 rounded border p-3 transition-colors ${
                            c.highlight
                                ? "border-[#78EDC0]/40 bg-[#78EDC0]/[0.03]"
                                : "border-white/10 bg-transparent hover:bg-white/[0.02]"
                        }`}
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-white">
                                    {String(c.rank).padStart(2, "0")}
                                </span>
                                <span className="truncate text-sm font-medium text-white">
                                    {c.name}
                                </span>
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-white">
                                {c.reason}
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="text-sm font-medium tabular-nums text-white">
                                {c.amount}
                            </div>
                            <div className="font-mono text-[10px] text-white">
                                {c.score}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── 2.3 Send One Message ────────────────────────────────────────────────────

function StepMessage() {
    return (
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
                <StepHeader n="03" title="Send one message">
                    Every channel, one template. The reminder is pre-written in
                    English and Hindi, pre-filled with the invoice details, and
                    ready in three taps.
                </StepHeader>
            </div>

            <Reveal delay={160}>
                <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4 sm:p-5">
                    <div className="flex flex-wrap gap-2">
                        {["Email", "WhatsApp", "SMS"].map((c, i) => (
                            <button
                                key={c}
                                type="button"
                                className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors sm:text-xs ${
                                    i === 1
                                        ? "border-[#78EDC0]/40 bg-[#78EDC0]/10 text-white"
                                        : "border-white/10 text-white hover:bg-white/[0.03]"
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 rounded border border-white/10 bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] text-white">
                                INV/26-27/0012 · Krishna Traders
                            </div>
                            <div className="flex overflow-hidden rounded border border-white/20 text-[10px]">
                                <span className="bg-white px-1.5 py-0.5 font-medium text-black">
                                    EN
                                </span>
                                <span className="px-1.5 py-0.5 text-white">
                                    हिं
                                </span>
                            </div>
                        </div>

                        <p className="mt-3 font-mono text-[11px] leading-relaxed text-white sm:text-xs">
                            नमस्ते कृष्णा जी, INV/26-27/0012 के लिए ₹1,18,000 अब
                            14 दिन बकाया है। भुगतान लिंक: baaki.in/pay/…
                        </p>

                        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-white">
                            <span className="h-1 w-1 rounded-full bg-[#78EDC0]" />
                            Sent 09:42 · logged to chain
                        </div>
                    </div>
                </div>
            </Reveal>
        </div>
    );
}

// ─── 2.4 Customer Disputes or Pays ───────────────────────────────────────────

function StepDisputeOrPay() {
    return (
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <Reveal className="order-2 lg:order-1">
                <div className="space-y-3">
                    <div className="rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.02] p-4">
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
                            <span className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                                Dispute · INV/26-27/0012
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-white">
                            “The quantity on line 2 was short by 500 pieces.”
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {["Accept", "Reject", "Edit"].map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-white/[0.03] sm:text-xs"
                                >
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-[#54C48C]/30 bg-[#54C48C]/[0.02] p-4">
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#54C48C]" />
                            <span className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                                Payment · ₹20,000 received
                            </span>
                        </div>
                        <p className="mt-2 text-sm text-white">
                            Best match: INV/26-27/0012 · 3 of 4 fields align.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {["Confirm", "Ignore", "Change"].map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    className="rounded border border-white/15 px-2.5 py-1 text-[11px] text-white transition-colors hover:bg-white/[0.03] sm:text-xs"
                                >
                                    {a}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Reveal>

            <div className="order-1 lg:order-2">
                <StepHeader n="04" title="Customer disputes or pays">
                    When the customer replies — “I already paid” or “This is
                    wrong” — Baaki routes the message to a decision, not a chat
                    window. You resolve it in one click.
                </StepHeader>
            </div>
        </div>
    );
}

// ─── 2.5 Prove It Happened ───────────────────────────────────────────────────

function StepProveIt() {
    return (
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
                <StepHeader n="05" title="Prove it happened">
                    Every reminder, dispute, and payment is a block in a hash
                    chain. Each event contains the hash of the one before it.
                    Change a single character anywhere and the chain fails —
                    visibly, immediately.
                </StepHeader>
            </div>

            <Reveal delay={160}>
                <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4 sm:p-5">
                    <div className="space-y-2">
                        {[
                            { seq: 1, event: "Invoice created", hash: "a3f8", prev: null },
                            { seq: 2, event: "Reminder sent", hash: "7b2d", prev: "a3f8" },
                            { seq: 3, event: "Payment confirmed", hash: "c9e1", prev: "7b2d" },
                        ].map((b) => (
                            <div
                                key={b.seq}
                                className="flex items-center gap-3 rounded border border-white/10 p-2.5 transition-colors hover:bg-white/[0.02]"
                            >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 font-mono text-[10px] text-white">
                                    {b.seq}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-white sm:text-sm">
                                        {b.event}
                                    </div>
                                    <div className="truncate font-mono text-[10px] text-white">
                                        hash {b.hash}
                                        {b.prev && <> · prev {b.prev}</>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="pl-2 text-[10px] text-white">
                            ⋯ seq 4 → 14 · 11 more events
                        </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded border border-[#54C48C]/40 bg-[#54C48C]/[0.04] p-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#54C48C] text-white">
                            <svg
                                viewBox="0 0 24 24"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </span>
                        <div>
                            <div className="text-xs font-medium text-white sm:text-sm">
                                Chain verified
                            </div>
                            <div className="text-[10px] text-white">
                                14 events · seq 1 → 14
                            </div>
                        </div>
                    </div>
                </div>
            </Reveal>
        </div>
    );
}

// ─── 3. Built on things you can check ────────────────────────────────────────

function Pillars() {
    const pillars = [
        {
            tag: "CGST Act · §170",
            title: "GST math",
            body: "50 paise or more rounds up. Below that is ignored. Only the total rounds.",
        },
        {
            tag: "MSMED Act · §16",
            title: "MSMED interest",
            body: "Triple the RBI rate, compounded monthly. Applies to micro and small enterprises — not medium.",
        },
        {
            tag: "CBIC · mod-36 Luhn",
            title: "GSTIN checksum",
            body: "Regex catches typos. Checksum catches invented GSTINs. Both are needed.",
        },
        {
            tag: "SHA-256 · Git model",
            title: "Hash-chain audit",
            body: "Each event hashes the one before it. Change any character and it fails.",
        },
        {
            tag: "13 weeks · avg days late",
            title: "Cash forecast",
            body: "Places money when customers actually pay. It does not trust their promises.",
        },
        {
            tag: "NPCI Link Spec v1.5.1",
            title: "UPI deep link",
            body: "One scan prefills amount, payee, and reference. Nothing needs to be typed.",
        },
    ];

    return (
        <section className={SECTION}>
            <div className={CONTAINER}>
                <SectionLabel n="02">Built on things you can check</SectionLabel>

                <Reveal>
                    <div className="max-w-2xl">
                        <h2 className={H2}>
                            Every claim has a citation.
                            <br />
                            <span className={H2_SUB}>
                                Every figure has a source.
                            </span>
                        </h2>
                    </div>
                </Reveal>

                <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
                    {pillars.map((p, i) => (
                        <Reveal key={p.title} delay={i * 60}>
                            <div className="group h-full rounded-lg border border-white/10 p-5 transition-colors hover:border-white/30 sm:p-6">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-[11px]">
                                    {p.tag}
                                </div>
                                <div className="mt-3 text-base font-medium text-white sm:text-lg">
                                    {p.title}
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-white">
                                    {p.body}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── 4. The invoice ──────────────────────────────────────────────────────────

function InvoiceShowcase() {
    return (
        <section className={SECTION}>
            <div className={CONTAINER}>
                <SectionLabel n="03">The invoice</SectionLabel>

                <Reveal>
                    <div className="max-w-2xl">
                        <h2 className={H2}>
                            The invoice that&nbsp;
                            <span className={H2_SUB}>can&apos;t be wrong.</span>
                        </h2>
                    </div>
                </Reveal>

                <Reveal delay={80}>
                    <p className={`mt-5 max-w-xl ${LEAD}`}>
                        GST totals are recomputed on every save. The invoice
                        number is unique per business. The PDF, the print, and
                        the preview all read from the same stored record.
                    </p>
                </Reveal>

                <Reveal delay={160} className="mt-10 sm:mt-12">
                    <InvoicePreview />
                </Reveal>
            </div>
        </section>
    );
}

function InvoicePreview() {
    // The invoice and letter previews render a *document* — light paper
    // with dark ink. That's a deliberate inversion vs. the page chrome.
    // All text inside is solid `text-black` (no muted blacks) so the
    // foreground-white directive holds in spirit: no opacity tiers.
    const items = [
        {
            desc: "Corrugated box 12×8",
            hsn: "4819",
            qty: "12,128",
            unit: "pcs",
            rate: "120.00",
            taxable: "60,000.00",
            gst: "10,800.00",
        },
        {
            desc: "Corrugated box 15×10",
            hsn: "4819",
            qty: "15,106",
            unit: "pcs",
            rate: "150.00",
            taxable: "30,000.00",
            gst: "5,400.00",
        },
        {
            desc: "Packing tape 2 rolls",
            hsn: "3919",
            qty: "100",
            unit: "rolls",
            rate: "100.00",
            taxable: "10,000.00",
            gst: "1,800.00",
        },
    ];

    return (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white text-black">
            <div className="grid gap-4 border-b border-black/10 p-5 sm:p-6 md:grid-cols-2 md:p-8">
                <div>
                    <div className="text-lg font-semibold text-black sm:text-xl md:text-2xl">
                        Sharma Packaging
                    </div>
                    <div className="mt-1 text-xs text-black sm:text-sm">
                        Corrugated packaging for Pune&apos;s industries
                    </div>
                    <div className="mt-3 space-y-0.5 text-[11px] text-black sm:text-xs">
                        <div>123 Industrial Area</div>
                        <div>Pune, Maharashtra 411001</div>
                        <div className="font-mono">GSTIN 27AAPFU0939F1ZV</div>
                    </div>
                </div>
                <div className="md:text-right">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-black sm:text-xs">
                        Tax invoice
                    </div>
                    <div className="mt-1 font-mono text-sm text-black sm:text-base">
                        INV/26-27/0012
                    </div>
                    <div className="mt-3 space-y-0.5 text-[11px] text-black sm:text-xs">
                        <div>Issued 2026-10-02</div>
                        <div>Due 2026-11-01</div>
                        <div>Net 30 · INR</div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 border-b border-black/10 p-5 sm:p-6 md:grid-cols-2 md:p-8">
                <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-black sm:text-xs">
                        Bill to
                    </div>
                    <div className="mt-1 text-sm font-medium text-black sm:text-base">
                        Krishna Traders
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-black sm:text-xs">
                        <div>Shop 5, MG Road</div>
                        <div>Pune, Maharashtra 411001</div>
                        <div className="font-mono">GSTIN 27BBBPK1234K1ZU</div>
                    </div>
                </div>
                <div className="space-y-0.5 text-[11px] text-black sm:text-xs md:text-right">
                    <div>
                        <span className="font-medium">Place of supply:</span>{" "}
                        Maharashtra (27)
                    </div>
                    <div>
                        <span className="font-medium">Reverse charge:</span> No
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                    <thead>
                        <tr className="border-b border-black/10 font-mono text-[10px] uppercase tracking-wider text-black">
                            <th className="px-5 py-3 sm:px-6 md:px-8">
                                Description
                            </th>
                            <th className="px-2 py-3">HSN</th>
                            <th className="px-2 py-3 text-right">Qty</th>
                            <th className="px-2 py-3 text-right">Rate</th>
                            <th className="px-2 py-3 text-right">Taxable</th>
                            <th className="px-5 py-3 text-right sm:px-6 md:px-8">
                                GST
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px] text-black sm:text-xs">
                        {items.map((it, i) => (
                            <tr
                                key={i}
                                className="border-b border-black/5 last:border-0"
                            >
                                <td className="px-5 py-3 text-black sm:px-6 md:px-8">
                                    {it.desc}
                                </td>
                                <td className="px-2 py-3 font-mono text-black">
                                    {it.hsn}
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums text-black">
                                    {it.qty} {it.unit}
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums text-black">
                                    ₹{it.rate}
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums text-black">
                                    ₹{it.taxable}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums text-black sm:px-6 md:px-8">
                                    ₹{it.gst}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-black/10 p-5 sm:p-6 md:p-8">
                <div className="ml-auto max-w-sm space-y-1 text-[11px] text-black sm:text-xs">
                    <div className="flex justify-between">
                        <span>Taxable</span>
                        <span className="tabular-nums">₹1,00,000.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span>CGST (9%)</span>
                        <span className="tabular-nums">₹9,000.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span>SGST (9%)</span>
                        <span className="tabular-nums">₹9,000.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Round off</span>
                        <span className="tabular-nums">₹0.00</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-black/20 pt-2 text-sm font-medium text-black sm:text-base">
                        <span>Total</span>
                        <span className="tabular-nums">₹1,18,000.00</span>
                    </div>
                    <div className="pt-1 text-[10px] italic text-black">
                        One lakh eighteen thousand rupees only
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── 5. The forecast ─────────────────────────────────────────────────────────

function ForecastShowcase() {
    return (
        <section className={SECTION}>
            <div className={CONTAINER}>
                <SectionLabel n="04">The forecast</SectionLabel>

                <Reveal>
                    <div className="max-w-2xl">
                        <h2 className={H2}>
                            The forecast that&nbsp;
                            <span className={H2_SUB}>doesn&apos;t lie.</span>
                        </h2>
                    </div>
                </Reveal>

                <Reveal delay={80}>
                    <p className={`mt-5 max-w-xl ${LEAD}`}>
                        Most forecasts assume customers pay on the due date.
                        Yours don&apos;t. Baaki places each receipt on the due
                        date plus how that customer actually pays.
                    </p>
                </Reveal>

                <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-5 lg:gap-8">
                    <Reveal className="lg:col-span-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4 sm:p-5">
                            <div className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                                Weekly closing cash · 13 weeks
                            </div>
                            <ForecastChart />
                        </div>
                    </Reveal>

                    <div className="space-y-4 lg:col-span-2">
                        <Reveal delay={80}>
                            <div className="rounded-lg border border-white/10 p-5 transition-colors hover:border-white/30">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                                    Effective due date
                                </div>
                                <div className="mt-2 text-sm font-medium text-white sm:text-base">
                                    = due date + avg days late
                                </div>
                                <p className="mt-2 text-xs text-white sm:text-sm">
                                    A customer who has averaged 20 days late is
                                    shown 20 days late, not on time.
                                </p>
                            </div>
                        </Reveal>

                        <Reveal delay={160}>
                            <div className="rounded-lg border border-white/10 p-5 transition-colors hover:border-white/30">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-white sm:text-xs">
                                    Breach week
                                </div>
                                <div className="mt-2 text-sm font-medium text-white sm:text-base">
                                    = first week below buffer
                                </div>
                                <p className="mt-2 text-xs text-white sm:text-sm">
                                    This is the number every other decision in
                                    Baaki is tuned to protect.
                                </p>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── 6. The demand letter ────────────────────────────────────────────────────

function DemandLetter() {
    return (
        <section className={SECTION}>
            <div className={CONTAINER}>
                <SectionLabel n="05">The demand letter</SectionLabel>

                <Reveal>
                    <div className="max-w-2xl">
                        <h2 className={H2}>
                            Ask for what&apos;s owed.&nbsp;
                            <span className={H2_SUB}>Nothing more.</span>
                        </h2>
                    </div>
                </Reveal>

                <Reveal delay={80}>
                    <p className={`mt-5 max-w-xl ${LEAD}`}>
                        When the reminders haven&apos;t worked, Baaki generates
                        a formal demand letter. It lists every invoice with its
                        balance, gives a 7-day pay-by date, and shows bank
                        details plus a UPI QR — nothing more.
                    </p>
                </Reveal>

                <div className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-5 lg:gap-8">
                    <Reveal className="lg:col-span-3">
                        <div className="overflow-hidden rounded-lg border border-white/10 bg-white text-black">
                            <div className="p-5 sm:p-6 md:p-8">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="text-base font-semibold text-black sm:text-lg md:text-xl">
                                            Sharma Packaging
                                        </div>
                                        <div className="mt-1 text-xs text-black sm:text-sm">
                                            Corrugated packaging for Pune&apos;s
                                            industries
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-black sm:text-sm">
                                        Letter date: 2026-11-15
                                    </div>
                                </div>

                                <div className="mt-6 text-center text-sm font-semibold tracking-wide text-black sm:text-base md:text-lg">
                                    Payment Demand Letter
                                </div>

                                <div className="mt-5 flex items-start justify-between gap-4 text-xs text-black sm:text-sm">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider text-black">
                                            To
                                        </div>
                                        <div className="mt-1 font-medium text-black">
                                            Krishna Traders
                                        </div>
                                        <div className="text-black">
                                            Shop 5, MG Road
                                        </div>
                                        <div className="text-black">
                                            Pune, Maharashtra 411001
                                        </div>
                                    </div>
                                    <div className="text-right text-black">
                                        <span className="font-medium">
                                            Pay by:
                                        </span>{" "}
                                        <strong>2026-11-22</strong>
                                    </div>
                                </div>

                                <div className="mt-4 text-xs text-black sm:text-sm">
                                    <span className="font-medium">
                                        Subject:
                                    </span>{" "}
                                    Outstanding payment for invoice
                                    INV/26-27/0012
                                </div>

                                <div className="mt-3 overflow-hidden rounded border border-black/10">
                                    <table className="w-full text-left text-[11px] text-black sm:text-xs">
                                        <thead className="bg-black/[0.03] text-black">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    Invoice
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Amount
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Paid
                                                </th>
                                                <th className="px-3 py-2 text-right font-medium">
                                                    Balance
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-t border-black/10">
                                                <td className="px-3 py-2 font-mono">
                                                    INV/26-27/0012
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    ₹1,18,000
                                                </td>
                                                <td className="px-3 py-2 tabular-nums">
                                                    ₹20,000
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums">
                                                    ₹98,000
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded bg-black/[0.03] p-2.5 text-xs text-black sm:text-sm">
                                    <span>Bank: HDFC · XXXX 4821</span>
                                    <span className="font-mono">
                                        sharmapackaging@okhdfcbank
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    <div className="space-y-4 lg:col-span-2">
                        <Reveal delay={80}>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-[#54C48C]/30 p-4">
                                    <div className="font-mono text-[10px] uppercase tracking-wider text-white">
                                        It is
                                    </div>
                                    <p className="mt-2 text-sm text-white">
                                        A formal request for payment.
                                    </p>
                                </div>
                                <div className="rounded-lg border border-[#FF9B8F]/30 p-4">
                                    <div className="font-mono text-[10px] uppercase tracking-wider text-white">
                                        It is not
                                    </div>
                                    <p className="mt-2 text-sm text-white">
                                        Not from the GST department. Not legal
                                        advice.
                                    </p>
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={160}>
                            <div className="rounded-lg border border-white/10 p-5">
                                <div className="font-mono text-[10px] uppercase tracking-wider text-white">
                                    Two things it will never do
                                </div>

                                <div className="mt-4 space-y-4">
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-mono text-[10px] text-white">
                                                01
                                            </span>
                                            <span className="text-sm font-medium text-white">
                                                Apply MSMED interest outside
                                                its scope
                                            </span>
                                        </div>
                                        <p className="mt-1 pl-6 text-xs text-white sm:text-sm">
                                            Section 16 applies to micro and
                                            small enterprises only. Medium gets
                                            the plain RBI rate.
                                        </p>
                                    </div>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-mono text-[10px] text-white">
                                                02
                                            </span>
                                            <span className="text-sm font-medium text-white">
                                                Add interest without approval
                                            </span>
                                        </div>
                                        <p className="mt-1 pl-6 text-xs text-white sm:text-sm">
                                            The checkbox is unchecked by
                                            default. Interest is a separate
                                            line, never bundled.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── 7. Final CTA ────────────────────────────────────────────────────────────

function FinalCTA() {
    return (
        <section className={SECTION}>
            <div className={`${CONTAINER} text-center`}>
                <Reveal>
                    <div className="mx-auto max-w-3xl">
                        <div className={EYEBROW}>Ready when you are</div>
                        <h2 className="mt-4 text-2xl font-medium leading-tight tracking-tight text-white sm:text-3xl md:text-4xl lg:text-5xl">
                            Forecast, chase, and prove
                            <br />
                            <span className={H2_SUB}>with Baaki.</span>
                        </h2>
                    </div>
                </Reveal>

                <Reveal delay={120}>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center rounded-lg bg-[#78EDC0] px-6 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#8bf2cf] h-11 sm:px-7 sm:text-sm md:h-12 md:px-8 md:text-base"
                        >
                            Try it out
                        </Link>
                        <Link
                            href="https://github.com"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border border-white/20 px-6 text-sm font-medium text-white transition-colors duration-200 hover:border-white/40 h-11 sm:px-7 sm:text-sm md:h-12 md:px-8 md:text-base"
                        >
                            Source code
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

// ─── 8. Footer ───────────────────────────────────────────────────────────────

function Footer() {
    return (
        <footer className="border-t border-white/10 px-4 py-8 sm:px-6 sm:py-10 md:px-8 lg:px-12 xl:px-16">
            <div
                className={`${CONTAINER} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
            >
                <div className="flex items-center gap-3">
                    <span className="text-lg font-medium tracking-tight text-white">
                        Baaki
                    </span>
                    <span className="text-xs text-white">·</span>
                    <span className="text-xs text-white sm:text-sm">
                        © 2026 Baaki, Inc.
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-white sm:gap-6 sm:text-sm">
                    <Link
                        href="/privacy"
                        className="underline-offset-4 transition-colors hover:underline"
                    >
                        Privacy
                    </Link>
                    <Link
                        href="/terms"
                        className="underline-offset-4 transition-colors hover:underline"
                    >
                        Terms
                    </Link>
                    <span className="text-white">
                        Built with love by fknemi
                    </span>
                </div>
            </div>
        </footer>
    );
}
