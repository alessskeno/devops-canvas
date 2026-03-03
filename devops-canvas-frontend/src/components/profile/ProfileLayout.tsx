import React, { useState } from 'react';
import { User, Shield, Sliders, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Toggle } from '../shared/Toggle';
import { useDarkMode } from '../../hooks/useDarkMode';

import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const GeneralSettings = () => {
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const isLoading = useAuthStore((state) => state.isLoading);

    // Split name into First/Last for UI (naive approach)
    const [firstName, setFirstName] = useState(() => user?.name?.split(' ')[0] || '');
    const [lastName, setLastName] = useState(() => user?.name?.split(' ').slice(1).join(' ') || '');
    const [email, setEmail] = useState(user?.email || '');
    const [jobTitle, setJobTitle] = useState(user?.job_title || '');

    const handleSubmit = async () => {
        try {
            await updateProfile({
                name: `${firstName} ${lastName}`.trim(),
                email,
                job_title: jobTitle
            });
            toast.success('Profile updated successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update profile');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">General Information</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Manage your personal details and public profile.
                </p>
            </div>

            <div className="flex items-center gap-x-6">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                    {firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                    <button className="bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-700 font-medium py-2 px-4 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                        Upload New Picture
                    </button>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                        JPG, GIF or PNG. Max size of 800K
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">First Name</label>
                    <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                    />
                </div>

                <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Last Name</label>
                    <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Email Address</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                    />
                </div>

                <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Job Title</label>
                    <input
                        id="jobTitle"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Lead DevOps Engineer"
                        className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <Button onClick={handleSubmit} isLoading={isLoading}>
                    Save Changes
                </Button>
            </div>
        </div>
    );
};

const SecuritySettings = () => {
    const user = useAuthStore((state) => state.user);
    const changePassword = useAuthStore((state) => state.changePassword);
    const toggleMFA = useAuthStore((state) => state.toggleMFA);
    const isLoading = useAuthStore((state) => state.isLoading);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error("New passwords don't match");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        try {
            await changePassword({ current_password: currentPassword, new_password: newPassword });
            toast.success("Password updated successfully");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update password');
        }
    };

    const handleToggleMFA = async (enabled: boolean) => {
        try {
            await toggleMFA(enabled);
            toast.success(`MFA ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to update MFA settings');
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Security</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Manage your password and authentication methods.
                </p>
            </div>

            <div className="space-y-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Change Password</h4>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Current Password</label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">New Password</label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Confirm New Password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="block w-full rounded-md border-gray-300 dark:border-slate-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-900 dark:text-white py-2.5 px-3 border"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={handleChangePassword} isLoading={isLoading}>
                            Update Password
                        </Button>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-200 dark:border-slate-800 pt-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Add an extra layer of security to your account.</p>
                    </div>
                    <Toggle checked={user?.mfa_enabled || false} onChange={handleToggleMFA} />
                </div>
            </div>
        </div>
    );
};

const PreferencesSettings = () => {
    const { isDark, toggle } = useDarkMode();
    const user = useAuthStore((state) => state.user);
    const updatePreferences = useAuthStore((state) => state.updatePreferences);

    const notifications = user?.preferences?.notifications || {
        marketing: true,
        security: true,
        activity: true
    };

    const handleNotificationChange = (key: string, value: boolean) => {
        updatePreferences({
            notifications: {
                ...notifications,
                [key]: value
            }
        });
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Preferences</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Customize your workspace experience.
                </p>
            </div>

            <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Appearance</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Light Mode Card */}
                    <div
                        onClick={() => !isDark && null}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (isDark) toggle();
                            }
                        }}
                        className={`cursor-pointer rounded-xl border-2 p-1 overflow-hidden transition-all ${!isDark ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-slate-700 hover:border-blue-300'}`}
                    >
                        <button onClick={() => isDark && toggle()} className="w-full text-left">
                            <div className="bg-gray-100 rounded-lg h-32 w-full mb-3 flex flex-col overflow-hidden relative border border-gray-200">
                                {/* Wireframe for Light Mode */}
                                <div className="h-3 w-full bg-white border-b border-gray-200"></div>
                                <div className="flex flex-1">
                                    <div className="w-1/4 h-full bg-gray-50 border-r border-gray-200"></div>
                                    <div className="flex-1 bg-white"></div>
                                </div>
                            </div>
                            <div className="text-center font-medium text-gray-900 dark:text-white pb-2">Light Mode</div>
                        </button>
                    </div>

                    {/* Dark Mode Card */}
                    <div
                        onClick={() => isDark && null}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (!isDark) toggle();
                            }
                        }}
                        className={`cursor-pointer rounded-xl border-2 p-1 overflow-hidden transition-all ${isDark ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-slate-700 hover:border-blue-300'}`}
                    >
                        <button onClick={() => !isDark && toggle()} className="w-full text-left">
                            <div className="bg-slate-900 rounded-lg h-32 w-full mb-3 flex flex-col overflow-hidden relative border border-slate-800">
                                {/* Wireframe for Dark Mode */}
                                <div className="h-3 w-full bg-slate-950 border-b border-slate-800"></div>
                                <div className="flex flex-1">
                                    <div className="w-1/4 h-full bg-slate-900 border-r border-slate-800"></div>
                                    <div className="flex-1 bg-slate-950"></div>
                                </div>
                            </div>
                            <div className="text-center font-medium text-gray-900 dark:text-white pb-2">Dark Mode</div>
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Notifications</h4>
                <div className="space-y-4">
                    <div className="flex items-start">
                        <div className="flex h-5 items-center">
                            <input
                                id="marketing"
                                name="marketing"
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-gray-800 focus:ring-gray-800 bg-gray-100"
                                checked={notifications.marketing}
                                onChange={(e) => handleNotificationChange('marketing', e.target.checked)}
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="marketing" className="font-medium text-gray-900 dark:text-white">Marketing Emails</label>
                            <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">Receive emails about new products, features, and more.</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex h-5 items-center">
                            <input
                                id="security"
                                name="security"
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-600 bg-gray-100"
                                checked={notifications.security}
                                onChange={(e) => handleNotificationChange('security', e.target.checked)}
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="security" className="font-medium text-gray-900 dark:text-white">Security Updates</label>
                            <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">Get notified about important security alerts.</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex h-5 items-center">
                            <input
                                id="activity"
                                name="activity"
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-600 bg-gray-100"
                                checked={notifications.activity}
                                onChange={(e) => handleNotificationChange('activity', e.target.checked)}
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="activity" className="font-medium text-gray-900 dark:text-white">Platform Activity</label>
                            <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">Receive digests of activity in your workspace.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DeveloperSettings = () => (
    <div className="space-y-6">
        <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Developer Settings</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Manage API keys and access tokens.
            </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-md p-4">
            <div className="flex">
                <div className="flex-shrink-0">
                    <Code2 className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Coming Soon</h3>
                    <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <p>API access management will be available in the next release.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default function ProfileLayout() {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', name: 'General', icon: User },
        { id: 'security', name: 'Security', icon: Shield },
        { id: 'preferences', name: 'Preferences', icon: Sliders },
        { id: 'developer', name: 'Developer', icon: Code2 },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
            {/* Header */}
            <header className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium text-sm flex items-center gap-1">
                                ← Back to Dashboard
                            </Link>
                            <span className="text-gray-300 dark:text-slate-700">|</span>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 py-10">
                <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
                    {/* Sidebar */}
                    <aside className="py-6 px-2 sm:px-6 lg:col-span-3 lg:px-0 lg:py-0">
                        <nav className="space-y-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
                                            ${isActive
                                                ? 'bg-blue-50 text-blue-700 hover:text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                : 'text-gray-900 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-800 dark:hover:text-white'
                                            }
                                        `}
                                    >
                                        <Icon
                                            className={`
                                                flex-shrink-0 -ml-1 mr-3 h-5 w-5 transition-colors
                                                ${isActive
                                                    ? 'text-blue-500 group-hover:text-blue-500 dark:text-blue-400'
                                                    : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-400 dark:group-hover:text-gray-300'
                                                }
                                            `}
                                        />
                                        <span className="truncate">{tab.name}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Content */}
                    <div className="space-y-6 sm:px-6 lg:col-span-9 lg:px-0">
                        <div className="bg-white dark:bg-slate-950 shadow rounded-xl border border-gray-100 dark:border-slate-800 p-8 min-h-[500px]">
                            {activeTab === 'general' && <GeneralSettings />}
                            {activeTab === 'security' && <SecuritySettings />}
                            {activeTab === 'preferences' && <PreferencesSettings />}
                            {activeTab === 'developer' && <DeveloperSettings />}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
