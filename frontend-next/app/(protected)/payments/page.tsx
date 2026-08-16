"use client";

import { Suspense, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Search,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Loader2,
  Pencil,
  Calendar,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const markPaidSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  month: z.string().min(1, "Month is required").optional(),
  year: z.number().min(2000, "Year must be valid").optional(),
});

const editPaymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  month: z.string().min(1, "Month is required"),
  year: z.number().min(2000, "Year must be valid"),
  status: z.enum(["paid", "pending", "overdue"]),
  paid_date: z.string().optional(),
});

type MarkPaidFormData = z.infer<typeof markPaidSchema>;
type EditPaymentFormData = z.infer<typeof editPaymentSchema>;

const PaymentsContent = () => {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Get current month for initial filter (format: YYYY-MM)
  const getCurrentMonthYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthYearFilter, setMonthYearFilter] = useState<string>(""); // Empty = show all months
  const [searchQuery, setSearchQuery] = useState("");
  const childIdFilter = searchParams.get("child_id");

  // Dialog states
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  // Mark as Paid / Create Payment form
  const markPaidForm = useForm<MarkPaidFormData>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: {
      amount: 0,
      month: "",
      year: new Date().getFullYear(),
    },
  });

  // Edit Payment form
  const editPaymentForm = useForm<EditPaymentFormData>({
    resolver: zodResolver(editPaymentSchema),
    defaultValues: {
      amount: 0,
      month: "",
      year: new Date().getFullYear(),
      status: "pending",
      paid_date: "",
    },
  });

  const isAdmin = hasPermission("payments:write");

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments", {
      status: statusFilter !== "all" ? statusFilter : undefined,
      child_id: childIdFilter || undefined,
    }],
    queryFn: () => apiClient.getPayments({
      status: statusFilter !== "all" ? statusFilter : undefined,
      child_id: childIdFilter || undefined,
    }),
  });

  // Fetch children for lookup
  const { data: children = [], isLoading: childrenLoading } = useQuery({
    queryKey: ["children"],
    queryFn: () => apiClient.getChildren(),
    // Refetch children when the component mounts to ensure newly added children appear
    refetchOnMount: "always",
  });

  // Helper function to convert month name to number
  const getMonthNumber = (monthName: string): string => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];
    const index = monthNames.indexOf(monthName);
    return String(index + 1).padStart(2, "0");
  };

  // Mark as Paid / Create Payment mutation
  const markPaidMutation = useMutation({
    mutationFn: async (data: MarkPaidFormData) => {
      if (!selectedPayment) return;

      // If payment already exists (has an id that's not a placeholder), update it
      if (selectedPayment.id && !selectedPayment.id.startsWith("no-payment-")) {
        return apiClient.updatePayment(selectedPayment.id, {
          status: "paid",
          amount: data.amount,
          paid_date: new Date().toISOString().split("T")[0],
        });
      } else {
        // Create new payment - month and year are required
        if (!data.month || !data.year) {
          throw new Error("Month and year are required to create a payment");
        }

        const today = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June",
                           "July", "August", "September", "October", "November", "December"];
        const monthIndex = monthNames.indexOf(data.month);
        const dueDate = new Date(data.year, monthIndex, 1);

        return apiClient.createPayment({
          child_id: selectedPayment.child_id,
          amount: data.amount,
          month: data.month,
          year: data.year,
          status: "paid",
          paid_date: today.toISOString().split("T")[0],
          due_date: dueDate.toISOString().split("T")[0],
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Payment Marked as Paid",
        description: "Payment has been successfully marked as paid.",
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setShowMarkPaidDialog(false);
      setSelectedPayment(null);
      markPaidForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark payment as paid",
        variant: "destructive",
      });
    },
  });

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: EditPaymentFormData) => {
      if (!selectedPayment) return;
      const updateData: any = {
        amount: data.amount,
        month: data.month,
        year: data.year,
        status: data.status,
      };

      // If status is not 'paid', clear paid_date. If it's 'paid' and paid_date is provided, use it
      if (data.status === "paid") {
        if (data.paid_date) {
          updateData.paid_date = data.paid_date;
        } else if (!selectedPayment.paid_date) {
          // If marking as paid and no paid_date provided, set to today
          updateData.paid_date = new Date().toISOString().split("T")[0];
        }
      } else {
        // If status is not paid, clear paid_date
        updateData.paid_date = null;
      }

      return apiClient.updatePayment(selectedPayment.id, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Payment Updated",
        description: "Payment has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setShowEditDialog(false);
      setSelectedPayment(null);
      editPaymentForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment",
        variant: "destructive",
      });
    },
  });

  const handleMarkPaid = (payment: any) => {
    setSelectedPayment(payment);
    // If it's a placeholder (no existing payment), set default values
    if (payment.id && payment.id.startsWith("no-payment-")) {
      markPaidForm.reset({
        amount: 0,
        month: "",
        year: new Date().getFullYear(),
      });
    } else {
      // Existing payment - prefill amount
      markPaidForm.reset({
        amount: payment.amount,
        month: payment.month,
        year: payment.year,
      });
    }
    setShowMarkPaidDialog(true);
  };

  const handleEdit = (payment: any) => {
    setSelectedPayment(payment);
    const paymentStatus = typeof payment.status === "string"
      ? payment.status
      : payment.status?.value || payment.status || "pending";
    editPaymentForm.reset({
      amount: payment.amount,
      month: payment.month,
      year: payment.year,
      status: paymentStatus as "paid" | "pending" | "overdue",
      paid_date: payment.paid_date || "",
    });
    setShowEditDialog(true);
  };

  const handleExportReport = () => {
    // Prepare data for export
    const exportData = filteredPayments.map((payment: any) => {
      const child = children.find((c: any) => c.id === payment.child_id);
      return {
        "Child Name": child?.name || "Unknown",
        "Period": `${payment.month} ${payment.year}`,
        "Amount ($)": payment.amount,
        "Due Date": payment.due_date ? new Date(payment.due_date).toLocaleDateString() : "",
        "Status": payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
        "Paid Date": payment.paid_date ? new Date(payment.paid_date).toLocaleDateString() : "",
      };
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");

    // Generate filename with current date
    const now = new Date();
    const filename = `payments_report_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}_${String(now.getDate()).padStart(2, "0")}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);

    toast({
      title: "Report Exported",
      description: `Payment report has been downloaded as ${filename}`,
    });
  };

  const onMarkPaidSubmit = (data: MarkPaidFormData) => {
    markPaidMutation.mutate(data);
  };

  const onEditSubmit = (data: EditPaymentFormData) => {
    updatePaymentMutation.mutate(data);
  };

  // Filter to only active children
  const activeChildren = useMemo(() => {
    return children.filter((child: any) => child.is_active !== false);
  }, [children]);

  // Group payments by child and create a structure showing all active children with their payments
  const childrenWithPayments = useMemo(() => {
    return activeChildren.map((child: any) => {
      const childPayments = payments.filter((p: any) => p.child_id === child.id);
      return {
        child,
        payments: childPayments,
      };
    });
  }, [activeChildren, payments]);

  // Filter children by search query only (always show all children that match search)
  const filteredChildrenWithPayments = useMemo(() => {
    return childrenWithPayments.filter(({ child }) => {
      // Filter by search query (child name)
      return child.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [childrenWithPayments, searchQuery]);

  // Flatten to show all payments for filtered children
  const filteredPayments = useMemo(() => {
    const result: any[] = [];
    filteredChildrenWithPayments.forEach(({ child, payments: childPayments }) => {
      // Filter payments based on status and month/year filters
      const filteredChildPayments = childPayments.filter((payment: any) => {
        const paymentStatus = typeof payment.status === "string"
          ? payment.status
          : payment.status?.value || payment.status;
        const matchesStatus = statusFilter === "all" || paymentStatus === statusFilter;

        let matchesMonthYear = true;
        if (monthYearFilter) {
          const [selectedYear, selectedMonth] = monthYearFilter.split("-");
          const monthNumber = getMonthNumber(payment.month);
          matchesMonthYear = payment.year === parseInt(selectedYear) && monthNumber === selectedMonth;
        }

        return matchesStatus && matchesMonthYear;
      });

      // If child has no payments after filtering, show placeholder row
      if (filteredChildPayments.length === 0) {
        // Only show placeholder if no filters are applied (or if search matches)
        // If filters are applied and child has no matching payments, still show them
        result.push({
          id: `no-payment-${child.id}`,
          child_id: child.id,
          child,
          isPlaceholder: true,
        });
      } else {
        // Add all filtered payments for this child
        filteredChildPayments.forEach((payment: any) => {
          result.push({
            ...payment,
            child,
          });
        });
      }
    });
    return result;
  }, [filteredChildrenWithPayments, statusFilter, monthYearFilter]);

  // Helper to get payment status as string
  const getPaymentStatus = (p: any): string => {
    return typeof p.status === "string" ? p.status : p.status?.value || String(p.status);
  };
  const paidCount = payments.filter((p: any) => getPaymentStatus(p) === "paid").length;
  const pendingCount = payments.filter((p: any) => getPaymentStatus(p) === "pending").length;
  const overdueCount = payments.filter((p: any) => getPaymentStatus(p) === "overdue").length;
  const totalRevenue = payments
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + p.amount, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "pending":
        return <Clock className="w-4 h-4 text-warning" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  if (paymentsLoading || childrenLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">Payments</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {isAdmin ? "Track and manage all payments." : "View your payment history."}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={handleExportReport} className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export Report</span>
            <span className="sm:hidden">Export</span>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card variant="elevated" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold">{paidCount}</p>
              <p className="text-sm text-muted-foreground">Paid</p>
            </div>
          </div>
        </Card>
        <Card variant="elevated" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card variant="elevated" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </div>
        </Card>
        {isAdmin && (
          <Card variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold">${totalRevenue}</p>
                <p className="text-sm text-muted-foreground">Revenue</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card variant="elevated">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by child name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 sm:flex-initial sm:w-[180px]">
                <Input
                  type="month"
                  value={monthYearFilter}
                  onChange={(e) => setMonthYearFilter(e.target.value)}
                  className="w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer pr-10"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card variant="elevated">
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-3 sm:px-0">
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Child</TableHead>
                <TableHead className="min-w-[100px]">Period</TableHead>
                <TableHead className="min-w-[80px]">Amount</TableHead>
                <TableHead className="min-w-[100px] hidden sm:table-cell">Due Date</TableHead>
                <TableHead className="min-w-[90px]">Status</TableHead>
                {isAdmin && <TableHead className="text-right min-w-[120px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment: any) => {
                const child = payment.child || children.find((c: any) => c.id === payment.child_id);

                // Handle placeholder rows for children with no payments
                if (payment.isPlaceholder) {
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                            {child?.name?.charAt(0) || "?"}
                          </div>
                          <span className="font-medium">{child?.name || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground italic">
                        No payments
                      </TableCell>
                      <TableCell className="text-muted-foreground">-</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">-</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground">
                          No payments
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleMarkPaid(payment)}
                            className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">Pay</span>
                            <span className="sm:hidden">Pay</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                          {child?.name?.charAt(0) || "?"}
                        </div>
                        <span className="font-medium">{child?.name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.month} {payment.year}
                    </TableCell>
                    <TableCell className="font-semibold">${payment.amount}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {payment.due_date ? new Date(payment.due_date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(getPaymentStatus(payment))}
                        <Badge
                          variant={
                            getPaymentStatus(payment) === "paid"
                              ? "success"
                              : getPaymentStatus(payment) === "pending"
                              ? "warning"
                              : "destructive"
                          }
                        >
                          {getPaymentStatus(payment)}
                        </Badge>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 sm:gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(payment)}
                            className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                          >
                            <Pencil className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          {getPaymentStatus(payment) !== "paid" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleMarkPaid(payment)}
                              className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                            >
                              Pay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredPayments.length === 0 && (
        <Card variant="elevated" className="p-12 text-center">
          <p className="text-muted-foreground">No payments found.</p>
        </Card>
      )}

      {/* Pay Dialog */}
      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pay Payment</DialogTitle>
          </DialogHeader>
          <Form {...markPaidForm}>
            <form onSubmit={markPaidForm.handleSubmit(onMarkPaidSubmit)} className="space-y-4">
              <FormField
                control={markPaidForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedPayment && selectedPayment.id && !selectedPayment.id.startsWith("no-payment-") && (
                <div className="text-sm text-muted-foreground">
                  <p>Original amount: ${selectedPayment.amount}</p>
                  <p>Child: {activeChildren.find((c: any) => c.id === selectedPayment.child_id)?.name}</p>
                  <p>Period: {selectedPayment.month} {selectedPayment.year}</p>
                </div>
              )}

              {/* Show month/year fields for new payments */}
              {selectedPayment && selectedPayment.id && selectedPayment.id.startsWith("no-payment-") && (
                <>
                  <div className="text-sm text-muted-foreground">
                    <p>Child: {activeChildren.find((c: any) => c.id === selectedPayment.child_id)?.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={markPaidForm.control}
                      name="month"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Month *</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select month" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="January">January</SelectItem>
                                <SelectItem value="February">February</SelectItem>
                                <SelectItem value="March">March</SelectItem>
                                <SelectItem value="April">April</SelectItem>
                                <SelectItem value="May">May</SelectItem>
                                <SelectItem value="June">June</SelectItem>
                                <SelectItem value="July">July</SelectItem>
                                <SelectItem value="August">August</SelectItem>
                                <SelectItem value="September">September</SelectItem>
                                <SelectItem value="October">October</SelectItem>
                                <SelectItem value="November">November</SelectItem>
                                <SelectItem value="December">December</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={markPaidForm.control}
                      name="year"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Year *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="2024"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMarkPaidDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  disabled={markPaidMutation.isPending}
                >
                  {markPaidMutation.isPending ? "Processing..." : "Pay"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <Form {...editPaymentForm}>
            <form onSubmit={editPaymentForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editPaymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editPaymentForm.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="January">January</SelectItem>
                            <SelectItem value="February">February</SelectItem>
                            <SelectItem value="March">March</SelectItem>
                            <SelectItem value="April">April</SelectItem>
                            <SelectItem value="May">May</SelectItem>
                            <SelectItem value="June">June</SelectItem>
                            <SelectItem value="July">July</SelectItem>
                            <SelectItem value="August">August</SelectItem>
                            <SelectItem value="September">September</SelectItem>
                            <SelectItem value="October">October</SelectItem>
                            <SelectItem value="November">November</SelectItem>
                            <SelectItem value="December">December</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editPaymentForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="2024"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editPaymentForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending (Not Paid)</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editPaymentForm.watch("status") === "paid" && (
                <FormField
                  control={editPaymentForm.control}
                  name="paid_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  disabled={updatePaymentMutation.isPending}
                >
                  {updatePaymentMutation.isPending ? "Updating..." : "Update Payment"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Payments = () => {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
};

export default Payments;
