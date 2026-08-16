"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import { apiClient } from "@/lib/api";
import {
  Users,
  CreditCard,
  TrendingUp,
  ArrowRight,
  UserPlus,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const Dashboard = () => {
  const { user } = useAuth();

  // Fetch children
  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["children"],
    queryFn: () => apiClient.getChildren(),
  });

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => apiClient.getPayments(),
  });

  if (!user) return null;

  if (childrenLoading || paymentsLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate statistics
  const totalChildren = children.length;
  const paidPayments = payments.filter((p: any) => p.status === "paid").length;
  const pendingPayments = payments.filter((p: any) => p.status === "pending").length;
  const overduePayments = payments.filter((p: any) => p.status === "overdue").length;
  const totalPayments = payments.length;

  // Recent children
  const recentChildren = [...children]
    .sort((a: any, b: any) => new Date(b.join_date).getTime() - new Date(a.join_date).getTime())
    .slice(0, 5);

  // Level distribution
  const levelDistribution = {
    beginner: children.filter((c: any) => c.level === "beginner").length,
    intermediate: children.filter((c: any) => c.level === "intermediate").length,
    advanced: children.filter((c: any) => c.level === "advanced").length,
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">
            Welcome back, {user?.name?.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Here&apos;s what&apos;s happening at the academy today.
          </p>
        </div>
        <Button variant="hero" asChild className="w-full sm:w-auto">
          <Link href="/children">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Child
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Players"
          value={totalChildren}
          subtitle="Registered children"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Payments"
          value={`${paidPayments}/${totalPayments}`}
          subtitle={`${overduePayments} overdue`}
          icon={CreditCard}
          variant={overduePayments > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Pending Payments"
          value={pendingPayments}
          subtitle="Awaiting payment"
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Overdue Payments"
          value={overduePayments}
          subtitle="Need attention"
          icon={CreditCard}
          variant={overduePayments > 0 ? "warning" : "success"}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Players */}
        <Card variant="elevated" className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Recent Players</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/children">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentChildren.map((child: any) => {
                return (
                  <div
                    key={child.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                        {child.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{child.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(child.date_of_birth).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={child.level} className="text-xs">{child.level}</Badge>
                      <Badge
                        variant={child.has_kit ? "success" : "secondary"}
                        className="text-xs"
                      >
                        {child.has_kit ? "Has Kit" : "No Kit"}
                      </Badge>
                      <Badge
                        variant={child.is_active ? "default" : "outline"}
                        className="text-xs"
                      >
                        {child.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Level Distribution */}
          <Card variant="elevated">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Level Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(levelDistribution).map(([level, count]) => {
                const percentage = totalChildren > 0 ? Math.round((count / totalChildren) * 100) : 0;
                return (
                  <div key={level} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize font-medium">{level}</span>
                      <span className="text-muted-foreground">{count} players</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          level === "beginner"
                            ? "bg-success"
                            : level === "intermediate"
                            ? "bg-accent"
                            : "bg-primary"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card variant="elevated">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Button variant="outline" size="sm" className="justify-start w-full" asChild>
                <Link href="/children">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Child
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="justify-start w-full" asChild>
                <Link href="/payments">
                  <CreditCard className="w-4 h-4 mr-2" />
                  View Payments
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
