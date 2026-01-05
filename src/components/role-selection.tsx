"use client";

import { cn } from "@/lib/utils";
import { UserCog, User } from "lucide-react";
import React from 'react';

interface RoleSelectionProps {
  onRoleSelect: (role: "admin" | "guest") => void;
}

const BackgroundOrbs = () => (
    <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-50px] left-[-50px] w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-[-20px] right-[20px] w-72 h-72 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-50px] left-[20%] w-72 h-72 bg-cyan-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-[-20px] right-[-50px] w-72 h-72 bg-pink-500 rounded-full filter blur-3xl opacity-10 animate-blob animation-delay-6000"></div>
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
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-slate-900"
    >
        <BackgroundOrbs />
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
            description="View a read-only version of the dashboard and sales information."
            onClick={() => onRoleSelect('guest')}
        />
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