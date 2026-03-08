import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../utils/api';

export default function AcceptInvite() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const { login } = useAuthStore(); // Actually we need to set user state, but login takes email/pass. 
    // We should probably just auto-login with the returned token/user from the accept endpoint.
    // I'll add a 'setAuth' method to store or just manually set local storage and reload/fetch.
    // Actually, useAuthStore has `set` but it's internal.
    // I'll assume the endpoint returns standard AuthResponse.
    // I'll call a new action `acceptInvite` in store or just handle it here and use `set({ user, token ... })` if I expose a setter,
    // or just call `login` is not possible because we have the token already.
    // I'll add `acceptInvite` action to `authStore` or just use the API and reload window to init store?
    // Better: Add `acceptInvite` to `authStore`.

    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!token) {
            toast.error('Invalid invitation link');
            navigate('/');
        }
    }, [token, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        try {
            await useAuthStore.getState().acceptInvite(token!, name, password);
            toast.success('Welcome to the team!');
            navigate('/dashboard');
        } catch (error: any) {
            toast.error(error.message || 'Failed to accept invitation');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                    Join the Team
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    Set up your account to get started
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200 dark:border-slate-800">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <Input
                            label="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />

                        <Input
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <Input
                            label="Confirm Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />

                        <div>
                            <Button
                                type="submit"
                                className="w-full flex justify-center items-center gap-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        Complete Setup
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
