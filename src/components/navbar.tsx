"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./langugage-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

// ── Config ──────────────────────────────────────────────────────
// HIDE_NAVBAR_ON — entire <nav> is not rendered. Use for pages where
// app chrome would be wrong: print/PDF renderers, customer-facing pay
// page, auth callbacks, and login/signup screens.
const HIDE_NAVBAR_ON = [
    "/print",              // print/PDF renderers — no chrome
    "/pay",                // customer-facing pay page
    "/auth",               // magic-link / OAuth callbacks
    "/login",              // auth screens have their own layout
    "/signup",
    "/forgot-password",
];

const HIDE_BUSINESS_ON = ["/"];                             // business name
const HIDE_LOGO_ON = [
    "/dashboard",
    "/customers",
    "/invoices",
    "/invoice",
    "/forecast",
    "/payments",
    "/help",
    "/settings",
    "/documents",
    "/inbox",
    "/chase",
    "/follow-ups",
];
const HIDE_LANG_ON = [
    "/dashboard",
    "/customers",
    "/invoices",
    "/invoice",
    "/forecast",
    "/payments",
    "/help",
    "/settings",
    "/documents",
    "/inbox",
    "/chase",
    "/follow-ups",
];

/**
 * Matches a pathname against a list of prefixes.
 * Patterns must not end with a trailing slash — `"/pay"` matches
 * `/pay` and `/pay/abc`, but `"/pay/"` would only match exactly
 * `/pay/` (double-slash from concatenation) and silently fail on
 * every real pay URL.
 */
function matchesAnyPath(pathname: string, patterns: string[]): boolean {
    return patterns.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const MENU_LINKS_PUBLIC = [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/#howbaakiworks" },
    { label: "Sign Up", href: "/signup" },
    { label: "Login", href: "/login" },
];

const MENU_LINKS_AUTHED = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Customers", href: "/customers" },
    { label: "Invoices", href: "/invoices" },
    { label: "Forecast", href: "/forecast" },
    { label: "Settings", href: "/settings" },
];

interface NavbarProps {
    isAuthed: boolean;
    business?: { name: string; city?: string };
}

export default function Navbar({ isAuthed, business }: NavbarProps) {
    const pathname = usePathname();

    const showNavbar = !matchesAnyPath(pathname, HIDE_NAVBAR_ON);
    const showBusiness =
        business && !matchesAnyPath(pathname, HIDE_BUSINESS_ON);
    const showLogo = !matchesAnyPath(pathname, HIDE_LOGO_ON);
    const showLanguageToggle = !matchesAnyPath(pathname, HIDE_LANG_ON);

    const links = isAuthed ? MENU_LINKS_AUTHED : MENU_LINKS_PUBLIC;

    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // ── Open / close animation ────────────────────────────────────
    useEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        if (!open && menu.style.display === "none") return;

        const backdrop = menu.querySelectorAll<HTMLElement>(".backdrop-layer");
        const linkEls = menu.querySelectorAll<HTMLElement>(".nav-link-item");

        const ctx = gsap.context(() => {
            if (open) {
                gsap.set(menu, { display: "block" });
                gsap
                    .timeline()
                    .fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
                    .fromTo(
                        backdrop,
                        { xPercent: 101 },
                        { xPercent: 0, stagger: 0.1, duration: 0.5, ease: "power3.out" },
                        "<",
                    )
                    .fromTo(
                        linkEls,
                        { yPercent: 140, rotate: 10, opacity: 0 },
                        {
                            yPercent: 0,
                            rotate: 0,
                            opacity: 1,
                            stagger: 0.06,
                            duration: 0.5,
                            ease: "power3.out",
                        },
                        "<+=0.2",
                    );
            } else {
                const tl = gsap.timeline({
                    onComplete: () => gsap.set(menu, { display: "none" }),
                });
                tl.to(linkEls, {
                    yPercent: -140,
                    rotate: -10,
                    opacity: 0,
                    stagger: 0.03,
                    duration: 0.3,
                    ease: "power2.in",
                })
                    .to(
                        backdrop,
                        { xPercent: -101, stagger: 0.05, duration: 0.4, ease: "power2.in" },
                        "<+=0.1",
                    )
                    .to(menu, { autoAlpha: 0, duration: 0.2 }, "<+=0.2");
            }
        }, menu);

        return () => ctx.revert();
    }, [open]);

    // ── Esc to close ──────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // ── Close on route change ─────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setOpen(false), 0);
        return () => clearTimeout(t);
    }, [pathname]);
    // ── Lock body scroll while open ───────────────────────────────
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    // Bail out AFTER all hooks — the Rules of Hooks require every hook
    // to run on every render, even when we're going to render nothing.
    if (!showNavbar) return null;

    return (
        <nav className="absolute top-0 right-0 left-0 z-50">
            {/* ─────────── TOP BAR ─────────── */}
            <div className="relative z-[60] flex flex-row items-center justify-between px-2 pt-2">
                {showBusiness && (
                    <span>
                        {business!.name}
                        {business!.city && ` · ${business!.city}`}
                    </span>
                )}

                {showLogo && (
                    <h2 className="font-logo flex items-center justify-center gap-2 text-2xl">
                        <span>
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 13 13"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M8.4053 7.24561H8.28241C8.09868 7.24561 7.94931 7.09609 7.94931 6.91251C7.94931 6.72894 8.09868 6.57942 8.28241 6.57942H8.4601C8.55312 6.57942 8.64212 6.61904 8.70419 6.68823C8.81842 6.81546 9.01422 6.82584 9.1413 6.71145C9.26854 6.59722 9.27891 6.40142 9.16452 6.27434C8.98513 6.07467 8.72834 5.96028 8.45994 5.96028H8.28225C7.75722 5.96028 7.33002 6.38749 7.33002 6.91251C7.33002 7.4377 7.75722 7.86475 8.28225 7.86475H8.40515C8.58888 7.86475 8.73824 8.01411 8.73824 8.19769C8.73824 8.38126 8.58888 8.53078 8.40515 8.53078H8.22761C8.13459 8.53078 8.04574 8.49116 7.98352 8.42197C7.86913 8.29474 7.67333 8.28437 7.54641 8.39875C7.41917 8.51298 7.4088 8.70879 7.52319 8.83586C7.70258 9.03554 7.95937 9.14992 8.22777 9.14992H8.40546C8.93049 9.14992 9.35769 8.72272 9.35769 8.19769C9.35754 7.67281 8.93033 7.24561 8.4053 7.24561Z"
                                    fill="white"
                                />
                                <path
                                    d="M7.27582 8.46546V7.68117C7.27582 7.20335 7.04782 6.77878 6.69584 6.50729C6.9695 6.29616 7.16824 5.99263 7.24285 5.64297H7.79326C7.96414 5.64297 8.10283 5.50428 8.10283 5.3334C8.10283 5.16252 7.96414 5.02383 7.79326 5.02383H7.24285C7.09998 4.35408 6.50422 3.84995 5.79237 3.84995H4.76692C4.59604 3.84995 4.45735 3.98864 4.45735 4.15952V5.02383H3.94006C3.76918 5.02383 3.63049 5.16252 3.63049 5.3334C3.63049 5.50428 3.76918 5.64297 3.94006 5.64297H4.45735V8.84051C4.45735 9.01139 4.59604 9.15007 4.76692 9.15007C4.9378 9.15007 5.07649 9.01139 5.07649 8.84051V6.81685H5.79237C6.26895 6.81685 6.65668 7.20459 6.65668 7.68117V8.46546C6.65668 8.67334 6.72928 8.87626 6.86131 9.03693C6.97027 9.16958 7.16561 9.18753 7.29687 9.07965C7.42906 8.97114 7.44825 8.77596 7.33959 8.64393C7.29857 8.59378 7.27582 8.53047 7.27582 8.46546ZM5.07649 4.46909H5.79237C6.15982 4.46909 6.47357 4.69987 6.59833 5.02383H5.07649V4.46909ZM5.07649 6.19772V5.64297H6.59833C6.47342 5.96693 6.15967 6.19772 5.79237 6.19772H5.07649Z"
                                    fill="white"
                                />
                                <path
                                    d="M1.89815 11.098C3.72259 12.9225 6.45856 13.4828 8.83651 12.568C8.9961 12.5067 9.0755 12.3275 9.01405 12.1679C8.9526 12.0083 8.77352 11.9288 8.61393 11.9904C6.4437 12.8257 3.97938 12.3038 2.33573 10.6603C0.240412 8.56483 0.0621 5.24904 1.80791 2.9488V3.68402C1.80791 3.8549 1.9466 3.99359 2.11748 3.99359C2.28836 3.99359 2.42705 3.8549 2.42705 3.68402V2.12364C2.42705 1.95276 2.28836 1.81407 2.11748 1.81407H0.557255C0.386373 1.81407 0.247686 1.95276 0.247686 2.12364C0.247686 2.29452 0.386373 2.43321 0.557255 2.43321H1.42312C-0.62313 4.97972 -0.460916 8.73912 1.89815 11.098Z"
                                    fill="white"
                                />
                                <path
                                    d="M4.15364 0.434169C3.99406 0.495464 3.91466 0.674704 3.97611 0.834286C4.0374 0.993869 4.21664 1.07312 4.37622 1.01182C6.54646 0.176453 9.01093 0.698386 10.6544 2.34189C12.7466 4.43411 12.927 7.75516 11.1822 10.0539V9.31817C11.1822 9.14729 11.0436 9.0086 10.8727 9.0086C10.7018 9.0086 10.5631 9.14729 10.5631 9.31817V10.8786C10.5631 11.0494 10.7018 11.1881 10.8727 11.1881H12.4331C12.6039 11.1881 12.7426 11.0494 12.7426 10.8786C12.7426 10.7077 12.6039 10.569 12.4331 10.569H11.5666C13.6116 8.02448 13.4477 4.25935 11.0923 1.90416C9.27577 0.0877617 6.55234 -0.489274 4.15364 0.434169Z"
                                    fill="white"
                                />
                            </svg>
                        </span>

                        <p>Baaki</p>
                    </h2>
                )}


                {showLanguageToggle && <LanguageToggle />}

                <div className="flex flex-row items-center justify-center gap-4">

                    {!isAuthed && (
                        <Button className="flex items-center justify-center rounded-sm bg-[#78EDC0] p-2 text-[#192221]">
                            Try it out
                        </Button>
                    )}

                    {showBusiness && <ThemeToggle />}


                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        aria-controls="fullscreen-menu"
                        className="relative z-[70] h-3 w-5"
                    >
                        <span
                            className={`absolute left-0 h-[2px] w-5 rounded bg-white transition-all duration-300 ease-in-out ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
                                }`}
                        />
                        <span
                            className={`absolute top-1/2 left-0 h-[2px] w-5 -translate-y-1/2 rounded bg-white transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"
                                }`}
                        />
                        <span
                            className={`absolute left-0 h-[2px] w-5 rounded bg-white transition-all duration-300 ease-in-out ${open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* ─────────── FULLSCREEN GSAP MENU ─────────── */}
            <div
                ref={menuRef}
                id="fullscreen-menu"
                style={{ display: "none" }}
                className="fixed inset-0 z-40"
                aria-hidden={!open}
            >
                <div className="absolute inset-0 overflow-hidden">
                    <div className="backdrop-layer absolute inset-0 bg-[#0a0a0a]" />
                    <div className="backdrop-layer absolute inset-0 bg-[#111111]" />
                    <div className="backdrop-layer absolute inset-0 bg-[#171717]" />
                </div>

                <div className="absolute inset-0" onClick={() => setOpen(false)} />

                <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6">
                    <ul className="pointer-events-auto flex flex-col items-center gap-12 md:gap-6">
                        {links.map((link) => (
                            <li key={link.href} className="overflow-hidden">
                                <Link
                                    href={link.href}
                                    onClick={() => setOpen(false)}
                                    className="nav-link-item inline-block text-4xl font-medium text-white transition-colors duration-200 hover:text-[#78EDC0] md:text-6xl"
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Sign out — only when logged in */}
                    {isAuthed && (
                        <div className="pointer-events-auto mt-10">
                            <SignOutButton />
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
