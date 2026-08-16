"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users, GraduationCap, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const levelFormSchema = z.object({
  name: z.string().min(1, "Level name is required"),
  description: z.string().optional(),
});

const userFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role_id: z.string().min(1, "Role is required"),
});

type LevelFormData = z.infer<typeof levelFormSchema>;
type UserFormData = z.infer<typeof userFormSchema>;

const Settings = () => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManageLevels = hasPermission("levels:manage");
  const canManageUsers = hasPermission("users:manage");
  const canManageRoles = hasPermission("roles:manage");
  const queryClient = useQueryClient();
  const [showLevelDialog, setShowLevelDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showDeleteLevelDialog, setShowDeleteLevelDialog] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  // Fetch levels
  const { data: levels = [], isLoading: levelsLoading } = useQuery({
    queryKey: ["levels"],
    queryFn: () => apiClient.getLevels(),
  });

  // Fetch users (requires users:manage -- skip the request entirely otherwise)
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.getUsers(),
    enabled: canManageUsers,
  });

  // Fetch roles, for assigning a role when adding a user (requires roles:manage)
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => apiClient.getRoles(),
    enabled: canManageUsers && canManageRoles,
  });

  // Level form
  const levelForm = useForm<LevelFormData>({
    resolver: zodResolver(levelFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // User form
  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      role_id: "",
    },
  });

  // Create level mutation
  const createLevelMutation = useMutation({
    mutationFn: async (data: LevelFormData) => {
      return apiClient.createLevel({
        name: data.name,
        description: data.description || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Level Added",
        description: "Level has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["levels"] });
      levelForm.reset();
      setShowLevelDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add level",
        variant: "destructive",
      });
    },
  });

  // Delete level mutation
  const deleteLevelMutation = useMutation({
    mutationFn: async (levelId: string) => {
      return apiClient.deleteLevel(levelId);
    },
    onSuccess: () => {
      toast({
        title: "Level Deleted",
        description: "Level has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["levels"] });
      setShowDeleteLevelDialog(false);
      setSelectedLevelId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete level",
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiClient.createUser({
        name: data.name,
        username: data.username,
        password: data.password,
        role_ids: [data.role_id],
      });
    },
    onSuccess: () => {
      toast({
        title: "User Added",
        description: "User has been added successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      userForm.reset();
      setShowUserDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add user",
        variant: "destructive",
      });
    },
  });

  const handleDeleteLevel = (levelId: string) => {
    setSelectedLevelId(levelId);
    setShowDeleteLevelDialog(true);
  };

  const confirmDeleteLevel = () => {
    if (selectedLevelId) {
      deleteLevelMutation.mutate(selectedLevelId);
    }
  };

  const onLevelSubmit = (data: LevelFormData) => {
    createLevelMutation.mutate(data);
  };

  const onUserSubmit = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Manage levels and users for the academy.
        </p>
      </div>

      {/* Levels Section */}
      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Levels
              </CardTitle>
              <CardDescription className="hidden sm:block">
                Manage skill levels for children. These levels will appear in the child registration form.
              </CardDescription>
            </div>
            {canManageLevels && (
              <Button variant="hero" onClick={() => setShowLevelDialog(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Level
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {levelsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-3 sm:px-0">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  {canManageLevels && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No levels found. Add your first level to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  levels.map((level: any) => (
                    <TableRow key={level.id}>
                      <TableCell className="font-medium">{level.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {level.description || "-"}
                      </TableCell>
                      {canManageLevels && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteLevel(level.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Section */}
      {canManageUsers && (
      <Card variant="elevated">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users
              </CardTitle>
              <CardDescription className="hidden sm:block">
                Manage users who can access the system.
              </CardDescription>
            </div>
            {canManageRoles && (
              <Button variant="hero" onClick={() => setShowUserDialog(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-3 sm:px-0">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>
                        {(user.roles ?? []).map((role: any) => role.name).join(", ") || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Add Level Dialog */}
      <Dialog open={showLevelDialog} onOpenChange={setShowLevelDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Level</DialogTitle>
          </DialogHeader>
          <Form {...levelForm}>
            <form onSubmit={levelForm.handleSubmit(onLevelSubmit)} className="space-y-4">
              <FormField
                control={levelForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Beginner, Intermediate, Advanced" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={levelForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of this level" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowLevelDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={createLevelMutation.isPending}>
                  {createLevelMutation.isPending ? "Adding..." : "Add Level"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter user's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="role_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="hero" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Adding..." : "Add User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Level Confirmation */}
      <AlertDialog open={showDeleteLevelDialog} onOpenChange={setShowDeleteLevelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the level.
              If any children are using this level, the deletion will fail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLevel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLevelMutation.isPending}
            >
              {deleteLevelMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
