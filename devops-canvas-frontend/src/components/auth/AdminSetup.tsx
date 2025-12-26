import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export function AdminSetup() {
    const navigate = useNavigate();
    const adminSetup = useAuthStore((state) => state.adminSetup);
    const isLoading = useAuthStore((state) => state.isLoading);
    const checkSystemStatus = useAuthStore((state) => state.checkSystemStatus);

    React.useEffect(() => {
        const check = async () => {
            const configured = await checkSystemStatus();
            if (configured) {
                toast.error('System is already configured');
                navigate('/login');
            }
        };
        check();
    }, [checkSystemStatus, navigate]);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        agreed: false
    });

    const getPasswordStrength = (pass: string) => {
        let score = 0;
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score < 2) return { label: 'Weak', color: 'bg-red-500', width: '25%' };
        if (score < 3) return { label: 'Fair', color: 'bg-yellow-500', width: '50%' };
        if (score < 4) return { label: 'Good', color: 'bg-blue-500', width: '75%' };
        return { label: 'Strong', color: 'bg-green-500', width: '100%' };
    };

    const strength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (!formData.agreed) {
            toast.error('Please agree to terms');
            return;
        }

        try {
            await adminSetup(formData);
            toast.success('Admin account created!');
            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (err: any) {
            toast.error(err.message || 'Setup failed');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3 shadow-lg">
                        <Layers className="text-white h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Welcome to DevOps Canvas</h1>
                    <p className="text-sm text-center text-slate-600 dark:text-slate-500">
                        Let's set up your admin account to get started.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="First Name"
                            required
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        />
                        <Input
                            label="Last Name"
                            required
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </div>

                    <Input
                        label="Admin Email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />

                    <div>
                        <Input
                            label="Password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        {/* Simple Strength Meter */}
                        {formData.password && (
                            <div className="mt-1 flex gap-1 h-1">
                                <div className={`flex-1 rounded-full ${calculateStrength(formData.password) >= 1 ? 'bg-red-400' : 'bg-slate-300'}`} />
                                <div className={`flex-1 rounded-full ${calculateStrength(formData.password) >= 2 ? 'bg-yellow-400' : 'bg-slate-300'}`} />
                                <div className={`flex-1 rounded-full ${calculateStrength(formData.password) >= 3 ? 'bg-blue-400' : 'bg-slate-300'}`} />
                                <div className={`flex-1 rounded-full ${calculateStrength(formData.password) >= 4 ? 'bg-green-400' : 'bg-slate-300'}`} />
                            </div>
                        )}
                    </div>

                    <Input
                        label="Confirm Password"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            required
                            id="terms"
                            name="agreed"
                            checked={formData.agreed}
                            onChange={handleChange}
                            className="mr-2 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="terms" className="text-xs text-slate-600 dark:text-slate-500">
                            I agree to the <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                        </label>
                    </div>

                    <Button type="submit" className="w-full" isLoading={isLoading}>
                        Create Admin User
                    </Button>
                </form>
            </div>
        </div>
    );
}

function calculateStrength(password: string): number {
    let strength = 0;
    if (password.length > 6) strength++;
    if (password.length > 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    return strength;
}
