import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home,
  BarChart3,
  Calendar,
  Trophy,
  Award,
  Users,
  Settings,
  BookOpen,
  Zap,
  ClipboardCheck,
  User,
  Shield,
  CreditCard,
  FileText,
  HelpCircle,
  Flag,
  Bell,
} from 'lucide-react';

interface NavigationItem {
  name: string;
  icon: React.ComponentType<any>;
  path: string;
  show: boolean;
}

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';
  const isTeamOwnerOrAdmin = user?.teamRole === 'owner' || user?.teamRole === 'admin';

  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      icon: Home,
      path: '/dashboard',
      show: true,
    },
    { // Consolidated Quiz Center
      name: 'Quiz Center',
      icon: ClipboardCheck,
      path: '/quiz',
      show: true,
    },
    {
      name: 'Schedule',
      icon: Calendar,
      path: '/schedule',
      show: !!user?.teamId,
    },
    {
      name: 'Leaderboard',
      icon: Trophy,
      path: '/leaderboard',
      show: true,
    },
    {
      name: 'Achievements',
      icon: Award,
      path: '/achievements',
      show: true,
    },
    {
      name: 'Announcements',
      icon: Bell,
      path: '/announcements',
      show: true,
    },
  ];

  const adminNavigation: NavigationItem[] = [
    {
      name: 'Schedule Overview',
      icon: Calendar,
      path: '/schedule/team-overview',
      show: isTeamOwnerOrAdmin,
    },
    {
      name: 'Analytics',
      icon: BarChart3,
      path: '/analytics',
      show: isTeamOwnerOrAdmin,
    },
    {
      name: 'Team',
      icon: Users,
      path: '/team',
      show: isTeamOwnerOrAdmin,
    },
    {
      name: 'Admin Panel',
      icon: Shield,
      path: '/admin',
      show: isAdmin,
    },
    {
      name: 'User Management',
      icon: User,
      path: '/admin/users',
      show: isAdmin,
    },
    {
      name: 'Question Management',
      icon: FileText,
      path: '/admin/questions',
      show: isAdmin,
    },
    {
      name: 'Achievement Management',
      icon: Award,
      path: '/admin/achievements',
      show: isAdmin,
    },
    {
      name: 'Plan Management',
      icon: CreditCard,
      path: '/admin/plans',
      show: isAdmin,
    },
    {
      name: 'Assessments',
      icon: ClipboardCheck,
      path: '/admin/test-assessments',
      show: isTeamOwnerOrAdmin, // Make visible to team owners and admins
    },
    {
      name: 'Test Challenge Review',
      icon: Flag,
      path: '/admin/test-challenges',
      show: isTeamOwnerOrAdmin,
    },
    {
      name: 'Manage Announcements',
      icon: Bell,
      path: '/admin/announcements',
      show: isTeamOwnerOrAdmin,
    },
  ];

  const bottomNavigation: NavigationItem[] = [
    // Documentation link removed as per user request
    {
      name: 'Billing',
      icon: CreditCard,
      path: '/billing',
      show: user?.teamRole === 'owner',
    },
    {
      name: 'Settings',
      icon: Settings,
      path: '/settings',
      show: true,
    },
  ];

  const renderNavigationItems = (items: NavigationItem[]) => {
    return items
      .filter(item => item.show)
      .map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.name}
            to={item.path}
            className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              isActive
                ? 'bg-indigo-100 text-indigo-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon
              className={`mr-3 flex-shrink-0 h-6 w-6 ${
                isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
              }`}
              aria-hidden="true"
            />
            {item.name}
          </Link>
        );
      });
  };

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200 h-full">
      <div className="flex flex-col h-0 flex-1 pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-3 sm:px-4">
          <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600" />
          <span className="ml-2 text-lg sm:text-xl font-bold text-gray-900">Bible Quiz</span>
        </div>
        <nav className="mt-4 sm:mt-5 flex-1 px-2 space-y-1">
          {renderNavigationItems(navigation)}
          
          {(isAdmin || isTeamOwnerOrAdmin) && (
            <>
              <div className="border-t border-gray-200 my-4"></div>
              <div className="px-2 py-1 sm:py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Administration
                </h3>
              </div>
              {renderNavigationItems(adminNavigation.filter(item => item.show))}
            </>
          )}
          
          {renderNavigationItems(bottomNavigation)}
        </nav>
      </div>
    </div>
  );
}