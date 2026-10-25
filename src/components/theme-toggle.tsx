"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // avoid hydration mismatch — theme is only known on the client
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(t);
    }, []);
    if (!mounted) return <button className="h-9 w-9" aria-hidden />;

    const isDark = resolvedTheme === "dark";
    return (
        <button
            type="button"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md "
        >
            {isDark ? <Sun className="h-4 w-4 opacity-60" /> : <Moon className="h-4 w-4 stroke-white opacity-60" />}
        </button>
    );
}
