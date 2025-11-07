'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

// Define the types for your user profile and permissions
interface UserPermissions {
  timesheet_tracker: boolean;
  task_tracker: boolean;
  leave_tracker: boolean;
  skill_tracker: boolean;
  user_role_management: boolean;
  settings: boolean;
}

interface UserProfile {
  id: string;
  user_id: string;
  role: "manager" | "employee" | "viewer";
  permissions: UserPermissions;
  email?: string;
  username?: string;
  employee_id?: string;
  is_active: boolean;
}

// Define the state of the authentication
type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextType {
  authState: AuthState;
  userProfile: UserProfile | null;
  error: string | null;
  handleSignOut: () => Promise<void>; // Add the new sign-out function
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider to wrap your application
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async (session: Session | null) => {
    if (!session) {
      console.log("No active session found. Setting authState to 'unauthenticated'.");
      setUserProfile(null);
      setAuthState('unauthenticated');
      return;
    }

    try {
      // First, fetch the user from Supabase auth to get basic info
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Auth user not found:", authError?.message);
        throw new Error(authError?.message || "User not found in auth session.");
      }
      console.log("Supabase authenticated user:", user);

      // Then, fetch user role and permissions from your custom 'user_roles' table
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select(`*, profiles (email, username, employee_id)`)
        .eq("user_id", user.id)
        .single();

      if (roleError || !userRole) {
        console.error("Failed to fetch user role:", roleError?.message);
        throw new Error(roleError?.message || "Failed to fetch user role.");
      }
      console.log("Fetched user role and profile:", userRole);

      // Process and normalize the permissions
      const processedPermissions: UserPermissions = {
        timesheet_tracker: Boolean(userRole.permissions?.timesheet_tracker),
        task_tracker: Boolean(userRole.permissions?.task_tracker),
        leave_tracker: Boolean(userRole.permissions?.leave_tracker),
        skill_tracker: Boolean(userRole.permissions?.skill_tracker),
        user_role_management: Boolean(userRole.permissions?.user_role_management),
        settings: Boolean(userRole.permissions?.settings),
      };

      const profile: UserProfile = {
        id: userRole.id,
        user_id: userRole.user_id,
        role: userRole.role,
        permissions: processedPermissions,
        email: userRole.profiles?.email || user.email,
        username: userRole.profiles?.username || user.user_metadata?.username || "Unknown User",
        employee_id: userRole.profiles?.employee_id || "N/A",
        is_active: userRole.is_active !== false,
      };

      setUserProfile(profile);
      setAuthState('authenticated');
      setError(null);
      console.log("Authentication successful! User profile:", profile);
    } catch (err: any) {
      console.error("Error fetching user profile:", err);
      setError(err.message || "An unexpected error occurred.");
      setAuthState('error');
      setUserProfile(null);
    }
  };

  // Add the sign-out function
  const handleSignOut = async () => {
    try {
      setAuthState('loading');
      await supabase.auth.signOut();
      setUserProfile(null);
      setAuthState('unauthenticated');
      console.log('Successfully signed out.');
    } catch (err: any) {
      console.error('Sign out error:', err);
      setError(err.message || 'Failed to sign out.');
      setAuthState('error');
    }
  };

  useEffect(() => {
    // Initial load check
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session);
    });

    // Listen for future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserProfile(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ authState, userProfile, error, handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context in components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};