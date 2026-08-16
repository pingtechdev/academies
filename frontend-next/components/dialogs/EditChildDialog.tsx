"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import * as z from "zod";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  level: z.string().min(1, "Level is required"),
  hasKit: z.boolean(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface EditChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string | null;
  onSuccess?: () => void;
}

export const EditChildDialog = ({ open, onOpenChange, childId, onSuccess }: EditChildDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch levels
  const { data: levels = [] } = useQuery({
    queryKey: ["levels"],
    queryFn: () => apiClient.getLevels(),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dateOfBirth: "",
      level: "",
      hasKit: false,
      isActive: true,
    },
  });

  // Fetch child data when dialog opens
  useEffect(() => {
    if (open && childId) {
      apiClient.getChild(childId).then((child) => {
        form.reset({
          name: child.name,
          dateOfBirth: child.date_of_birth,
          level: child.level,
          hasKit: child.has_kit || false,
          isActive: child.is_active !== undefined ? child.is_active : true,
        });
      }).catch((error) => {
        toast({
          title: "Error",
          description: error.message || "Failed to load child data",
          variant: "destructive",
        });
      });
    }
  }, [open, childId, form, toast]);

  // Update child mutation
  const updateChildMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!childId) throw new Error("Child ID is required");
      return apiClient.updateChild(childId, {
        name: data.name,
        date_of_birth: data.dateOfBirth,
        level: data.level,
        has_kit: data.hasKit,
        is_active: data.isActive,
      });
    },
    onSuccess: () => {
      toast({
        title: "Child Updated",
        description: "Child has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["children"] });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update child",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: FormData) => {
    updateChildMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Child</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter child's name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="date"
                        {...field}
                        className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                      />
                      <Calendar
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground/70 pointer-events-none z-10"
                        aria-hidden="true"
                        strokeWidth={2}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {levels.map((level: any) => (
                        <SelectItem key={level.id} value={level.name}>
                          {level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hasKit"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Has Kit</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Check if the child has received their kit
                    </div>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-5 w-5 rounded border-gray-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Toggle to mark child as active or inactive
                    </div>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-5 w-5 rounded border-gray-300"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="hero" disabled={updateChildMutation.isPending}>
                {updateChildMutation.isPending ? "Updating..." : "Update Child"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
