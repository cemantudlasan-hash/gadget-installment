
"use client";

export default function LogoutOverlay() {
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 animate-fadeIn"
      style={{ animationDuration: '500ms' }}
    >
      <div className="relative font-mono text-center text-green-400">
        <h1 
          className="text-4xl md:text-6xl uppercase tracking-widest animate-[flicker_2s_linear_infinite]"
        >
          Logging Out
        </h1>
        <p className="mt-4 text-lg">De-authenticating user session...</p>
        <div 
          className="absolute inset-0 bg-green-500/10 animate-[scanline_2s_linear_infinite]"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 5px, 0 5px)'
          }}
        />
      </div>
      <div className="absolute bottom-10 w-full max-w-3xl px-4">
        <div className="h-2 bg-green-900/50 rounded overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-cyan-400 animate-[fadeOut_1.5s_ease-out_forwards]"
            style={{ width: '100%' }}
          />
        </div>
        <p className="text-center text-xs text-green-500/70 mt-2">SESSION TERMINATED</p>
      </div>
    </div>
  );
}
