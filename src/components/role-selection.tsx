
"use client";

import { cn } from "@/lib/utils";
import { UserCog, User } from "lucide-react";
import React from 'react';

interface RoleSelectionProps {
  onRoleSelect: (role: "admin" | "guest") => void;
}

const Background = () => (
    <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900">
        <div className="absolute inset-0 z-10 bg-gradient-to-br from-slate-900 via-transparent to-slate-900"></div>
    </div>
);


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
        className="relative z-10 bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-lg border border-white/20 hover:border-cyan-400/50 hover:shadow-cyan-500/20 transform hover:-translate-y-2 transition-all duration-300 cursor-pointer"
        onClick={onClick}
    >
        <div className="flex flex-col items-center text-center text-white">
            <div className="p-4 bg-cyan-400/20 rounded-full mb-4 border border-cyan-400/50">
                <Icon className="w-12 h-12 text-cyan-300" />
            </div>
            <h3 className="text-2xl font-bold tracking-wider">{title}</h3>
            <p className="mt-2 text-sm text-slate-300">{description}</p>
        </div>
    </div>
)


export default function RoleSelection({ onRoleSelect }: RoleSelectionProps) {

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden"
    >
        <Background />
      <div className="relative z-10 text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-wider">
            Welcome to Gadget Management
        </h1>
        <p className="mt-4 text-lg text-slate-300">Please select your role to continue</p>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
