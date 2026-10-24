import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
    return (
        <header className="relative h-screen w-full overflow-hidden flex flex-col">
            {/* 1. image layer — out of flow, fills the header */}
            <div className="absolute inset-0 overflow-hidden">
                <Image
                    src="/bg.png"
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-center blur-[0.2px]"
                />
                {/* top-down shade */}
                <div className="absolute inset-0 bg-gradient-to-b from-[rgba(17,17,17,0.65)] from-[8.78%] to-[rgba(17,17,17,0)] to-[32.21%]" />
            </div>

            {/* 2. bottom shade / vignette */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "linear-gradient(0deg, rgba(0,0,0,0.42), transparent 58%), radial-gradient(ellipse at 0% 78%, rgba(0,0,0,0.48), rgba(0,0,0,0.12) 43%, transparent 73%)",
                }}
            />

            {/* 3. text — normal flow, pushed to bottom by mt-auto */}
            <div className="relative z-10 flex flex-col gap-4 mt-auto p-2 backdrop-blur-[1px]">
                <h2 className="text-2xl font-medium">
                    Money Owed.<br />
                    Money Delayed.
                </h2>
                <p className="text-base">You've  finished the work. You've sent the invoice. The customer said they'd  pay. And then weeks pass, and the invoice is still open, and you're  checking the bank balance again. Meanwhile the salaries, the rent, and  the GST keep coming due. The work is finished. The payment isn't.</p>
            </div>

            {/* 4. page blend */}
            <div
                className="relative z-10 h-10 pointer-events-none w-full flex-shrink-0"
                style={{ background: "linear-gradient(transparent, var(--background))" }}
            />
        </header>
    );
}
