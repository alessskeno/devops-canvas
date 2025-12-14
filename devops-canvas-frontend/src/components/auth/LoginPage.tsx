import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const isLoading = useAuthStore((state) => state.isLoading);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const validate = () => {
        const newErrors: any = {};
        if (!email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid';

        if (!password) newErrors.password = 'Password is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (error: any) {
            toast.error(error.message || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                        <Layers className="text-white h-7 w-7" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-950 dark:text-white">DevOps Canvas</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">Visual infrastructure composition</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Email address"
                        type="email"
                        placeholder="admin@devopscanvas.io"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        error={errors.email}
                    />
                    <Input
                        label="Password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={errors.password}
                    />

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center text-slate-700 dark:text-slate-400">
                            <input type="checkbox" className="mr-2 rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
                            Remember me
                        </label>
                        <Link to="#" className="text-blue-600 hover:underline">Forgot password?</Link>
                    </div>

                    <Button type="submit" className="w-full" isLoading={isLoading}>
                        Sign In
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-500">
                    Need help? <a href="#" className="text-blue-600 hover:underline">Contact Support</a>
                </div>
            </div>
        </div>
    );
}
