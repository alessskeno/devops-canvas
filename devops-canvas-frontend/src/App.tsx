import React, { useEffect } from 'react';
import { MotionConfig, useReducedMotion } from "framer-motion";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { Toaster, useToasterStore, toast } from 'react-hot-toast';
import { LoginPage } from './components/auth/LoginPage';
import AcceptInvite from './components/auth/AcceptInvite';
import { AdminSetup } from './components/auth/AdminSetup';
import { Dashboard } from './components/workspace/Dashboard';
import { NodeEditor } from './components/canvas/NodeEditor';
import ProfileLayout from './components/profile/ProfileLayout';
import TeamLayout from './components/team/TeamLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useDarkMode } from './hooks/useDarkMode';

// Root Layout to include global providers
const RootLayout = () => {
  useDarkMode(); // Initialise theme
  const checkStatus = useAuthStore((state: any) => state.checkSystemStatus);
  const { toasts } = useToasterStore();
  const TOAST_LIMIT = 3;

  useEffect(() => { checkStatus(); }, []);

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= TOAST_LIMIT)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  // Ensure accessibility hook is used
  useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <Toaster position="top-center" containerStyle={{ top: 20 }} toastOptions={{ duration: 3000 }} />
      <Outlet />
    </MotionConfig>
  );
};

const RootRedirect = () => {
  const isConfigured = useAuthStore((state: any) => state.isSystemConfigured);
  const checkStatus = useAuthStore((state: any) => state.checkSystemStatus);

  useEffect(() => {
    checkStatus();
  }, []);

  if (!isConfigured) {
    return <Navigate to="/admin-setup" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/accept-invite", element: <AcceptInvite /> },
      { path: "/admin-setup", element: <AdminSetup /> },
      {
        path: "/dashboard",
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      },
      {
        path: "/workspace/:id",
        element: <ProtectedRoute><NodeEditor /></ProtectedRoute>
      },
      {
        path: "/profile",
        element: <ProtectedRoute><ProfileLayout /></ProtectedRoute>
      },
      {
        path: "/team",
        element: <ProtectedRoute><TeamLayout /></ProtectedRoute>
      },
      { path: "/", element: <RootRedirect /> },
      { path: "*", element: <RootRedirect /> }
    ]
  }
]);

export default function App() {
  return <RouterProvider router={router} />;
}
