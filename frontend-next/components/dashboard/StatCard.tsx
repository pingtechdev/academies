"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "accent" | "success" | "warning";
  className?: string;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) => {
  const iconBgClasses = {
    default: "bg-muted",
    primary: "gradient-primary",
    accent: "gradient-accent",
    success: "bg-success/10",
    warning: "bg-warning/10",
  };

  const iconColorClasses = {
    default: "text-muted-foreground",
    primary: "text-primary-foreground",
    accent: "text-accent-foreground",
    success: "text-success",
    warning: "text-warning",
  };

  return (
    <Card variant="elevated" className={cn("p-6", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-heading font-bold">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}
              >
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            iconBgClasses[variant]
          )}
        >
          <Icon className={cn("w-6 h-6", iconColorClasses[variant])} />
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
