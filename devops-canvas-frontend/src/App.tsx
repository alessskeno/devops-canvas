import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LoginPage } from './components/auth/LoginPage';
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
  useEffect(() => { checkStatus(); }, []);

  return (
    <>
      <Toaster position="top-right" />
      <Outlet />
    </>
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
