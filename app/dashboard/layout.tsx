// app/dashboard/layout.tsx
"use client";

import type React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Eye, LogOut } from 'lucide-react';
import NotificationInbox from '@/components/ui/notification-inbox'; // Import the notification component

const getRoleIcon = (role: string) => {
  switch (role) {
    case "manager":
      return <Shield className="w-4 h-4" />;
    case "employee":
      return <User className="w-4 h-4" />;
    case "viewer":
      return <Eye className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case "manager":
      return "border-red-500 text-red-400 bg-red-900/20";
    case "employee":
      return "border-blue-500 text-blue-400 bg-blue-900/20";
    case "viewer":
      return "border-gray-500 text-gray-400 bg-gray-900/20";
    default:
      return "border-gray-500 text-gray-400 bg-gray-900/20";
  }
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userProfile, authState, handleSignOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authState === "unauthenticated") {
      router.push("/");
    }
  }, [authState, router]);

  const onLogout = async () => {
    await handleSignOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    router.push("/");
  };

  if (authState === "loading" || !userProfile) {
    return null; // Let the page component handle its own loading/auth states
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Image
            src="/opsclad-logo.png"
            alt="OpsClad by DataClad"
            width={400}
            height={200}
            className="mx-auto"
            priority
          />
        </div>

        {/* Top Panel with user info, notification inbox, and logout button */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h4 className="text-white font-medium">Hi, {userProfile.username}!</h4>
              <Badge variant="outline" className={`${getRoleColor(userProfile.role)} text-xs`}>
                <span className="capitalize">{userProfile.role}</span>
              </Badge>
            </div>
            <p className="text-gray-400 text-sm">{userProfile.email}</p>
          </div>
          
          {/* Right side with notification inbox and logout */}
          <div className="flex items-center gap-3">
            {/* Notification Inbox */}
            <NotificationInbox 
              currentUser={{
                id: userProfile.id || userProfile.username,
                role: userProfile.role,
                username: userProfile.username
              }} 
            />
            
            {/* Logout Button */}
            <Button
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white bg-transparent"
              onClick={onLogout}
            >
              <LogOut className="mr-2 h-4 w-4" /> Log Out
            </Button>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}