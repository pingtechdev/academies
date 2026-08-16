"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Any authenticated tenant user may enter the dashboard shell; which actions they can
  // actually take is gated per-feature by permission checks (see useAuth().hasPermission),
  // not by a single hardcoded role here -- the backend has no built-in "admin" role anymore.
  const isDenied = !isAuthenticated;

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
