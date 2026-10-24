"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";
import { AgeingBar, type AgeingBucket } from "@/components/charts/ageing-bar";
import { useRouter } from "next/navigation"; // add
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Chase = {
    invoiceId: string;
    customerName: string;
    amountPaise: number;
    daysOverdue: number;
    score: number;
    reason: string;
};

type DashboardData = {
    totalOutstandingPaise: number;
    overduePaise: number;
    overdueCount: number;
    oldestOverdueDays: number;
    expectedThisWeekPaise: number;
    expectedThisMonthPaise: number;
    billsDue30dPaise: number;
    cashInBankPaise: number;
    lowestPointPaise: number;
    breachWeek: number | null;
    bufferWarning: boolean;
    ageing: AgeingBucket[];
    chase: Chase[];
};

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter(); // add
    useEffect(() => {
        fetch("/api/dashboard")
            .then((r) => {
                if (r.status === 401) {
                    router.push(`/login?next=/dashboard`);
                    return;
                }
                return r.json();
            })
            .then((j) => {
                if (!j) return;
                if (j.error) setError(j.error.message);
                else setData(j.data);
            })
            .catch((e) => setError(e.message));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (error) return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
    if (!data) return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

    return (
        <main className="flex flex-col items-start justify-center pt-14">
            <div className="flex w-full items-center justify-end pr-4">
                <Select defaultValue="Today">
                    <SelectTrigger className="!border-[#ffff]/10 !bg-[#171717]/20">
                        <SelectValue placeholder="Select a Date" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Dates</SelectLabel>
                            <SelectItem value="Today">Today</SelectItem>
                            <SelectItem value="Yesterday">Yesterday</SelectItem>
                            <SelectItem value="22-10-26">22-10-26</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex w-full items-center justify-center mt-4">
                <div className="flex w-[90vw] flex-col items-center justify-center gap-4">
                    <Card className="relative w-full !gap-0 !rounded-none !border-[#fff]/10 !bg-transparent !py-3">
                        <span className="absolute top-0 right-0 p-4">
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M10 9.2688V0H0.731205V2.05973H6.48816L0 8.53759L1.46241 10L7.94027 3.51184V9.2688H10Z"
                                    fill="#E5E5E5"
                                    fillOpacity="0.2"
                                />
                            </svg>
                        </span>

                        <CardHeader className="!gap-4">
                            <CardTitle className="font-heading text-lg !text-[#fff]">Money To Collect</CardTitle>
                            <CardDescription className="font-heading text-3xl !leading-tight !text-[#fff]">
                                ₹ 11, 80, 000.00
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="!text-md !border-none !bg-transparent !italic">
                            from 12 customers · 34 invoices
                        </CardFooter>
                    </Card>

                    <Card className="relative w-full !gap-0 !rounded-none !border-[#fff]/10 !bg-transparent !py-3">
                        <span className="absolute top-0 right-0 p-4">
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M10 9.2688V0H0.731205V2.05973H6.48816L0 8.53759L1.46241 10L7.94027 3.51184V9.2688H10Z"
                                    fill="#E5E5E5"
                                    fillOpacity="0.2"
                                />
                            </svg>
                        </span>

                        <CardHeader className="!gap-4">
                            <CardTitle className="font-heading text-lg !text-[#fff]">Overdue</CardTitle>
                            <CardDescription className="font-heading text-3xl !leading-tight !text-[#fff]">
                                ₹ 11, 80, 000.00
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="!text-md !border-none !bg-transparent !italic">
                            12 invoices · oldest 62 days
                        </CardFooter>
                    </Card>

                    <div className="flex w-full flex-row gap-4">
                        <Card className="relative w-full !gap-0 !rounded-none !border-[#fff]/10 !bg-transparent !py-3">
                            <CardHeader className="!gap-4">
                                <CardTitle className="font-heading text-lg !text-[#fff]">
                                    expected this week
                                </CardTitle>
                                <CardDescription className="font-heading text-xl !leading-tight !text-[#fff]">
                                    ₹ 1,85,000
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card className="relative w-full !gap-0 !rounded-none !border-[#fff]/10 !bg-transparent !py-3">
                            <CardHeader className="!gap-4">
                                <CardTitle className="font-heading text-lg !text-[#fff]">
                                    expected this month
                                </CardTitle>
                                <CardDescription className="font-heading text-xl !leading-tight !text-[#fff]">
                                    ₹ 1,85,000
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>

                    <div className="flex w-full flex-col gap-4">
                        <Card className="relative h-fit max-h-120 w-full !gap-6 !rounded-none !border-[#fff]/10 !bg-transparent !py-3 pr-12">
                            <CardHeader className="!gap-4">
                                <CardTitle className="font-heading text-lg !text-[#fff]">
                                    <div className="relative flex flex-row items-center justify-start gap-2">
                                        <h2 className="whitespace-nowrap text-lg">bills due</h2>
                                    </div>
                                </CardTitle>
                                <p className="absolute top-0 right-4 py-4 flex flex-col items-center justify-center pb-1 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(255,255,255,0.1),rgba(255,255,255,0.2))] after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]">
                                    <span className="text-center">next 30 days</span>
                                </p>

                                <CardDescription className="font-heading flex flex-col gap-4 !leading-tight whitespace-nowrap !text-[#fff]">
                                    <div className="flex flex-row items-start justify-start gap-4">
                                        <h2 className="whitespace-nowrap text-xl">cash in bank</h2>

                                        <p className="text-xl whitespace-nowrap">₹ 8,50,000</p>
                                    </div>

                                    <div className="relative flex flex-row items-start justify-start gap-4">
                                        <h2 className="whitespace-nowrap text-xl">lowest point</h2>

                                        <p className="text-xl whitespace-nowrap">₹ 1,20,000</p>
                                        <p className="absolute -right-12 flex flex-col items-center justify-center pb-1 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(255,255,255,0.1),rgba(255,255,255,0.2))] after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]">
                                            <span className="text-center">week 6</span>
                                        </p>

                                    </div>
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="!text-md !border-none !bg-transparent !italic">
                                <p className="relative flex flex-col items-center justify-center pb-3 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(129,24,24,0.4),rgba(129,24,24,1))] after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]">
                                    <svg
                                        width="12"
                                        height="11"
                                        viewBox="0 0 12 11"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            d="M5.6049 3.6046V5.60305M5.6049 7.6015H5.60989M10.4662 8.10122L6.46942 1.10665C6.38227 0.952874 6.25589 0.824965 6.10317 0.735975C5.95045 0.646984 5.77686 0.600098 5.60011 0.600098C5.42336 0.600098 5.24977 0.646984 5.09705 0.735975C4.94433 0.824965 4.81795 0.952874 4.7308 1.10665L0.733989 8.10122C0.6459 8.25378 0.59971 8.42692 0.6001 8.60309C0.60049 8.77925 0.647447 8.95219 0.73621 9.10435C0.824974 9.25652 0.952389 9.38252 1.10554 9.46957C1.25869 9.55663 1.43214 9.60164 1.60829 9.60006H9.60192C9.77723 9.59988 9.94941 9.55358 10.1012 9.4658C10.2529 9.37803 10.3789 9.25187 10.4665 9.1C10.5541 8.94813 10.6001 8.77589 10.6001 8.60058C10.6001 8.42526 10.5539 8.25305 10.4662 8.10122Z"
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                            stroke="#811818"
                                        />
                                    </svg>
                                    <span className="text-center text-lg w-[80svw]">cash runs below buffer in week 6</span>
                                </p>
                            </CardFooter>
                        </Card>

                        <Card className="relative h-fit max-h-120 w-full !gap-6 !rounded-none !border-[#fff]/10 !bg-transparent !py-3">
                            <CardHeader className="!gap-4">
                                <CardTitle className="font-heading text-lg !text-[#fff]">
                                    <div className="flex flex-row items-end justify-center gap-2">
                                        <h2 className="whitespace-nowrap">expenses</h2>
                                    </div>
                                </CardTitle>

                                <CardDescription className="flex flex-col items-center justify-center gap-4 text-xl !leading-tight whitespace-nowrap !text-[#fff]">
                                    <h2 className="text-sm whitespace-nowrap italic">no expenses set</h2>
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>

                    <AgeingBar buckets={

                        [
                            { key: "not-due", label: "Not due", paise: 42_500_000, count: 14 },
                            { key: "d1-30", label: "1–30", paise: 31_200_000, count: 9 },
                            { key: "d31-60", label: "31–60", paise: 26_800_000, count: 7 },
                            { key: "d61-90", label: "61–90", paise: 17_500_000, count: 3 },
                            { key: "d90+", label: "90+", paise: 4_000_000, count: 1 },
                        ]} />


                    <Card className="relative w-full !gap-0 !rounded-none !bg-transparent !py-3 !ring-0">

                        <CardHeader className="!gap-4">
                            <CardTitle className="font-heading text-lg !text-[#fff]">
                                Chase These First
                            </CardTitle>

                            <CardDescription className="flex flex-col items-center justify-center gap-4 text-xl !leading-tight whitespace-nowrap !text-[#fff]">
                                <div className="w-full flex flex-col gap-4 items-center justify-center">

                                    <div className=" flex  flex-row items-start justify-center border-2 border-[#1C6C18] p-1">
                                        <div className="flex flex-col items-start justify-center">
                                            <h2 className="text-base">
                                                Krishna Traders
                                            </h2>

                                            <p className="text-sm italic">
                                                ₹1.18L, largest single. 14d overdue
                                            </p>


                                        </div>
                                        <div className="relative flex flex-row items-start justify-center ">
                                            <h3 className="text-base relative -left-4">
                                                ₹ 1,18,000
                                            </h3>
                                            <span className="absolute -bottom-4 right-1">
                                                <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M0 6H6V10L12 5L6 0V4H0V6Z" fill="white" fillOpacity="1" />
                                                </svg>
                                            </span>


                                        </div>


                                    </div>


                                    <svg width="100" height="1" viewBox="0 0 100 1" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M0 0.25H100" strokeWidth="0.5" stroke="white" strokeOpacity="0.102" />
                                    </svg>




                                    <div className=" flex  flex-row items-start justify-center border border-[#FFF]/10 p-1">
                                        <div className="flex flex-col items-start justify-center">
                                            <h2 className="text-base">
                                                Krishna Traders
                                            </h2>

                                            <p className="text-sm italic">
                                                ₹1.18L, largest single. 14d overdue
                                            </p>


                                        </div>
                                        <div className="relative flex flex-row items-start justify-center ">
                                            <h3 className="text-base relative -left-4">
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
                            </CardDescription>
                        </CardHeader>
                    </Card>













                </div>
            </div>
        </main>
    );
}
