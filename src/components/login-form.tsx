"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock } from "lucide-react";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

const FuturisticFrame = () => (
    <svg
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox="0 0 800 400"
      preserveAspectRatio="none"
    >
      <defs>
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
      </defs>
      <path
        d="M 150,50 
           L 350,50 L 400,20 L 450,50
           L 650,50
           L 700,100
           L 700,150
           L 670,180
           L 670,220
           L 700,250
           L 700,300
           L 650,350
           L 450,350 L 400,380 L 350,350
           L 150,350
           L 100,300
           L 100,250
           L 130,220
           L 130,180
           L 100,150
           L 100,100
           Z"
        fill="none"
        stroke="url(#glow-gradient)"
        strokeWidth="3"
        filter="url(#glow)"
      />
       <path
        d="M 150,50 
           L 350,50 L 400,20 L 450,50
           L 650,50
           L 700,100
           L 700,150
           L 670,180
           L 670,220
           L 700,250
           L 700,300
           L 650,350
           L 450,350 L 400,380 L 350,350
           L 150,350
           L 100,300
           L 100,250
           L 130,220
           L 130,180
           L 100,150
           L 100,100
           Z"
        fill="rgba(10, 25, 47, 0.5)"
        stroke="rgba(0, 191, 255, 0.5)"
        strokeWidth="2"
      />
    </svg>
  );

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin") {
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
      
      <div className="relative z-10 w-full max-w-2xl h-96 flex items-center justify-center p-8">
        <FuturisticFrame />
        <div className="relative z-20 w-full max-w-sm">
            <h2 className="mb-8 text-center text-3xl font-bold tracking-wider text-cyan-300 uppercase">
                Login
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
              <Button
                type="submit"
                className="w-full text-lg py-3 font-semibold bg-cyan-600/80 hover:bg-cyan-500/80 border border-cyan-500 text-cyan-50 rounded-md transition-all duration-300 shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.6)]"
              >
                Access
              </Button>
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
