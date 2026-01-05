
"use client";

import { cn } from "@/lib/utils";
import { UserCog, User } from "lucide-react";
import React from 'react';

interface RoleSelectionProps {
  onRoleSelect: (role: "admin" | "guest") => void;
}

const RoleCard = ({
    icon: Icon,
    title,
    description,
    onClick
}: {
    icon: React.ElementType,
    title: string,
    description: string,
    onClick: () => void
}) => (
    <div
        className="group relative w-full max-w-sm cursor-pointer"
        onClick={onClick}
    >
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-cyan-400 rounded-lg blur-sm opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
        <div className="relative p-8 bg-slate-900/80 backdrop-blur-lg rounded-xl shadow-lg border border-purple-500/30 flex flex-col items-center text-center text-white transform group-hover:scale-105 transition-transform duration-300">
            <div className="relative mb-6">
                <div className="absolute -inset-2 bg-purple-500/30 rounded-full animate-pulse"></div>
                <div className="relative p-4 bg-slate-800 rounded-full border-2 border-purple-400">
                    <Icon className="w-12 h-12 text-cyan-300" />
                </div>
            </div>
            <h3 className="text-3xl font-bold tracking-wider uppercase bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">{title}</h3>
            <p className="mt-3 text-sm text-slate-400">{description}</p>

            {/* Glitchy decorative elements */}
            <div className="absolute top-4 left-4 w-8 h-4 bg-cyan-400/50 clip-path-glitch-1 animate-glitch-slow"></div>
            <div className="absolute bottom-4 right-4 w-8 h-4 bg-purple-500/50 clip-path-glitch-2 animate-glitch-fast"></div>
        </div>
    </div>
)


export default function RoleSelection({ onRoleSelect }: RoleSelectionProps) {

  return (
    <div 
      className="dashboard-bg relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4"
    >
      <div className="relative z-10 text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
            Welcome to <span className="whitespace-nowrap">Clef's Gadget-Installment</span> and Online Store
        </h1>
        <p className="mt-4 text-lg text-slate-300">Please select your role to continue</p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
        <RoleCard
            icon={UserCog}
            title="Admin"
            description="Access the full dashboard to manage sales, installments, and reports."
            onClick={() => onRoleSelect('admin')}
        />
        <RoleCard
            icon={User}
            title="Guest"
            description="Browse available gadgets and inquire about products."
            onClick={() => onRoleSelect('guest')}
        />
      </div>
    </div>
  );
}
