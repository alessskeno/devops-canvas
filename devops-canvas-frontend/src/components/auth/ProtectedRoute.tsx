import { useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, fetchUser } = useAuthStore();
    const location = useLocation();
    const hasFetched = useRef(false);

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Fetch user profile once when authenticated (replaces useEffect)
    if (!hasFetched.current) {
        hasFetched.current = true;
        fetchUser();
    }

    return <>{children}</>;
}
