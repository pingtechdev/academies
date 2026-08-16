"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const isDenied = !isAuthenticated || (!!user && user.role !== "admin");

  useEffect(() => {
    if (!isLoading && isDenied) {
      router.replace("/login");
    }
  }, [isLoading, isDenied, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Redirect is in flight; render nothing to avoid a flash of protected content.
  if (isDenied) {
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
