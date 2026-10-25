import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import { LocaleProvider, type Locale } from '@/lib/i18n/t';
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, businessMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
export const instant = false;
export const metadata: Metadata = { title: 'Baaki', description: '' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    const c = (await cookies()).get('baaki.locale')?.value;
    const initialLocale: Locale = c === 'hi' ? 'hi' : 'en';

    let businessName: string | undefined;
    let businessCity: string | undefined;

    if (session) {
        const [member] = await db
            .select()
            .from(businessMembers)
            .where(eq(businessMembers.userId, session.userId))
            .limit(1);
        const [biz] = member
            ? await db
                .select({ name: businesses.name, address: businesses.addressJson })
                .from(businesses)
                .where(eq(businesses.id, member.businessId))
                .limit(1)
            : [];
        businessName = biz?.name;
        businessCity = (biz?.address as { city?: string } | null)?.city;
    }

    return (
        <html lang="en" className="antialiased" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Gloria+Hallelujah&family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />




            </head>
            <body className="relative" suppressHydrationWarning>
                <LocaleProvider initialLocale={initialLocale}>
                    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                        <Navbar isAuthed={!!session} business={businessName ? { name: businessName, city: businessCity } : undefined} />
                        {children}
                    </ThemeProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
