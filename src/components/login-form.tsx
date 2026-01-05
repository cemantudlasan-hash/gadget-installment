
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, ArrowLeft } from "lucide-react";

const FuturisticFrame = () => (
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <style>{`
          @keyframes draw {
            to {
              stroke-dashoffset: 0;
            }
          }
          @keyframes fadeIn {
            to {
              opacity: 1;
            }
          }
          .draw-path {
            stroke-dasharray: 1000;
            stroke-dashoffset: 1000;
            animation: draw 2s ease-out forwards;
          }
          .fade-in {
            opacity: 0;
            animation: fadeIn 1.5s ease-in forwards;
          }
          .draw-path:nth-of-type(1) { animation-delay: 0s; }
          .draw-path:nth-of-type(2) { animation-delay: 0.1s; }
          .draw-path:nth-of-type(3) { animation-delay: 0.2s; }
          .draw-path:nth-of-type(4) { animation-delay: 0.3s; }
          .draw-path:nth-of-type(5) { animation-delay: 0.4s; }
          .draw-path:nth-of-type(6) { animation-delay: 0.5s; }
          .draw-path:nth-of-type(7) { animation-delay: 0.6s; }
          .draw-path:nth-of-type(8) { animation-delay: 0.7s; }
          .draw-path:nth-of-type(9) { animation-delay: 0.8s; }
          .draw-path:nth-of-type(10) { animation-delay: 0.9s; }
          .draw-path:nth-of-type(11) { animation-delay: 1s; }
          .draw-path:nth-of-type(12) { animation-delay: 1.1s; }
          .dot {
            animation-delay: 2.2s;
          }
          .frame-fill {
             animation-delay: 1.5s;
          }
        `}</style>
        <linearGradient id="glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'rgba(0, 191, 255, 0.8)', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'rgba(0, 111, 255, 0.9)', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
        <radialGradient id="dot-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" style={{stopColor: 'rgba(173, 216, 230, 1)', stopOpacity: 1}} />
            <stop offset="70%" style={{stopColor: 'rgba(0, 191, 255, 0.5)', stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: 'rgba(0, 111, 255, 0)', stopOpacity: 1}} />
        </radialGradient>
      </defs>

      <g stroke="url(#glow-gradient)" strokeWidth="2" fill="none">
        {/* Main Frame */}
        <path className="draw-path" d="M 100,50 L 150,50 L 160,40 H 250 L 260,50 H 540 L 550,40 H 640 L 650,50 H 700 L 750,100 V 500 L 700,550 H 650 L 640,560 H 550 L 540,550 H 260 L 250,560 H 160 L 150,550 H 100 L 50,500 V 100 Z" />

        {/* Top Left Details */}
        <path className="draw-path" d="M 160,40 L 155,35 H 135" />
        <path className="draw-path" d="M 260,50 L 265,55 V 75" />
        
        {/* Top Right Details */}
        <path className="draw-path" d="M 640,40 L 645,35 H 665" />
        <path className="draw-path" d="M 540,50 L 535,55 V 75" />

        {/* Bottom Left Details */}
        <path className="draw-path" d="M 160,560 L 155,565 H 135" />
        <path className="draw-path" d="M 260,550 L 265,545 V 525" />
        
        {/* Bottom Right Details */}
        <path className="draw-path" d="M 640,560 L 645,565 H 665" />
        <path className="draw-path" d="M 540,550 L 535,545 V 525" />
        
        {/* Side Details Left */}
        <path className="draw-path" d="M 50,150 H 40 L 30,160 V 200" />
        <path className="draw-path" d="M 50,450 H 40 L 30,440 V 400" />
        <path className="draw-path" d="M 80,100 L 80,90" />
        <path className="draw-path" d="M 80,500 L 80,510" />

        {/* Side Details Right */}
        <path className="draw-path" d="M 750,150 H 760 L 770,160 V 200" />
        <path className="draw-path" d="M 750,450 H 760 L 770,440 V 400" />
        <path className="draw-path" d="M 720,100 L 720,90" />
        <path className="draw-path" d="M 720,500 L 720,510" />

        {/* Glowing Dots */}
        <circle cx="120" cy="35" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="275" cy="35" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="525" cy="35" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="680" cy="35" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="20" cy="220" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="20" cy="380" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="780" cy="220" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="780" cy="380" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="120" cy="565" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="275" cy="565" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="525" cy="565" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
        <circle cx="680" cy="565" r="5" fill="url(#dot-glow)" stroke="none" filter="url(#glow)" className="fade-in dot"/>
      </g>
      
       <path
        d="M 100,50 L 150,50 L 160,40 H 250 L 260,50 H 540 L 550,40 H 640 L 650,50 H 700 L 750,100 V 500 L 700,550 H 650 L 640,560 H 550 L 540,550 H 260 L 250,560 H 160 L 150,550 H 100 L 50,500 V 100 Z"
        fill="rgba(10, 25, 47, 0.5)"
        stroke="rgba(0, 191, 255, 0.5)"
        strokeWidth="1"
        className="fade-in frame-fill"
      />
    </svg>
  );

interface LoginFormProps {
  onLoginSuccess: () => void;
  onBack: () => void;
}

export default function LoginForm({ onLoginSuccess, onBack }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "tudlasan2720866") {
      onLoginSuccess();
    } else {
      setError("Invalid username or password. Please try again.");
    }
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, #0a203e 0%, #030a1a 70%)' }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-2xl h-[30rem] flex items-center justify-center p-8">
        <FuturisticFrame />
        <div className="relative z-20 w-full max-w-sm">
            <h2 className="mb-8 text-center text-3xl font-bold tracking-wider text-cyan-300 uppercase">
                Admin Login
            </h2>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded-md text-slate-300 placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded-md text-slate-300 placeholder-slate-500 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400 text-center bg-red-900/50 p-2 rounded-md border border-red-500/50">{error}</p>
              )}
               <div className="flex flex-col space-y-4">
                <Button
                    type="submit"
                    className="w-full text-lg py-3 font-semibold bg-cyan-600/80 hover:bg-cyan-500/80 border border-cyan-500 text-cyan-50 rounded-md transition-all duration-300 shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.6)]"
                >
                    Access
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="w-full text-lg py-3 font-semibold bg-transparent hover:bg-slate-700/50 border-slate-600 text-slate-300 rounded-md transition-all duration-300"
                >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Back
                </Button>
              </div>
            </form>
        </div>
      </div>
      <div className="absolute bottom-4 text-center text-xs text-slate-400 z-10">
            <p>AI powered @Firebase</p>
            <p>Created and Idea by: Ceman Dejamo Tudlasan</p>
      </div>
    </div>
  );
}
