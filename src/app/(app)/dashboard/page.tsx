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
import { Button } from "@/components/ui/button"

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

            <div className="flex items-center justify-center w-full">
                <div className="w-[90vw] flex flex-col gap-4 items-center justify-center">
                    <Card className="w-full relative !gap-0 !py-3 !bg-transparent !border-[#fff]/10 !rounded-none">

                        <span className="absolute top-0 right-0 p-4">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 9.2688V0H0.731205V2.05973H6.48816L0 8.53759L1.46241 10L7.94027 3.51184V9.2688H10Z" fill="#E5E5E5" fillOpacity="0.2" />
                            </svg>
                        </span>


                        <CardHeader className="!gap-4">
                            <CardTitle className="font-heading text-lg !text-[#fff]">Money To Collect</CardTitle>
                            <CardDescription className="font-heading text-3xl !text-[#fff] !leading-tight">
                                ₹ 11, 80, 000.00
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="!bg-transparent !border-none !text-md !italic">
                            from 12 customers · 34 invoices
                        </CardFooter>
                    </Card>





                    <Card className="w-full relative !gap-0 !py-3 !bg-transparent !border-[#fff]/10 !rounded-none">

                        <span className="absolute top-0 right-0 p-4">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 9.2688V0H0.731205V2.05973H6.48816L0 8.53759L1.46241 10L7.94027 3.51184V9.2688H10Z" fill="#E5E5E5" fillOpacity="0.2" />
                            </svg>
                        </span>


                        <CardHeader className="!gap-4">
                            <CardTitle className="font-heading text-lg !text-[#fff]">Overdue</CardTitle>
                            <CardDescription className="font-heading text-3xl !text-[#fff] !leading-tight">
                                ₹ 11, 80, 000.00
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className="!bg-transparent !border-none !text-md !italic">
                            12 invoices · oldest 62 days
                        </CardFooter>
                    </Card>


                    <div className="flex flex-row gap-4 w-full">

                        <Card className="w-full relative !gap-0 !py-3 !bg-transparent !border-[#fff]/10 !rounded-none">

                            <CardHeader className="!gap-4">
                                <CardTitle className="font-heading text-lg !text-[#fff]">expected this week</CardTitle>
                                <CardDescription className="font-heading text-xl !text-[#fff] !leading-tight">
                                    ₹ 1,85,000
                                </CardDescription>
                            </CardHeader>
                        </Card>


                        <Card className="w-full relative !gap-0 !py-3 !bg-transparent !border-[#fff]/10 !rounded-none">

                            <CardHeader className="!gap-4">
                                <CardTitle className="font-heading text-lg !text-[#fff]">expected this month</CardTitle>
                                <CardDescription className="font-heading text-xl !text-[#fff] !leading-tight">
                                    ₹ 1,85,000
                                </CardDescription>
                            </CardHeader>
                        </Card>

                    </div>


                    <div className="flex flex-row gap-4 w-full">
                        <Card className="w-full relative h-fit max-h-120 !gap-6 !py-3 !bg-transparent !border-[#fff]/10 !rounded-none">




                            <CardHeader className="!gap-4">

                                <CardTitle className="font-heading text-lg !text-[#fff]">

                                    <div className="flex flex-row items-end gap-2 justify-center
                                ">
                                        <h2 className="whitespace-nowrap">bills due</h2>


                                        <p className="text-xs whitespace-nowrap">30 days</p>


                                    </div>


                                </CardTitle>

                                <CardDescription className="flex flex-col gap-4 font-heading whitespace-nowrap text-xl !text-[#fff] !leading-tight">
                                    <div className="flex flex-col items-start gap-2 justify-start
                                ">
                                        <h2 className="whitespace-nowrap">cash in bank</h2>


                                        <p className=" text-lg whitespace-nowrap">₹ 8,50,000</p>


                                    </div>


                                    <div className="flex flex-col items-start gap-2 justify-start
                                ">
                                        <h2 className="whitespace-nowrap">lowest point</h2>


                                        <p className="text-lg whitespace-nowrap">₹ 1,20,000</p>


                                    </div>


                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="!bg-transparent !border-none !text-md !italic">

                                <p className="relative flex flex-col items-center justify-center pb-3
              after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px
              after:bg-[linear-gradient(to_right,rgba(129,24,24,0.4),rgba(129,24,24,1))]
              after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]
              after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]
">








                                    <svg width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M5.6049 3.6046V5.60305M5.6049 7.6015H5.60989M10.4662 8.10122L6.46942 1.10665C6.38227 0.952874 6.25589 0.824965 6.10317 0.735975C5.95045 0.646984 5.77686 0.600098 5.60011 0.600098C5.42336 0.600098 5.24977 0.646984 5.09705 0.735975C4.94433 0.824965 4.81795 0.952874 4.7308 1.10665L0.733989 8.10122C0.6459 8.25378 0.59971 8.42692 0.6001 8.60309C0.60049 8.77925 0.647447 8.95219 0.73621 9.10435C0.824974 9.25652 0.952389 9.38252 1.10554 9.46957C1.25869 9.55663 1.43214 9.60164 1.60829 9.60006H9.60192C9.77723 9.59988 9.94941 9.55358 10.1012 9.4658C10.2529 9.37803 10.3789 9.25187 10.4665 9.1C10.5541 8.94813 10.6001 8.77589 10.6001 8.60058C10.6001 8.42526 10.5539 8.25305 10.4662 8.10122Z" strokeWidth="1.2" strokeLinecap="round" stroke="#811818" />
                                    </svg>
                                    <span className="text-center">
                                        cash runs below buffer in week 6
                                    </span>
                                </p>
                            </CardFooter>
                        </Card>




                        <Card className="w-full relative h-fit max-h-120 !gap-6 !py-3 !bg-transparent !border-[#fff]/10 !rounded-none">




                            <CardHeader className="!gap-4">

                                <CardTitle className="font-heading text-lg !text-[#fff]">

                                    <div className="flex flex-row items-end gap-2 justify-center
                                ">
                                        <h2 className="whitespace-nowrap">expenses</h2>


                                    </div>


                                </CardTitle>

                                <CardDescription className="flex flex-col items-center justify-center  gap-4 whitespace-nowrap text-xl !text-[#fff] !leading-tight">
                                    <h2 className="whitespace-nowrap text-sm italic">no expenses set</h2>






                                </CardDescription>
                            </CardHeader>
                        </Card>




















                    </div>
















                </div>
            </div>







        </main>
    );
}
