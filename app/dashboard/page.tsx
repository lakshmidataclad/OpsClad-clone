'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, User, Shield, Eye, Loader2, LogIn, AlertTriangle, Settings } from 'lucide-react';

// Use this new hook to manage authentication state
import { useAuth } from '@/hooks/use-auth';
import { useToast } from "@/hooks/use-toast";

// Your actual components - make sure these paths are correct
import SettingsTab from "@/components/dashboard/settings-tab";
import ExtractionTab from "@/components/dashboard/extraction-tab";
import ReportsTab from "@/components/dashboard/reports-tab";
import TaskOverviewTab from "@/components/dashboard/task-overview-tab";
import TaskReportsTab from "@/components/dashboard/task-reports-tab";
import PTOTrackingTab from "@/components/dashboard/pto-tracking-tab";
import ReminderEmailTab from "@/components/dashboard/reminder-email-tab";
import ManagerSkillTracker from '@/components/dashboard/skill-tracking-tab';
import UserRoleManagementTab from "@/components/dashboard/user-role-management";
import EmployeeReportsTab from '@/components/dashboard/employee-time-reports';
import EmployeeTaskView from '@/components/dashboard/employee-task-view';
import EmployeePTOTab from '@/components/dashboard/employee-pto-view';
import EmployeeSkillTracker from '@/components/dashboard/employee-skill-view';
import HomePage from '@/components/dashboard/home';

export default function DashboardPage() {
    const router = useRouter();
    const { userProfile: currentUser, authState, error } = useAuth();
    const { toast } = useToast();

    const [activeDashboard, setActiveDashboard] = useState("");
    const [activeTimesheetTab, setActiveTimesheetTab] = useState("reminders"); // Updated default tab for timesheet
    const [activeTaskTab, setActiveTaskTab] = useState("overview");
    const [activePTOTab, setActivePTOTab] = useState("pto-tracking");
    const [activeSkillTab, setActiveSkillTab] = useState("skill-tracker");
    const [activeHomeTab, setActiveHomeTab] = useState("home");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Set initial dashboard based on permissions once user is loaded
    useEffect(() => {
        if (authState === 'authenticated' && currentUser) {
            console.log("Authenticated user detected:", currentUser.permissions);
            setActiveDashboard("home");
            // Set the default timesheet tab for managers vs employees
        


            if (currentUser.permissions.timesheet_tracker) {
                if (currentUser.role === 'manager') {
                    setActiveTimesheetTab("reminders");
                } else {
                    setActiveTimesheetTab("employee-reports");
                }
                //setActiveDashboard("timesheet-tracker");
            } else if (currentUser.permissions.task_tracker) {
                setActiveDashboard("task-tracker");
            } else if (currentUser.permissions.leave_tracker) {
                setActiveDashboard("pto-tracking");
            } else if (currentUser.permissions.user_role_management) {
                setActiveDashboard("user-role-management");
            } else if (currentUser.permissions.settings) { // New condition for settings
                setActiveDashboard("settings");
            } else if (currentUser.permissions.skill_tracker){
                setActiveDashboard("skill-tracker")
            } else {
                setActiveDashboard("home");
            }
        }
    }, [authState, currentUser]);

    const handleLogin = () => {
        router.push('/');
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "manager":
                return <Shield className="w-4 h-4" />;
            case "employee":
                return <User className="w-4 h-4" />;
            case "viewer":
                return <Eye className="w-4 h-4" />;
            default:
                return <User className="w-4 h-4" />;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case "manager":
                return "border-red-500 text-red-400 bg-red-900/20";
            case "employee":
                return "border-blue-500 text-blue-400 bg-blue-900/20";
            case "viewer":
                return "border-gray-500 text-gray-400 bg-gray-900/20";
            default:
                return "border-gray-500 text-gray-400 bg-gray-900/20";
        }
    };

    const hasAccess = (dashboard: string) => {
        if (!currentUser || !currentUser.permissions) return false;
        switch (dashboard) {
            case "timesheet-tracker":
                return currentUser.permissions.timesheet_tracker;
            case "task-tracker":
                return currentUser.permissions.task_tracker;
            case "pto-tracking":
                return currentUser.permissions.leave_tracker;
            case "user-role-management":
                return currentUser.permissions.user_role_management;
            case "settings": // New access check
                return currentUser.permissions.settings;
            case "skill-tracker":
                return currentUser.permissions.skill_tracker;
            default:
                return false;
        }
    };

    const hasTimesheetTabAccess = (tab: string) => {
        if (!currentUser || !currentUser.permissions) return false;
        // All Timesheet tabs, except employee-reports, are for managers only
        if (currentUser.role === "manager") {
            return currentUser.permissions.timesheet_tracker;
        } 
        // The employee-reports tab is only for employees
        else if (currentUser.role === "employee") {
            return tab === "employee-reports" && currentUser.permissions.timesheet_tracker;
        }
        return false;
    };

    const hasTaskTabAccess = (tab: string) => {
        if (!currentUser || !currentUser.permissions) return false;
        if (currentUser.role === "manager") {
            switch (tab) {
                case "overview":
                    return currentUser.permissions.task_tracker;
                case "reports":
                    return currentUser.permissions.task_tracker && (currentUser.role === "manager");
                default:
                    return false;
            }
        }
        else if (currentUser.role === "employee") {
            return tab === "employee-tasks" && currentUser.permissions.task_tracker;
        }
        return false;
    };

    const hasPTOTabAccess = (tab: string) => {
        if (!currentUser || !currentUser.permissions) return false;
        // All Timesheet tabs, except employee-reports, are for managers only
        if (currentUser.role === "manager") {
            return currentUser.permissions.leave_tracker;
        } 
        // The employee-reports tab is only for employees
        else if (currentUser.role === "employee") {
            return tab === "employee-pto" && currentUser.permissions.leave_tracker;
        }
        return false;
    };

    const hasSkillTabAccess = (tab: string) => {
        if (!currentUser || !currentUser.permissions) return false;
        // All Timesheet tabs, except employee-reports, are for managers only
        if (currentUser.role === "manager") {
            return currentUser.permissions.skill_tracker;
        } 
        // The employee-reports tab is only for employees
        else if (currentUser.role === "employee") {
            return tab === "employee-skills" && currentUser.permissions.skill_tracker;
        }
        return false;
    };

    // Loading state
    if (authState === 'loading') {
        return (
            <div className="flex min-h-screen bg-gray-900 items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                    <div className="text-white text-lg">Loading your dashboard...</div>
                    <div className="text-gray-400 text-sm">Checking authentication...</div>
                </div>
            </div>
        );
    }

    // Unauthenticated state
    if (authState === 'unauthenticated') {
        return (
            <div className="flex min-h-screen bg-gray-900 items-center justify-center">
                <Card className="bg-gray-800 border-gray-700 p-8 max-w-md w-full mx-4">
                    <div className="text-center space-y-4">
                        <LogIn className="h-12 w-12 text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-white">Authentication Required</h2>
                        <p className="text-gray-400">You need to be logged in to access the dashboard.</p>
                        <Button onClick={handleLogin} className="bg-red-600 hover:bg-red-700 text-white w-full">
                            Go to Login
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    // Error state
    if (authState === 'error' || !currentUser) {
        return (
            <div className="flex min-h-screen bg-gray-900 items-center justify-center">
                <Card className="bg-gray-800 border-gray-700 p-8 max-w-md w-full mx-4">
                    <div className="text-center space-y-4">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-white">Authentication Error</h2>
                        <p className="text-gray-400">{error || "Unable to load your user profile."}</p>
                        <div className="space-y-2">
                            <Button onClick={() => window.location.reload()} variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 w-full">
                                Retry
                            </Button>
                            <Button onClick={handleLogin} className="bg-red-600 hover:bg-red-700 text-white w-full">
                                Go to Login
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-900">
            {/* Side Navigation Bar */}
            <nav className={`bg-gray-900 text-white p-4 shadow-lg flex flex-col rounded-r-lg transition-all duration-300 ease-in-out ${isSidebarCollapsed ? "w-20" : "w-64"}`}>
                <div className="flex justify-end mb-4">
                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                </div>

                <ul className="space-y-4 flex-grow">
                    <li>
                        <button onClick={() => setActiveDashboard("home")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "home" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                            {!isSidebarCollapsed && <span className="truncate">Home</span>}
                        </button>
                    </li>
                    {hasAccess("timesheet-tracker") && (
                        <li>
                            <button onClick={() => setActiveDashboard("timesheet-tracker")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "timesheet-tracker" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                                {!isSidebarCollapsed && <span className="truncate">Timesheet Tracker</span>}
                            </button>
                        </li>
                    )}
                    {hasAccess("task-tracker") && (
                        <li>
                            <button onClick={() => setActiveDashboard("task-tracker")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "task-tracker" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                                {!isSidebarCollapsed && <span className="truncate">Task Tracker</span>}
                            </button>
                        </li>
                    )}
                    {hasAccess("pto-tracking") && (
                        <li>
                            <button onClick={() => setActiveDashboard("pto-tracking")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "pto-tracking" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                                {!isSidebarCollapsed && <span className="truncate">Leave Tracker</span>}
                            </button>
                        </li>
                    )}
                    {hasAccess("skill-tracker") && (
                        <li>
                            <button onClick={() => setActiveDashboard("skill-tracker")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "skill-tracker" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                                {!isSidebarCollapsed && <span className="truncate">Skill Tracker</span>}
                            </button>
                        </li>
                    )}
                    {hasAccess("user-role-management") && (
                        <li>
                            <button onClick={() => setActiveDashboard("user-role-management")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "user-role-management" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                                {!isSidebarCollapsed && <span className="truncate">User Management</span>}
                            </button>
                        </li>
                    )}
                    {hasAccess("settings") && (
                        <li>
                            <button onClick={() => setActiveDashboard("settings")} className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ease-in-out flex items-center ${activeDashboard === "settings" ? "bg-red-600 text-white shadow-md transform scale-105" : "hover:bg-gray-700 text-gray-300 hover:text-white"} focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75`}>
                                {!isSidebarCollapsed && <span className="truncate">Settings</span>}
                            </button>
                        </li>
                    )}
                </ul>

                {!isSidebarCollapsed && (
                    <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-400 mb-2">Access Level:</p>
                        <div className="flex flex-wrap gap-1">
                            {currentUser.permissions.timesheet_tracker && <Badge variant="outline" className="border-gray-200 text-gray-200 text-xs">Timesheets</Badge>}
                            {currentUser.permissions.task_tracker && <Badge variant="outline" className="border-gray-200 text-gray-200 text-xs">Tasks</Badge>}
                            {currentUser.permissions.leave_tracker && <Badge variant="outline" className="border-gray-200 text-gray-200 text-xs">Leave</Badge>}
                            {currentUser.permissions.skill_tracker && <Badge variant="outline" className="border-gray-200 text-gray-200 text-xs">Skills</Badge>}
                            {currentUser.permissions.user_role_management && <Badge variant="outline" className="border-gray-200 text-gray-200 text-xs">User Roles</Badge>}
                            {currentUser.permissions.settings && <Badge variant="outline" className="border-gray-200 text-gray-200 text-xs">Settings</Badge>}
                        </div>
                    </div>
                )}

                {!isSidebarCollapsed && (
                    <div className="mt-4 pt-4 border-t border-gray-700 text-gray-400 text-sm text-center">© 2025 OpsClad</div>
                )}
            </nav>

            <main className="flex-1 p-8 overflow-y-auto">
                
                {/* Conditional rendering for timesheet dashboard based on role */}
                {activeDashboard === "timesheet-tracker" && hasAccess("timesheet-tracker") && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        {currentUser.role === 'manager' ? (
                            // Manager view with all tabs
                            <Tabs defaultValue="reminders" value={activeTimesheetTab} onValueChange={setActiveTimesheetTab}>
                                <TabsList className="bg-gray-900 border-b border-gray-700 w-full rounded-t-lg rounded-b-none">
                                    {hasTimesheetTabAccess("reminders") && <TabsTrigger value="reminders" className="data-[state=active]:bg-gray-800">Email Reminders</TabsTrigger>}
                                    {hasTimesheetTabAccess("extraction") && <TabsTrigger value="extraction" className="data-[state=active]:bg-gray-800">Timesheet Extraction</TabsTrigger>}
                                    {hasTimesheetTabAccess("reports") && <TabsTrigger value="reports" className="data-[state=active]:bg-gray-800">Reports & Analytics</TabsTrigger>}
                                </TabsList>
                                {hasTimesheetTabAccess("extraction") && <TabsContent value="extraction" className="p-0"><ExtractionTab /></TabsContent>}
                                {hasTimesheetTabAccess("reports") && <TabsContent value="reports" className="p-0"><ReportsTab /></TabsContent>}
                                {hasTimesheetTabAccess("reminders") && <TabsContent value="reminders" className="p-0"><ReminderEmailTab /></TabsContent>}
                            </Tabs>
                        ) : (
                            // Employee view with only the reports tab
                            <Tabs defaultValue="employee-reports" value={activeTimesheetTab} onValueChange={setActiveTimesheetTab}>
                                {hasTimesheetTabAccess("employee-reports") && <TabsContent value="employee-reports" className="p-0"><EmployeeReportsTab /></TabsContent>}
                            </Tabs>
                        )}
                    </Card>
                )}
                {/* New Settings Dashboard */}
                {activeDashboard === "settings" && hasAccess("settings") && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        <SettingsTab />
                    </Card>
                )}

                {/* Existing Dashboards... (omitted for brevity) */}
                {activeDashboard === "task-tracker" && hasAccess("task-tracker") && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        {currentUser.role === 'manager' ? (
                            // Manager view with all tabs
                            <Tabs defaultValue="overview" value={activeTaskTab} onValueChange={setActiveTaskTab}>
                                <TabsList className="bg-gray-900 border-b border-gray-700 w-full rounded-t-lg rounded-b-none">
                                    {hasTaskTabAccess("overview") && <TabsTrigger value="overview" className="data-[state=active]:bg-gray-800">Task Overview</TabsTrigger>}
                                    {hasTaskTabAccess("reports") && <TabsTrigger value="reports" className="data-[state=active]:bg-gray-800">Reports & Analytics</TabsTrigger>}
                                </TabsList>
                                {hasTaskTabAccess("overview") && <TabsContent value="overview" className="p-0"><TaskOverviewTab /></TabsContent>}
                                {hasTaskTabAccess("reports") && <TabsContent value="reports" className="p-0"><TaskReportsTab /></TabsContent>}
                            </Tabs>
                        ) : (
                            // Employee view with only the tasks tab
                            <Tabs defaultValue="employee-tasks" value={activeTaskTab} onValueChange={setActiveTaskTab}>
                                {hasTaskTabAccess("employee-tasks") && (
                                    <EmployeeTaskView currentUser={currentUser.username} />
                                )}
                            </Tabs>
                        )}
                    </Card>
                )}

                {activeDashboard === "pto-tracking" && hasAccess("pto-tracking") && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        {currentUser.role === 'manager' ? (
                            // Manager view with all tabs
                            <Tabs defaultValue="pto-tracking" value={activePTOTab} onValueChange={setActivePTOTab}>
                                {hasPTOTabAccess("pto-tracking") && <TabsContent value="pto-tracking" className="p-0"><PTOTrackingTab/></TabsContent>}
                            </Tabs>
                        ) : (
                            // Employee view with only the tasks tab
                            <Tabs defaultValue="employee-pto" value={activePTOTab} onValueChange={setActivePTOTab}>
                                {hasPTOTabAccess("employee-pto") && (
                                    <EmployeePTOTab />
                                )}
                            </Tabs>
                        )}
                    </Card>
                )}

                {activeDashboard === "skill-tracker" && hasAccess("skill-tracker") && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        {currentUser.role === 'manager' ? (
                            // Manager view with all tabs
                            <Tabs defaultValue="skill-tracker" value={activeSkillTab} onValueChange={setActiveSkillTab}>
                                {hasSkillTabAccess("skill-tracker") && <TabsContent value="skill-tracker" className="p-0"><ManagerSkillTracker/></TabsContent>}
                            </Tabs>
                        ) : (
                            // Employee view with only the tasks tab
                            <Tabs defaultValue="employee-skills" value={activeSkillTab} onValueChange={setActiveSkillTab}>
                                {hasSkillTabAccess("employee-skills") && (
                                    <EmployeeSkillTracker />
                                )}
                            </Tabs>
                        )}
                    </Card>
                )}

                {activeDashboard === "home" &&(
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        <HomePage/>                       
                    </Card>
                )}

                {activeDashboard === "user-role-management" && hasAccess("user-role-management") && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg">
                        <UserRoleManagementTab />
                    </Card>
                )}

                {activeDashboard === "none" && (
                    <Card className="bg-gray-800 text-white shadow-xl rounded-lg p-8 text-center">
                        <h2 className="text-2xl font-bold mb-4">No Dashboard Available</h2>
                        <p className="text-gray-400">You don't have permission to access any dashboards. Please contact your administrator for access.</p>
                    </Card>
                )}
            </main>
        </div>
    );
}