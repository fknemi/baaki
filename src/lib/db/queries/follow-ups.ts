import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
    invoices,
    customers,
    businesses,
    users,
    reminderLog,
} from "@/lib/db/schema";
import { deriveStageWithLadder, type LadderStage } from "@/lib/domain/ladder";
import { config } from "@/lib/domain/config";
import { wholeDaysBetween } from "@/lib/domain/dates";
import { renderReminder } from "@/lib/templates/reminders";
import { getInvoiceWithTotals } from "./invoices";
import { renderInvoiceAscii } from "@/lib/domain/invoice-ascii";

// ─── Types ──────────────────────────────────────────────────────────────────

type MessagePair = { subject: string; body: string };

// Kept in sync with the `STAGES` const in
// app/.../follow-ups/client.tsx. If you add a stage there, add it here so
// the client can preview every selectable stage before sending.
const CLIENT_STAGES = ["headsUp", "dueDate", "firm", "finalCall"] as const;

export type FollowUpItem = {
    invoiceId: string;
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    customerLanguage: "en" | "hi";
    customerPhone: string | null;
    customerEmail: string | null;
    outstandingPaise: number;
    dueDate: string;
    daysOverdue: number;
    stage: { day: number; key: string } | null;
    message: MessagePair | null;
    // Per-language fallbacks for the derived stage. The client uses
    // `allMessages` first and only falls back here if that's missing.
    messageHi: MessagePair | null;
    messageEn: MessagePair | null;
    // Pre-rendered body for every stage × language the client can select.
    // Missing / null entries are treated as "no reminder available".
    allMessages: Record<
        string,
        { en: MessagePair | null; hi: MessagePair | null }
    >;
    // ASCII-rendered invoice. The client appends this to WhatsApp/SMS
    // bodies only; email still gets it via the template variable.
    asciiInvoice: string;
    sentStageKeys: string[];
    alreadySentChannels: string[];
    snoozedUntil: string | null;
    promiseToPayDate: string | null;
};

export type FollowUpsResult = {
    dueToday: FollowUpItem[];
    snoozed: FollowUpItem[];
    promised: FollowUpItem[];
    sentToday: FollowUpItem[];
};

// ─── Query ──────────────────────────────────────────────────────────────────

export async function getFollowUps(
    businessId: string,
    today: string,
): Promise<FollowUpsResult> {
    const [biz] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);
    if (!biz) throw new Error("Business not found");

    const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, biz.ownerId))
        .limit(1);
    if (!owner) throw new Error("Owner not found");

    const invoiceRows = await db
        .select({ invoice: invoices, customer: customers })
        .from(invoices)
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .where(eq(invoices.businessId, businessId));

    const invoiceIds = invoiceRows.map((r) => r.invoice.id);
    const reminderRows = invoiceIds.length
        ? await db
            .select()
            .from(reminderLog)
            .where(inArray(reminderLog.invoiceId, invoiceIds))
        : [];

    const remindersByInvoice = new Map<string, typeof reminderRows>();
    for (const r of reminderRows) {
        const arr = remindersByInvoice.get(r.invoiceId) ?? [];
        arr.push(r);
        remindersByInvoice.set(r.invoiceId, arr);
    }

    const result: FollowUpsResult = {
        dueToday: [],
        snoozed: [],
        promised: [],
        sentToday: [],
    };

    for (const row of invoiceRows) {
        const inv = row.invoice;
        const cust = row.customer;
        const reminders = remindersByInvoice.get(inv.id) ?? [];
        const sentStageKeys = reminders.map((r) => r.stageKey);

        // Full invoice view (line items, tax breakdown, outstanding).
        const fullInvoice = await getInvoiceWithTotals(inv.id, businessId, today);
        if (!fullInvoice) continue;
        const outstanding = fullInvoice.outstandingPaise;

        if (outstanding <= 0) continue;

        const isResolvedDispute = !inv.disputed;
        const stage = deriveStageWithLadder(
            {
                dueDate: inv.dueDate,
                today,
                paid: outstanding === 0,
                disputed: inv.disputed,
                resolved: isResolvedDispute,
                promiseToPayDate: inv.promiseToPayDate,
                sentStageKeys,
            },
            resolveLadder(biz.ladderOverride),
        );

        const daysOverdue = Math.max(0, wholeDaysBetween(inv.dueDate, today));
        const customerLanguage: "en" | "hi" =
            (cust.preferredLanguage as "en" | "hi") ?? "en";

        // Render the ASCII invoice once. Reused by both the template
        // variables below and the `asciiInvoice` field on the client item.
        const asciiInvoice = renderInvoiceAscii(fullInvoice);

        const templateVars = {
            customerName: cust.name,
            invoiceNumber: inv.number,
            outstandingPaise: outstanding,
            dueDate: inv.dueDate,
            daysOverdue,
            ownerName: owner.name,
            ownerPhone: owner.phoneE164 ?? "",
            asciiInvoice,
        };

        // renderReminder can throw if the stage key isn't present in the
        // configured ladder (e.g. a shortened custom ladder). The client
        // offers all four CLIENT_STAGES regardless, so we must not let one
        // bad stage take down the whole /api/follow-ups response.
        const tryRender = (
            stageKey: string,
            lang: "en" | "hi",
        ): MessagePair | null => {
            try {
                return renderReminder(stageKey, lang, templateVars) ?? null;
            } catch {
                return null;
            }
        };

        // Pre-render every stage × language so the stage dropdown and
        // EN/हिं toggle in the card show the *selected* body, not always
        // the server-derived one.
        const allMessages: FollowUpItem["allMessages"] = {};
        for (const sk of CLIENT_STAGES) {
            allMessages[sk] = {
                en: tryRender(sk, "en"),
                hi: tryRender(sk, "hi"),
            };
        }

        const messageHi = stage ? tryRender(stage.key, "hi") : null;
        const messageEn = stage ? tryRender(stage.key, "en") : null;
        const message = stage ? tryRender(stage.key, customerLanguage) : null;

        const base: FollowUpItem = {
            invoiceId: inv.id,
            invoiceNumber: inv.number,
            customerId: cust.id,
            customerName: cust.name,
            customerLanguage,
            customerPhone: cust.phoneMasked,
            customerEmail: cust.email,
            outstandingPaise: outstanding,
            dueDate: inv.dueDate,
            daysOverdue,
            stage: stage ? { day: stage.day, key: stage.key } : null,
            message,
            messageHi,
            messageEn,
            allMessages,
            asciiInvoice,
            sentStageKeys,
            alreadySentChannels: reminders
                .filter((r) => r.stageKey === stage?.key)
                .map((r) => r.channel),
            snoozedUntil: inv.snoozedUntil ?? null,
            promiseToPayDate: inv.promiseToPayDate ?? null,
        };

        // Categorize:
        // 1. Snoozed (snoozedUntil >= today)
        if (inv.snoozedUntil && inv.snoozedUntil >= today) {
            result.snoozed.push(base);
            continue;
        }
        // 2. Promised (promiseToPayDate >= today)
        if (inv.promiseToPayDate && inv.promiseToPayDate >= today) {
            result.promised.push(base);
            continue;
        }
        // 3. Sent today (a reminder for this stage was sent today)
        const sentTodayRows = reminders.filter(
            (r) =>
                r.sentAt !== null &&
                r.sentAt.toISOString().slice(0, 10) === today,
        );

        if (sentTodayRows.length > 0) {
            const latest = sentTodayRows.sort(
                (a, b) => b.sentAt!.getTime() - a.sentAt!.getTime(),
            )[0]!;
            const sentStageDef = config.ladder.find(
                (s) => s.key === latest.stageKey,
            );
            const sentStage = sentStageDef
                ? { day: sentStageDef.day, key: sentStageDef.key }
                : null;
            // Use the *sent* stage for the primary message + language
            // fallbacks, so the card reflects what was actually delivered
            // (not the currently-derived stage).
            const sentMessage = sentStage
                ? tryRender(sentStage.key, customerLanguage)
                : null;
            result.sentToday.push({
                ...base,
                stage: sentStage,
                message: sentMessage,
                messageHi: sentStage ? tryRender(sentStage.key, "hi") : null,
                messageEn: sentStage ? tryRender(sentStage.key, "en") : null,
            });
            continue;
        }
        // 4. Due today (stage not yet sent for this invoice)
        if (stage) {
            result.dueToday.push(base);
        }
    }

    // Sort dueToday by daysOverdue desc, then outstanding desc
    result.dueToday.sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue)
            return b.daysOverdue - a.daysOverdue;
        return b.outstandingPaise - a.outstandingPaise;
    });

    return result;
}

export function resolveLadder(
    bizLadderOverride: unknown,
): readonly { day: number; key: string }[] {
    if (
        Array.isArray(bizLadderOverride) &&
        bizLadderOverride.length > 0 &&
        bizLadderOverride.every(
            (s) =>
                s &&
                typeof s === "object" &&
                typeof (s as { day?: unknown }).day === "number" &&
                typeof (s as { key?: unknown }).key === "string",
        )
    ) {
        return (bizLadderOverride as { day: number; key: string }[]).sort(
            (a, b) => a.day - b.day,
        );
    }
    return config.ladder;
}
