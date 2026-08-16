"use client";

import { useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    // Use window.location to prevent back navigation and clear history
    window.location.href = "/login";
  };

  // Listen for sidebar collapse state changes
  useEffect(() => {
    const handleStorageChange = () => {
      const collapsed = localStorage.getItem("sidebarCollapsed") === "true";
      setSidebarCollapsed(collapsed);
    };

    // Check initial state
    handleStorageChange();

    // Listen for custom event from sidebar
    window.addEventListener("sidebarToggle", handleStorageChange);
    return () => window.removeEventListener("sidebarToggle", handleStorageChange);
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && <AppSidebar />}

      {/* Mobile Header with Menu and Logout */}
      {isMobile && (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="bg-background/80 backdrop-blur-sm shadow-lg h-9 w-9"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-9 px-3 text-destructive hover:text-destructive hover:bg-destructive/10 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </Button>
        </div>
      )}

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content - with margin for fixed sidebar */}
      <main
        className={cn(
          "flex-1 overflow-y-auto h-screen transition-all duration-300",
          isMobile ? "pt-14" : "pt-0",
          !isMobile && (sidebarCollapsed ? "ml-16" : "ml-64")
        )}
      >
        <div className="p-3 sm:p-4 lg:p-6 xl:p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
