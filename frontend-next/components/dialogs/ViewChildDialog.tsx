"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { Loader2, Shirt } from "lucide-react";

interface ViewChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string | null;
}

export const ViewChildDialog = ({ open, onOpenChange, childId }: ViewChildDialogProps) => {
  const { data: child, isLoading } = useQuery({
    queryKey: ["child", childId],
    queryFn: () => childId ? apiClient.getChild(childId) : null,
    enabled: open && !!childId,
  });

  if (!open || !childId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Child Details</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : child ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl gradient-primary flex items-center justify-center text-2xl font-heading font-bold text-primary-foreground">
                {child.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-heading font-bold">{child.name}</h3>
                <p className="text-muted-foreground">
                  DOB: {new Date(child.date_of_birth).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {new Date(child.date_of_birth).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Join Date</p>
                <p className="font-medium">
                  {new Date(child.join_date).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Level</p>
                <Badge variant={child.level} className="mt-1">
                  {child.level}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Kit Status</p>
                <Badge
                  variant={child.has_kit ? "success" : "secondary"}
                  className="mt-1"
                >
                  <Shirt className="w-3 h-3 mr-1" />
                  {child.has_kit ? "Has Kit" : "No Kit"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={child.is_active ? "default" : "outline"}
                  className="mt-1"
                >
                  {child.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Child not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
