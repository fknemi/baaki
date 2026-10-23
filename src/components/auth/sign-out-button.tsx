"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth } from "@/lib/firebase";
export function SignOutButton() {
    const router = useRouter();
    return (
        <Button
            variant="outline"
            size="sm"
            onClick={async () => {
                await signOut(getFirebaseAuth());
                router.push("/login");
            }}
        >
            Sign out
        </Button>
    );
}
