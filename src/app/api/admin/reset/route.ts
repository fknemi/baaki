import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  return requireRole(
    req as never,
    async () => {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Reset not available in production." } },
          { status: 403 },
        );
      }
      try {
        const { stdout, stderr } = await execAsync("bun scripts/seed.mjs", {
          cwd: process.cwd(),
          env: { ...process.env },
          timeout: 30_000,
        });
        return NextResponse.json({
          data: {
            ok: true,
            output: stdout.slice(-500),
            stderr: stderr.slice(-500),
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Reset failed";
        return NextResponse.json({ error: { code: "INTERNAL", message: msg } }, { status: 500 });
      }
    },
    ["owner", "accountant"],
  );
}
