import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices, customers, businesses, users, reminderLog } from "@/lib/db/schema";
import { deriveStageWithLadder } from "@/lib/domain/ladder";
import { config } from "@/lib/domain/config";
import { wholeDaysBetween } from "@/lib/domain/dates";
import { renderReminder } from "@/lib/templates/reminders";
import { transliterateToHindi } from "@/lib/domain/transliterate";
import { getInvoiceWithTotals } from "./invoices";

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
    message: { subject: string; body: string } | null;
    messageEn: { subject: string; body: string } | null;
    messageHi: { subject: string; body: string } | null;
    // NEW: Pass all possible stage messages so the client can preview them instantly
    allMessages: Record<string, { en: { subject: string; body: string }; hi: { subject: string; body: string } }>;
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

type TemplateVars = Parameters<typeof renderReminder>[2];

function withHindiAlongside(name: string): string {
    if (!name) return name;
    const hindi = transliterateToHindi(name);
    return `${name} (${hindi})`;
}

function renderBothLanguages(
    stageKey: string,
    vars: TemplateVars,
): {
    en: { subject: string; body: string };
    hi: { subject: string; body: string };
} {
    const hiVars: TemplateVars = {
        ...vars,
        customerName: withHindiAlongside(vars.customerName),
        ownerName: withHindiAlongside(vars.ownerName),
    };
    return {
        en: renderReminder(stageKey, "en", vars),
        hi: renderReminder(stageKey, "hi", hiVars),
    };
}

export async function getFollowUps(businessId: string, today: string): Promise<FollowUpsResult> {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (!biz) throw new Error("Business not found");

    const [owner] = await db.select().from(users).where(eq(users.id, biz.ownerId)).limit(1);
    if (!owner) throw new Error("Owner not found");

    const invoiceRows = await db
        .select({ invoice: invoices, customer: customers })
        .from(invoices)
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .where(eq(invoices.businessId, businessId));

    const invoiceIds = invoiceRows.map((r) => r.invoice.id);
    const reminderRows = invoiceIds.length
        ? await db.select().from(reminderLog).where(inArray(reminderLog.invoiceId, invoiceIds))
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
        const totals = await getInvoiceWithTotals(inv.id, businessId, today);
        if (!totals) continue;
        const outstanding = totals.outstandingPaise;

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

        const base: Omit<FollowUpItem, "message" | "messageEn" | "messageHi" | "allMessages"> = {
            invoiceId: inv.id,
            invoiceNumber: inv.number,
            customerId: cust.id,
            customerName: cust.name,
            customerLanguage: (cust.preferredLanguage as "en" | "hi") ?? "en",
            customerPhone: cust.phoneMasked,
            customerEmail: cust.email,
            outstandingPaise: outstanding,
            dueDate: inv.dueDate,
            daysOverdue,
            stage: stage ? { day: stage.day, key: stage.key } : null,
            sentStageKeys,
            alreadySentChannels: reminders.filter((r) => r.stageKey === stage?.key).map((r) => r.channel),
            snoozedUntil: inv.snoozedUntil ?? null,
            promiseToPayDate: inv.promiseToPayDate ?? null,
        };

        const templateVars = {
            customerName: cust.name,
            invoiceNumber: inv.number,
            outstandingPaise: outstanding,
            dueDate: inv.dueDate,
            daysOverdue,
            ownerName: owner.name,
            ownerPhone: owner.phoneE164,
        };

        // Render all possibilities so the client can swap them out live
        const allMessages = {
            headsUp: renderBothLanguages("headsUp", templateVars),
            dueDate: renderBothLanguages("dueDate", templateVars),
            firm: renderBothLanguages("firm", templateVars),
            finalCall: renderBothLanguages("finalCall", templateVars),
        };

        const both = stage ? allMessages[stage.key as keyof typeof allMessages] : null;
        const message = both ? (base.customerLanguage === "hi" ? both.hi : both.en) : null;

        const item: FollowUpItem = {
            ...base,
            message,
            messageEn: both?.en ?? null,
            messageHi: both?.hi ?? null,
            allMessages,
        };

        // Categorize:
        if (inv.snoozedUntil && inv.snoozedUntil >= today) {
            result.snoozed.push(item);
            continue;
        }
        if (inv.promiseToPayDate && inv.promiseToPayDate >= today) {
            result.promised.push(item);
            continue;
        }
        
        const sentTodayRows = reminders.filter(
            (r) => r.sentAt !== null && r.sentAt.toISOString().slice(0, 10) === today,
        );

        if (sentTodayRows.length > 0) {
            const latest = sentTodayRows.sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime())[0]!;
            const sentStageDef = config.ladder.find((s) => s.key === latest.stageKey);
            const sentStage = sentStageDef ? { day: sentStageDef.day, key: sentStageDef.key } : null;
            const sentBoth = sentStageDef ? allMessages[sentStageDef.key as keyof typeof allMessages] : null;
            const sentMessage = sentBoth
                ? base.customerLanguage === "hi"
                    ? sentBoth.hi
                    : sentBoth.en
                : null;
            
            result.sentToday.push({
                ...base,
                stage: sentStage,
                message: sentMessage,
                messageEn: sentBoth?.en ?? null,
                messageHi: sentBoth?.hi ?? null,
                allMessages,
            });
            continue;
        }
        
        if (stage) {
            result.dueToday.push(item);
        }
    }

    result.dueToday.sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return b.outstandingPaise - a.outstandingPaise;
    });

    return result;
}

export function resolveLadder(bizLadderOverride: unknown): readonly { day: number; key: string }[] {
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
        return (bizLadderOverride as { day: number; key: string }[]).sort((a, b) => a.day - b.day);
    }
    return config.ladder;
}
