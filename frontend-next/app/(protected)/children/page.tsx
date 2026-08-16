"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api";
import {
  Search,
  Plus,
  MoreVertical,
  Calendar,
  Shirt,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  CreditCard,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddChildDialog } from "@/components/dialogs/AddChildDialog";
import { EditChildDialog } from "@/components/dialogs/EditChildDialog";
import { ViewChildDialog } from "@/components/dialogs/ViewChildDialog";
import { useToast } from "@/hooks/use-toast";

const Children = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch children
  const { data: children = [], isLoading: childrenLoading, refetch: refetchChildren } = useQuery({
    queryKey: ["children", { level: levelFilter !== "all" ? levelFilter : undefined, search: searchQuery || undefined }],
    queryFn: () => apiClient.getChildren({
      level: levelFilter !== "all" ? levelFilter : undefined,
      search: searchQuery || undefined,
    }),
  });

  const filteredChildren = children.filter((child: any) => {
    const matchesSearch = child.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === "all" || child.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const handleSuccess = () => {
    // Invalidate and refetch to ensure new child appears
    queryClient.invalidateQueries({ queryKey: ["children"] });
    refetchChildren();
  };

  // Delete child mutation
  const deleteChildMutation = useMutation({
    mutationFn: async (childId: string) => {
      return apiClient.deleteChild(childId);
    },
    onSuccess: () => {
      toast({
        title: "Child Deleted",
        description: "Child has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["children"] });
      setShowDeleteDialog(false);
      setSelectedChildId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete child",
        variant: "destructive",
      });
    },
  });

  const handleView = (childId: string) => {
    setSelectedChildId(childId);
    setShowViewDialog(true);
  };

  const handleEdit = (childId: string) => {
    setSelectedChildId(childId);
    setShowEditDialog(true);
  };

  const handleDelete = (childId: string) => {
    setSelectedChildId(childId);
    setShowDeleteDialog(true);
  };

  const handleViewPayments = (childId: string) => {
    router.push(`/payments?child_id=${childId}`);
  };

  const confirmDelete = () => {
    if (selectedChildId) {
      deleteChildMutation.mutate(selectedChildId);
    }
  };

  if (childrenLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <AddChildDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={handleSuccess} />
      <EditChildDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        childId={selectedChildId}
        onSuccess={handleSuccess}
      />
      <ViewChildDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        childId={selectedChildId}
      />
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the child record
              and all associated payment records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteChildMutation.isPending}
            >
              {deleteChildMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">Children</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage all registered players at the academy.
          </p>
        </div>
        <Button variant="hero" onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Child
        </Button>
      </div>

      {/* Filters */}
      <Card variant="elevated">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredChildren.length} of {children.length} players
      </p>

      {/* Children Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChildren.map((child: any) => {
          return (
            <Card key={child.id} variant="interactive" className="group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-lg font-heading font-bold text-primary-foreground">
                      {child.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{child.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(child.date_of_birth).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleView(child.id)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(child.id)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleViewPayments(child.id)}>
                        <CreditCard className="w-4 h-4 mr-2" />
                        View Payments
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(child.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={child.level}>{child.level}</Badge>
                    <Badge
                      variant={child.has_kit ? "success" : "secondary"}
                    >
                      <Shirt className="w-3 h-3 mr-1" />
                      {child.has_kit ? "Has Kit" : "No Kit"}
                    </Badge>
                    <Badge
                      variant={child.is_active ? "default" : "outline"}
                    >
                      {child.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="pt-3 border-t border-border space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Joined {new Date(child.join_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredChildren.length === 0 && (
        <Card variant="elevated" className="p-12 text-center">
          <p className="text-muted-foreground">No children found matching your criteria.</p>
        </Card>
      )}
    </div>
  );
};

export default Children;
