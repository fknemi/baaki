import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect("/login");

  return (
    <main className="space-y-4 p-8">
      <div className="flex items-center justify-between">
        <p>
          Signed in as <strong>{user.name}</strong> ({user.phoneE164})
        </p>
        <SignOutButton />
      </div>
      <p className="text-sm text-muted-foreground">
        Dashboard coming in Phase 4. Invoices, forecast, and chase will live here.
      </p>
    </main>
  );
}
