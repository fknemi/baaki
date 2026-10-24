import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1A1D23]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div>
          <div className="text-2xl font-semibold text-[#0F5C4E]">बाकी</div>
          <div className="text-xs tracking-wide text-[#5A6170]">Baaki</div>
        </div>
        <Link href="/login">
          <Button variant="outline">Sign in</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
          Know who to chase today.
        </h1>
        <p className="mt-5 text-lg text-[#5A6170]">
          A receivables command centre for small Indian businesses. See cash risk, send the right
          reminder, and prove every rupee with a tamper-evident trail.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login">
            <Button size="lg" className="bg-[#0F5C4E] text-white hover:bg-[#0F5C4E]/90">
              Try It Now
            </Button>
          </Link>
          <a href="https://github.com/fknemi/baaki" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline">
              Source Code
            </Button>
          </a>
        </div>
        <p className="mt-4 text-xs text-[#5A6170]">
          Prototype · all data synthetic · no signup required
        </p>
      </section>

      {/* 1 — Money Owed, Money Delayed */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Money Owed, Money Delayed</h2>
        <p className="mt-4 text-[#5A6170]">
          You&apos;ve shipped every box. You&apos;ve sent every invoice. And the payment still
          hasn&apos;t come. Some of it is a few days late. Some of it is months late. Meanwhile
          salaries, rent, and GST come due on the same calendar they always have.
          <span className="mt-2 block font-medium text-[#1A1D23]">
            The work is finished. The payment isn&apos;t.
          </span>
        </p>
      </section>

      {/* 2 — How Baaki works */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">How Baaki works</h2>
        <ol className="mt-6 space-y-6">
          {[
            ["See cash risk", "13-week forecast with the breach week shown before it happens."],
            [
              "Chase the right five",
              "Ranked by amount, age, reliability, and cash-gap help. Reason on every row.",
            ],
            [
              "Send one message",
              "WhatsApp, email, or SMS. In the customer's language. Owner's phone in every one.",
            ],
            [
              "Customer disputes or pays",
              "Disputes resolve in the Inbox. Payments require a human tap. Never auto-closes.",
            ],
            [
              "Prove it happened",
              "Every action is one hash-chained event. Tamper-evident. Verifiable from any device.",
            ],
          ].map(([title, body], i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F5C4E] text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[#5A6170]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 3 — Built on things you can check */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Built on things you can check</h2>
        <p className="mt-3 text-[#5A6170]">
          Six mechanisms. Each cites a statute, a specification, or a mathematical property.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "GST math",
              "CGST Act, Section 170",
              "50 paise or more rounds up. Below that is ignored. Only the total rounds.",
            ],
            [
              "MSMED interest",
              "MSMED Act, Section 16",
              "Triple RBI rate, compounded monthly. Applies to micro and small, not medium.",
            ],
            [
              "GSTIN checksum",
              "CBIC mod-36 Luhn",
              "Regex catches typos. Checksum catches invented GSTINs. Both are needed.",
            ],
            [
              "Hash chain audit",
              "SHA-256, Git model",
              "Each event hashes the one before. Change any character and it fails.",
            ],
            [
              "Cash forecast",
              "13 weeks, average days late",
              "Places money when customers actually pay. It does not trust their promises.",
            ],
            [
              "UPI deep link",
              "NPCI Link Spec v1.5.1",
              "One scan prefills amount, payee, and reference. Nothing needs to be typed.",
            ],
          ].map(([title, source, body]) => (
            <div key={title} className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-[#5A6170]">{source}</p>
              <p className="mt-3 text-sm">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 — The invoice that can&apos;t be wrong */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          The invoice that can&apos;t be wrong
        </h2>
        <p className="mt-3 text-[#5A6170]">
          Every line traces to a formula. Every number recomputes by hand.
        </p>
        <div className="mt-6 rounded-xl bg-white p-6 ring-1 ring-[#E4E7EC]">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-sm">INV/26-27/0012</div>
              <div className="mt-1 font-semibold">Krishna Traders</div>
            </div>
            <div className="text-right font-mono text-lg font-semibold">₹1,18,000.00</div>
          </div>
          <div className="mt-4 space-y-1 text-sm tabular-nums">
            <div className="flex justify-between">
              <span>Taxable</span>
              <span>₹1,00,000.00</span>
            </div>
            <div className="flex justify-between text-[#5A6170]">
              <span>CGST 9%</span>
              <span>₹9,000.00</span>
            </div>
            <div className="flex justify-between text-[#5A6170]">
              <span>SGST 9%</span>
              <span>₹9,000.00</span>
            </div>
            <div className="flex justify-between text-[#5A6170]">
              <span>Round off</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between border-t border-[#E4E7EC] pt-2 font-semibold">
              <span>Total</span>
              <span>₹1,18,000.00</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#5A6170]">
            Amount in words: One lakh eighteen thousand rupees only
          </p>
        </div>
      </section>

      {/* 5 — The forecast that doesn&apos;t lie */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          The forecast that doesn&apos;t lie
        </h2>
        <p className="mt-3 text-[#5A6170]">
          Effective due date = due date + how the customer actually pays. Not what they promised.
        </p>
        <div className="mt-6 rounded-xl bg-white p-6 ring-1 ring-[#E4E7EC]">
          <div className="flex h-40 items-end gap-1">
            {[85, 78, 62, 45, 32, 18, 25, 38, 52, 64, 72, 78, 82].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t ${i === 5 ? "bg-[#B42318]" : "bg-[#0F5C4E]/40"}`}
                style={{ height: `${h}%` }}
                title={`Week ${i + 1}: ₹${h}L`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#5A6170]">
            <span>W1</span>
            <span className="font-medium text-[#B42318]">W6 breach</span>
            <span>W13</span>
          </div>
          <p className="mt-4 text-sm">
            Opening ₹8,50,000 · Lowest ₹1,20,000 (week 6) · Buffer ₹3,00,000
          </p>
        </div>
      </section>

      {/* 6 — Ask for what's owed. Nothing more. */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ask for what&apos;s owed. Nothing more.
        </h2>
        <p className="mt-3 text-[#5A6170]">
          When reminders haven&apos;t worked, Baaki generates a demand letter. It lists every
          invoice with its balance, gives a 7-day pay-by date, and shows bank details plus a UPI QR.
          It doesn&apos;t threaten anything it can&apos;t back up.
        </p>
        <div className="mt-6 rounded-xl bg-white p-6 ring-1 ring-[#E4E7EC]">
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs">
            ⚠ A formal request for payment. Not from the GST department. Not legal advice.
          </div>
          <div className="mt-4 space-y-1 text-sm tabular-nums">
            <div className="flex justify-between">
              <span>INV/26-27/0012 · 2026-10-02</span>
              <span>₹98,000</span>
            </div>
            <div className="flex justify-between border-t border-[#E4E7EC] pt-2 font-semibold">
              <span>Balance due</span>
              <span>₹98,000</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#5A6170]">
            Pay by 2026-11-22 · [ ] Include MSMED interest (unchecked by default)
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">See, chase, and prove with Baaki.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login">
            <Button size="lg" className="bg-[#0F5C4E] text-white hover:bg-[#0F5C4E]/90">
              Try It Now
            </Button>
          </Link>
          <a href="https://github.com/fknemi/baaki" target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="outline">
              Source Code
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t border-[#E4E7EC] px-6 py-8 text-center text-xs text-[#5A6170]">
        <p>बाकी · Built by fknemi · Prototype with sample data</p>
        <p className="mt-1">hello@fknemi.dev · baaki.fknemi.dev</p>
      </footer>
    </div>
  );
}
