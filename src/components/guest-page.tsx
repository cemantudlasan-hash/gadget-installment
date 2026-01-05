
"use client";

import { ArrowLeft, Store, Contact } from "lucide-react";
import { Button } from "./ui/button";

interface GuestPageProps {
  onBack: () => void;
}

const BackgroundOrbs = () => (
    <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-50px] left-[-50px] w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[-20px] right-[20px] w-72 h-72 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-50px] left-[20%] w-72 h-72 bg-cyan-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-[-20px] right-[-50px] w-72 h-72 bg-pink-500 rounded-full filter blur-3xl opacity-10 animate-blob animation-delay-6000"></div>
    </div>
);

export default function GuestPage({ onBack }: GuestPageProps) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-slate-900 text-white p-4">
      <BackgroundOrbs />
      <div className="relative z-10 text-center max-w-2xl">
        <div className="p-4 bg-cyan-400/20 rounded-full inline-block mb-6 border border-cyan-400/50">
          <Store className="w-16 h-16 text-cyan-300" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider">
          Our Store is Coming Soon!
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          We're working hard to bring you a new page where you can browse all
          available gadgets. Stay tuned!
        </p>
        <div className="mt-8 bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20">
          <h2 className="text-xl font-bold flex items-center justify-center gap-2">
            <Contact className="w-6 h-6" />
            Contact Information
          </h2>
          <p className="mt-2 text-slate-300">
            In the meantime, you can reach out to us directly.
          </p>
          <div className="mt-4 space-y-2 text-cyan-300">
             <p><strong>Owner:</strong> Saowakon Noycumlee</p>
             <p><strong>Location:</strong> Buengkan, Thailand</p>
          </div>
        </div>

        <Button
          onClick={onBack}
          variant="outline"
          className="mt-12 text-lg py-3 px-6 font-semibold bg-transparent hover:bg-slate-700/50 border-slate-600 text-slate-300 rounded-md transition-all duration-300"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Go Back
        </Button>
      </div>
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
            animation: blob 7s infinite;
        }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animation-delay-6000 { animation-delay: 6s; }
      `}</style>
    </div>
  );
}
