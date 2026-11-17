"use client";

import dynamic from "next/dynamic";

const HomePageClient = dynamic(() => import("@/components/home-page-client"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center min-h-screen bg-[#090D16]"
      suppressHydrationWarning
    >
      <div className="w-full max-w-md space-y-4 p-8 text-center" suppressHydrationWarning>
        <div
          className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto mb-4"
          suppressHydrationWarning
        />
        <p className="text-slate-400 text-sm font-mono" suppressHydrationWarning>
          Loading gadget-installment.cc...
        </p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <HomePageClient />;
}
