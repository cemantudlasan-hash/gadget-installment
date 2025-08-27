
"use client";

export default function LoginOverlay() {
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 animate-fadeIn"
      style={{ animationDuration: '500ms' }}
    >
      <div 
        className="relative font-mono text-center text-cyan-300"
        style={{ animation: 'slide-in-fwd-center 0.8s cubic-bezier(0.250, 0.460, 0.450, 0.940) both' }}
      >
        <h1 
          className="text-4xl md:text-6xl uppercase tracking-widest animate-[flicker_2s_linear_infinite]"
        >
          Access Granted
        </h1>
        <p className="mt-4 text-lg">Initializing Dashboard...</p>
        <div 
          className="absolute inset-0 bg-cyan-500/10 animate-[scanline_2s_linear_infinite]"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 5px, 0 5px)'
          }}
        />
      </div>
      <div className="absolute bottom-10 w-full max-w-3xl px-4">
        <div className="h-2 bg-cyan-900/50 rounded overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-[fadeOut_1.5s_ease-out_forwards]"
            style={{ width: '100%', animationName: 'load-in' }}
          />
        </div>
        <p className="text-center text-xs text-cyan-500/70 mt-2">AUTHENTICATION COMPLETE</p>
      </div>
       <style jsx>{`
        @keyframes load-in {
          from { width: 0%; }
          to { width: 100%; }
        }
        div[style*="animation-name: 'load-in'"] {
          animation-duration: 1.2s;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
