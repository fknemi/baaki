export const instant = false;
import { FilterDrawer } from "./filter-drawer"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Input } from "@/components/ui/input"
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listInvoices } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { formatINR } from "@/lib/domain/money";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
const TABS = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "due_soon", label: "Due soon" },
    { key: "overdue", label: "Overdue" },
    { key: "part_paid", label: "Part paid" },
    { key: "paid", label: "Paid" },
    { key: "disputed", label: "Disputed" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isValidTab(s: string | undefined): s is TabKey {
    return s !== undefined && TABS.some((t) => t.key === s);
}

export default async function InvoicesPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>;
}) {
    const session = await getSession();
    if (!session) redirect("/login");

    const params = await searchParams;
    const activeTab: TabKey = isValidTab(params.status) ? params.status : "all";

    const today = todayIST();
    const allInvoices = await listInvoices(
        await currentBusinessId(session.userId),
        today,
    );

    // Per-tab counts (single pass). Partial<…> because unknown statuses
    // (e.g. "cancelled") should not break TS — they just don't count
    // toward any tab.
    const counts: Partial<Record<TabKey, number>> = { all: allInvoices.length };
    for (const inv of allInvoices) {
        const k = inv.status as TabKey;
        if (k !== "all") counts[k] = (counts[k] ?? 0) + 1;
    }

    const visible =
        activeTab === "all"
            ? allInvoices
            : allInvoices.filter((i) => i.status === activeTab);

    const activeLabel =
        activeTab === "all"
            ? ""
            : (TABS.find((t) => t.key === activeTab)?.label.toLowerCase() ?? "") + " ";

    return (
        <main className="pt-14">

            <nav
                aria-label="Filter invoices by status"
                className="-mx-4 overflow-x-auto">

                <ul className="flex gap-2 pb-1 px-4">
                    {TABS.map((t) => {
                        const active = activeTab === t.key;
                        const href =
                            t.key === "all" ? "/invoices" : `/invoices?status=${t.key}`;
                        return (
                            <li key={t.key}>
                                <Link
                                    href={href}
                                    aria-current={active ? "page" : undefined}
                                    className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${active
                                        ? "bg-[#FFFF] text-[#111]"
                                        : "bg-[#171717]/20 text-white  border border-white/10"
                                        }`}
                                >
                                    {t.label} ({counts[t.key] ?? 0})
                                </Link>
                            </li>
                        );
                    })}
                    <li aria-hidden="true" className="w-4 shrink-0" />
                </ul>
            </nav>


            <div className="flex flex-col w-full items-center justify-center pt-6">
                <div>
                    <div className="w-[90vw] flex flex-row gap-4">

                        <InputGroup className="bg-[#171717]/20! border-white/10 w-full ">
                            <InputGroupAddon className="bg-[#171717]/20!">
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M9.89181 4.9459C9.89181 2.21947 7.67233 0 4.9459 0C2.21947 0 0 2.21947 0 4.9459C0 7.67233 2.21947 9.89181 4.9459 9.89181C6.08964 9.89181 7.13447 9.50232 7.97527 8.84699L11.1283 12L12 11.1283L8.84699 7.97527C9.5218 7.10941 9.88937 6.04366 9.89181 4.9459ZM1.23648 4.9459C1.23648 2.89954 2.89954 1.23648 4.9459 1.23648C6.99227 1.23648 8.65533 2.89954 8.65533 4.9459C8.65533 6.99227 6.99227 8.65533 4.9459 8.65533C2.89954 8.65533 1.23648 6.99227 1.23648 4.9459Z"
                                        fill="white"
                                        fillOpacity="0.2"
                                    />
                                </svg>
                            </InputGroupAddon>
                            <InputGroupInput className="placeholder:text-[#737373]" placeholder="Search..." />
                        </InputGroup>

                        <FilterDrawer />









                    </div>

                    <div className="gap-4 flex flex-col pt-6">
                        <div>
                            <p className="relative flex flex-row w-fit items-center justify-center pb-1 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(255,255,255,0.1),rgba(255,255,255,0.2))] after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]">
                                <span className="text-center">November 2026</span>
                            </p>

                        </div>

                        <div className="gap-4 flex flex-col">


                            <div className=" flex  flex-row items-start justify-start border border-[#FFF]/10 p-2 ">
                                <div className="flex flex-col items-start justify-start">

                                    <p className="text-sm italic">
                                        14 days overdue
                                    </p>
                                    <h2 className="text-base">
                                        INV/26-27/0012 · Krishna Traders
                                    </h2>




                                </div>
                                <div className="relative flex flex-row items-start justify-center ">
                                    <h3 className="text-base relative -left-4 bottom-1">
                                        ₹ 1,18,000
                                    </h3>
                                    <span className="absolute -bottom-4 right-1">
                                        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1.19663 10L6 5L1.19663 0L0 1.24343L3.6236 5L0 8.75657L1.19663 10Z" fill="white" fillOpacity="0.5" />
                                        </svg>

                                    </span>


                                </div>


                            </div>



                            <div className=" flex  flex-row items-start justify-start border border-[#FFF]/10 p-2 ">
                                <div className="flex flex-col items-start justify-start">

                                    <p className="text-sm italic">
                                        14 days overdue
                                    </p>
                                    <h2 className="text-base">
                                        INV/26-27/0012 · Krishna Traders
                                    </h2>




                                </div>
                                <div className="relative flex flex-row items-start justify-center ">
                                    <h3 className="text-base relative -left-4 bottom-1">
                                        ₹ 1,18,000
                                    </h3>
                                    <span className="absolute -bottom-4 right-1">
                                        <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1.19663 10L6 5L1.19663 0L0 1.24343L3.6236 5L0 8.75657L1.19663 10Z" fill="white" fillOpacity="0.5" />
                                        </svg>

                                    </span>


                                </div>


                            </div>











                        </div>



















                    </div>




                </div>
            </div>








        </main>
    );
}

async function currentBusinessId(userId: string): Promise<string> {
    const { db } = await import("@/lib/db/client");
    const { businessMembers } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
        .select()
        .from(businessMembers)
        .where(eq(businessMembers.userId, userId))
        .limit(1);
    if (!row) throw new Error("No business membership");
    return row.businessId;
}
