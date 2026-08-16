"use client";

import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CreditCard,
  LogOut,
  ChevronLeft,
  Baby,
  X,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Children", href: "/children", icon: Baby },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load from localStorage if available
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarCollapsed") === "true";
    }
    return false;
  });

  const handleLogout = () => {
    logout();
    // Use window.location to prevent back navigation and clear history
    window.location.href = "/login";
  };

  const handleNavClick = () => {
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    // Persist to localStorage
    localStorage.setItem("sidebarCollapsed", String(newState));
    // Emit event for DashboardLayout to listen
    window.dispatchEvent(new CustomEvent("sidebarToggle"));
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 z-40",
        isMobile ? "w-full" : isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn("p-4 border-b border-sidebar-border relative", isCollapsed && "pr-2")}>
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-3", isCollapsed && "justify-center w-full")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.jpeg"
              alt="Victory Academy"
              className={cn("w-10 h-10 object-contain flex-shrink-0", isCollapsed && "w-8 h-8")}
            />
            {!isCollapsed && (
              <div>
                <h1 className="font-heading font-bold text-sm">Victory Academy</h1>
                <p className="text-xs text-sidebar-foreground/60">Admin Portal</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMobile && onNavigate && (
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 flex-shrink-0"
                onClick={onNavigate}
              >
                <X className="w-5 h-5" />
              </Button>
            )}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 flex-shrink-0 z-50",
                  isCollapsed
                    ? "absolute -right-3 top-6 bg-sidebar border border-sidebar-border rounded-full shadow-lg hover:bg-sidebar-accent hover:shadow-xl"
                    : "relative"
                )}
                onClick={handleToggle}
              >
                <ChevronLeft className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
              (isCollapsed || isMobile) && !isMobile && "justify-center px-2"
            )}
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {(!isCollapsed || isMobile) && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            "text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            (isCollapsed || isMobile) && !isMobile && "justify-center px-2"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!isCollapsed || isMobile) && <span>Logout</span>}
        </button>

        {/* User Info */}
        {(!isCollapsed || isMobile) && user && (
          <div className="mt-3 p-3 rounded-lg bg-sidebar-accent/50">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user.username}</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
