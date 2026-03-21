"use client";

import { Store } from "lucide-react";

export default function GuestLoadingOverlay() {
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md animate-fadeIn"
      style={{ animationDuration: '500ms' }}
    >
      <div 
        className="relative flex flex-col items-center text-center text-cyan-300"
        style={{ animation: 'slide-in-fwd-center 0.8s cubic-bezier(0.250, 0.460, 0.450, 0.940) both' }}
      >
        <Store className="w-16 h-16 mb-6 text-purple-400 animate-pulse" />
        <h1 
          className="text-3xl md:text-5xl font-bold tracking-wider animate-[flicker_2s_linear_infinite] bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent"
        >
          Generating Guest Session
        </h1>
        <p className="mt-4 text-lg text-slate-300">Preparing available gadgets...</p>
        <div 
          className="absolute inset-0 bg-purple-500/10 animate-[scanline_2s_linear_infinite] pointer-events-none"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 5px, 0 5px)'
          }}
        />
      </div>
      <div className="absolute bottom-12 w-full max-w-2xl px-6">
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 animate-[fadeOut_1.5s_ease-out_forwards]"
            style={{ width: '100%', animationName: 'guest-load-in' }}
          />
        </div>
        <p className="text-center text-xs text-slate-500 mt-3 font-mono">CONNECTION ESTABLISHED</p>
      </div>
       <style jsx>{`
        @keyframes guest-load-in {
          0% { width: 0%; }
          50% { width: 60%; }
          100% { width: 100%; }
        }
        div[style*="animation-name: 'guest-load-in'"] {
          animation-duration: 1.2s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
