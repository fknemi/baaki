import { connection } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";

export const instant = false;

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await connection();
    const session = await getSession();
    if (!session) {
        const h = await headers();
        const pathname = h.get("x-pathname") ?? "/dashboard";
        redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
    return <>{children}</>;
}
