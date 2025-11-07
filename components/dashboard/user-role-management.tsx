import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  Users,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase"

// Updated interface to match your database schema exactly
interface UserRole {
  id: string;
  user_id: string;
  role: "manager" | "employee" | "viewer";
  permissions: {
    timesheet_tracker: boolean;
    task_tracker: boolean;
    leave_tracker: boolean;
    skill_tracker: boolean;
    user_role_management: boolean;
    settings: boolean;
  };
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Optional fields that might come from joins
  email?: string;
  username?: string;
  employee_id?: string;
}

interface Profile {
  id: string;
  username: string;
  email: string;
  employee_id: string;
}

interface NewUserForm {
  role: "manager" | "employee" | "viewer";
  permissions: {
    timesheet_tracker: boolean;
    task_tracker: boolean;
    leave_tracker: boolean;
    skill_tracker: boolean; 
    user_role_management: boolean;
    settings: boolean;
  };
}

const defaultPermissions = {
  timesheet_tracker: false,
  task_tracker: false,
  leave_tracker: false,
  skill_tracker: false, 
  user_role_management: false,
  settings: false,
};

const rolePermissionTemplates = {
  manager: {
    timesheet_tracker: true,
    task_tracker: true,
    leave_tracker: true,
    skill_tracker: true, 
    user_role_management: true,
    settings: true,
  },
  employee: {
    timesheet_tracker: true,
    task_tracker: true,
    leave_tracker: false,
    skill_tracker: true, 
    user_role_management: false,
    settings: false,
  },
  viewer: {
    timesheet_tracker: true,
    task_tracker: true,
    leave_tracker: false,
    skill_tracker: false, 
    user_role_management: false,
    settings: false,
  },
};

export default function UserRoleManagementTab() {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRole | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    role: "employee",
    permissions: { ...defaultPermissions },
  });
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"default" | "destructive">(
    "default"
  );
  
  // Authentication state
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Custom toast/notification function
  const showToast = (
    description: string,
    variant: "default" | "destructive" = "default"
  ) => {
    setToastVariant(variant);
    setToastMessage(description);
    setTimeout(() => setToastMessage(""), 5000);
  };

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthLoading(true);
        
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          setSession(null);
          setCurrentUser(null);
          return;
        }

        setSession(session);
        
        if (session?.user) {
          setCurrentUser(session.user);
          console.log("User authenticated:", session.user.email);
        } else {
          console.log("No authenticated user");
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setSession(null);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);
        setSession(session);
        setCurrentUser(session?.user || null);
        
        if (event === 'SIGNED_OUT') {
          setUsers([]);
          setAvailableUsers([]);
        } else if (event === 'SIGNED_IN' && session) {
          // Reload users when user signs in
          loadUsers();
          loadAvailableUsers();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredUsers = users.filter((user) => {
    const searchText = searchTerm.toLowerCase();
    const matchesSearch =
      (user.username?.toLowerCase().includes(searchText) || false) ||
      (user.email?.toLowerCase().includes(searchText) || false) ||
      (user.employee_id?.toLowerCase().includes(searchText) || false) ||
      user.user_id.toLowerCase().includes(searchText) ||
      user.id.toLowerCase().includes(searchText);
    const matchesRole = filterRole === "all" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  // Load available users from profiles table
  const loadAvailableUsers = async () => {
    if (!session) {
      console.log("No session, skipping available users load");
      return;
    }

    try {
      console.log("Loading available users from profiles...");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("username");

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      setAvailableUsers(data || []);
      console.log("Available users loaded:", data);
    } catch (error) {
      console.error("Error loading available users:", error);
      showToast(`Failed to load available users: ${error instanceof Error ? error.message : "Unknown error"}`, "destructive");
    }
  };

  // Enhanced loadUsers function with better error handling and authentication
  const loadUsers = async () => {
    // Don't try to load if no session
    if (!session) {
      console.log("No session, skipping user load");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("Loading users from Supabase...");

      // Updated query to correctly join the 'profiles' table
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          *,
          profiles (
            email,
            username,
            employee_id
          )
        `);

      console.log("Supabase response:", { data, error });

      if (error) {
        console.error("Supabase error:", error);
        
        // Handle specific authentication errors
        if (error.code === 'PGRST301' || error.message.includes('JWT')) {
          showToast("Session expired. Please sign in again.", "destructive");
          await supabase.auth.signOut();
          return;
        }
        
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        console.warn("No data returned from Supabase");
        setUsers([]);
        showToast("No user roles found in database.", "default");
        return;
      }
      
      console.log("Raw data from database:", data);
      
      // Ensure data processing accesses the nested 'profiles' object
      const processedUsers = data.map((user: any) => ({
        id: user.id,
        user_id: user.user_id,
        role: user.role,
        permissions: user.permissions || defaultPermissions,
        is_active: user.is_active !== false,
        created_at: user.created_at,
        updated_at: user.updated_at,
        // The profiles table data is nested here
        email: user.profiles?.email,
        username: user.profiles?.username,
        employee_id: user.profiles?.employee_id,
      }));

      console.log("Processed users:", processedUsers);
      setUsers(processedUsers);
      showToast(`Successfully loaded ${processedUsers.length} users.`);
    } catch (error) {
      console.error("Error loading users:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      showToast(`Failed to fetch user roles: ${errorMessage}`, "destructive");
      
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (role: "manager" | "employee" | "viewer") => {
    setNewUserForm((prev) => ({
      ...prev,
      role,
      permissions: { ...rolePermissionTemplates[role] },
    }));
  };

  const handlePermissionChange = (
    permission: keyof typeof defaultPermissions,
    checked: boolean
  ) => {
    setNewUserForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked,
      },
    }));
  };

  const handleEditPermissionChange = (
    permission: keyof typeof defaultPermissions,
    checked: boolean
  ) => {
    if (editingUser) {
      setEditingUser((prev) =>
        prev
          ? {
              ...prev,
              permissions: {
                ...prev.permissions,
                [permission]: checked,
              },
            }
          : null
      );
    }
  };

  const assignRoleToUser = async () => {
    if (!session) {
      showToast("You must be signed in to assign roles.", "destructive");
      return;
    }

    if (!selectedUserId) {
      showToast("Please select a user to assign a role to.", "destructive");
      return;
    }

    try {
      setSaving(true);
      
      // Check if user already has a role assigned
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', selectedUserId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw new Error(`Error checking existing role: ${checkError.message}`);
      }

      if (existingRole) {
        showToast("This user already has a role assigned. Please edit their existing role instead.", "destructive");
        setSaving(false);
        return;
      }
      
      // Create the user role for the selected user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUserId,
          role: newUserForm.role,
          permissions: newUserForm.permissions,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (roleError) {
        throw new Error(`Failed to assign role: ${roleError.message}`);
      }

      const selectedUser = availableUsers.find(u => u.id === selectedUserId);
      showToast(`Role assigned to ${selectedUser?.username} successfully.`);
      
      // Reset form
      setNewUserForm({
        role: "employee",
        permissions: { ...rolePermissionTemplates.employee },
      });
      setSelectedUserId("");
      setIsAssignDialogOpen(false);
      
      // Reload the data from the database to ensure the UI is in sync
      await loadUsers(); 

    } catch (error) {
      console.error("Error assigning role:", error);
      showToast(`Error: ${error instanceof Error ? error.message : "An unexpected error occurred."}`, "destructive");
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async () => {
    if (!editingUser || !session) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from("user_roles")
        .update({
          role: editingUser.role,
          permissions: editingUser.permissions,
          is_active: editingUser.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingUser.id)
        .select();

      if (error) {
        throw new Error(error.message);
      }

      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === editingUser.id ? { ...user, ...data[0] } : user
        )
      );

      showToast(`${editingUser.username}'s details have been updated.`);
      setIsEditDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user:", error);
      showToast(`Error: ${error instanceof Error ? error.message : "An unexpected error occurred."}`, "destructive");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!session) {
      showToast("You must be signed in to update users.", "destructive");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("user_roles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) {
        throw new Error(error.message);
      }
      
      // Reload all users to reflect the change
      await loadUsers();
      showToast(`User has been ${!currentStatus ? "activated" : "deactivated"}.`);
    } catch (error) {
      console.error("Error updating user status:", error);
      showToast(`Failed to update status. ${error instanceof Error ? error.message : ""}`, "destructive");
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async () => {
    if (!deletingUser || !session) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", deletingUser.id);

      if (error) {
        throw new Error(error.message);
      }

      setUsers(users.filter((user) => user.id !== deletingUser.id));
      showToast(`${deletingUser.username}'s role has been successfully removed.`);
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      showToast(`Error: ${error instanceof Error ? error.message : "An unexpected error occurred."}`, "destructive");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (user: UserRole) => {
    setEditingUser({ ...user });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: UserRole) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "manager":
        return "border-red-500 text-red-500";
      case "employee":
        return "border-orange-500 text-orange-500";
      case "viewer":
        return "border-gray-500 text-gray-600";
      default:
        return "border-gray-500 text-gray-600";
    }
  };

  const getPermissionCount = (permissions: typeof defaultPermissions) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  // Get users without roles assigned
  const getUsersWithoutRoles = () => {
    const assignedUserIds = users.map(u => u.user_id);
    return availableUsers.filter(user => !assignedUserIds.includes(user.id));
  };

  // Load users when session is available
  useEffect(() => {
    if (!authLoading && session) {
      loadUsers();
      loadAvailableUsers();
    } else if (!authLoading && !session) {
      setLoading(false);
      setUsers([]);
      setAvailableUsers([]);
    }
  }, [session, authLoading]);

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="p-6 space-y-6 bg-gray-900 text-white rounded-lg min-h-screen">
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-400">Checking authentication...</span>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!session || !currentUser) {
    return (
      <div className="p-6 space-y-6 bg-gray-900 text-white rounded-lg min-h-screen">
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <Shield className="h-16 w-16 text-gray-500" />
          <h2 className="text-2xl font-bold text-white">Authentication Required</h2>
          <p className="text-gray-400 text-center max-w-md">
            You need to be signed in to access the user role management system. 
            Please sign in with your account to continue.
          </p>
          <Button
            onClick={() => window.location.href = '/auth'}
            className="bg-red-600 hover:bg-red-700 text-white rounded-md px-6 py-2 transition-colors duration-200"
          >
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6 bg-gray-800 text-white rounded-lg min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
        <div>
          <CardTitle className="text-white">
            User Role Management
          </CardTitle>
        </div>
        <Button
          onClick={() => setIsAssignDialogOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white rounded-md px-6 py-2 transition-colors duration-200"
          disabled={getUsersWithoutRoles().length === 0}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Assign Role ({getUsersWithoutRoles().length} available)
        </Button>
      </div>


      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="search" className="text-white">
            Search Users
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              placeholder="Search by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-gray-950 text-white"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="role-filter" className="text-white">
            Filter by Role
          </Label>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="bg-gray-950 text-white">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent className="bg-gray-950 text-white">
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="manager">Managers</SelectItem>
              <SelectItem value="employee">Employees</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-white rounded-md">
        <CardHeader>
          <CardTitle className="text-black">User Permissions</CardTitle>
          <CardDescription className="text-gray-800">
            Showing {filteredUsers.length} of {users.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="overflow-auto max-h-96 border border-gray-300 rounded-lg">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="bg-gray-200">
                    <TableHead className="text-black w-[250px]">
                      User
                    </TableHead>
                    <TableHead className="text-black w-[120px]">
                      Role
                    </TableHead>
                    <TableHead className="text-black hidden sm:table-cell">
                      Permissions
                    </TableHead>
                    <TableHead className="text-black w-[100px]">
                      Status
                    </TableHead>
                    <TableHead className="text-black text-right w-[150px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="border-gray-700">
                        <TableCell className="text-black">
                          <div>
                            <div className="font-medium text-black">
                              {user.username}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                            <div className="text-xs text-gray-400">
                              ID: {user.employee_id}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getRoleBadgeColor(user.role)}
                          >
                            {user.role.charAt(0).toUpperCase() +
                              user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {user.permissions.timesheet_tracker && (
                              <Badge
                                variant="outline"
                                className="border-gray-800 text-gray-800 text-xs"
                              >
                                Timesheet
                              </Badge>
                            )}
                            {user.permissions.task_tracker && (
                              <Badge
                                variant="outline"
                                className="text-gray-800 border-gray-800 text-xs"
                              >
                                Tasks
                              </Badge>
                            )}
                            {user.permissions.leave_tracker && (
                              <Badge
                                variant="outline"
                                className="border-gray-800 text-gray-800 text-xs"
                              >
                                Leave
                              </Badge>
                            )}
                            {user.permissions.skill_tracker && (
                              <Badge
                                variant="outline"
                                className="border-gray-800 text-gray-800 text-xs"
                              >
                                Skills
                              </Badge>
                            )}
                            {user.permissions.user_role_management && (
                              <Badge
                                variant="outline"
                                className="border-gray-800 text-gray-800 text-xs"
                              >
                                User Management
                              </Badge>
                            )}
                            {user.permissions.settings && (
                              <Badge
                                variant="outline"
                                className="border-gray-800 text-gray-800 text-xs"
                              >
                                Settings
                              </Badge>
                            )}
                            <Badge
                              className="text-gray-800 bg-gray-200 text-xs"
                            >
                              +{getPermissionCount(user.permissions)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              user.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleUserStatus(user.id, user.is_active)
                              }
                              className={
                                user.is_active
                                  ? "text-red-500 hover:text-red-400"
                                  : "text-green-500 hover:text-green-400"
                              }
                            >
                              <Shield className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400"
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-gray-400 py-8"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Role Dialog - Updated to use dropdown */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="bg-gray-950 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Role to User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select an existing user from the profiles and assign them a role and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="select-user" className="text-white">
                Select User *
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-black text-white border-gray-700">
                  <SelectValue placeholder="Choose a user to assign a role..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 max-h-60">
                  {getUsersWithoutRoles().length > 0 ? (
                    getUsersWithoutRoles().map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-users" disabled>
                      No users available (all users already have roles assigned)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {getUsersWithoutRoles().length === 0 && (
                <p className="text-sm text-yellow-400 mt-2">
                  All users from the profiles table already have roles assigned.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="assign-role" className="text-white">
                Role
              </Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value: "manager" | "employee" | "viewer") =>
                  handleRoleChange(value)
                }
              >
                <SelectTrigger className="bg-black text-white border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700">
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white">Permissions</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                {Object.entries(defaultPermissions).map(([permission, _]) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={`assign-${permission}`}
                      checked={
                        newUserForm.permissions[
                          permission as keyof typeof defaultPermissions
                        ]
                      }
                      onCheckedChange={(checked) =>
                        handlePermissionChange(
                          permission as keyof typeof defaultPermissions,
                          checked as boolean
                        )
                      }
                    />
                    <Label htmlFor={`assign-${permission}`} className="text-white text-sm">
                      {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {selectedUserId && (
              <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
                <h4 className="text-white font-medium mb-2">Selected User Details:</h4>
                {(() => {
                  const selectedUser = availableUsers.find(u => u.id === selectedUserId);
                  return selectedUser ? (
                    <div className="text-sm space-y-1">
                      <p className="text-gray-300"><span className="text-white">Name:</span> {selectedUser.username}</p>
                      <p className="text-gray-300"><span className="text-white">Email:</span> {selectedUser.email}</p>
                      <p className="text-gray-300"><span className="text-white">Employee ID:</span> {selectedUser.employee_id}</p>
                      <p className="text-gray-300"><span className="text-white">Role to be assigned:</span> {newUserForm.role}</p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDialogOpen(false);
                setSelectedUserId("");
                setNewUserForm({
                  role: "employee",
                  permissions: { ...rolePermissionTemplates.employee },
                });
              }}
              className="bg-transparent border-gray-700 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={assignRoleToUser}
              disabled={saving || !selectedUserId || getUsersWithoutRoles().length === 0}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning Role...
                </>
              ) : (
                "Assign Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-gray-950 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the role and permissions for {editingUser?.username}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-role" className="text-white">
                  Role
                </Label>
                <Select
                  value={editingUser?.role || ""}
                  onValueChange={(value: "manager" | "employee" | "viewer") =>
                    setEditingUser(prev => prev ? { ...prev, role: value } : null)
                  }
                >
                  <SelectTrigger className="bg-black text-white border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700">
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-white">Permissions</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {Object.entries(defaultPermissions).map(([permission, _]) => (
                  <div key={permission} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${permission}`}
                      checked={
                        editingUser?.permissions[
                          permission as keyof typeof defaultPermissions
                        ] || false
                      }
                      onCheckedChange={(checked) =>
                        handleEditPermissionChange(
                          permission as keyof typeof defaultPermissions,
                          checked as boolean
                        )
                      }
                    />
                    <Label htmlFor={`edit-${permission}`} className="text-white text-sm">
                      {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="bg-transparent border-gray-700 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={updateUser}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-gray-950 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Remove User Role</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to remove the role assignment for {deletingUser?.username}? This will remove their access to the system but won't delete their profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="bg-transparent border-gray-700 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={deleteUser}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}