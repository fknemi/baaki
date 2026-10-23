import { SessionBridge } from "@/components/auth/session-bridge";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SessionBridge />
      {children}
    </>
  );
}
