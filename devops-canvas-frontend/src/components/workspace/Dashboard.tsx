import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAuthStore } from '../../store/authStore';
import { WorkspaceCard } from './WorkspaceCard';
import { Button } from '../shared/Button';
import { Plus, Search, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import { Input } from '../shared/Input';
import { Modal } from '../shared/Modal';
import { Select } from '../shared/Select';
import { useDarkMode } from '../../hooks/useDarkMode';


export function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { workspaces, fetchWorkspaces, createWorkspace, isLoading } = useWorkspaceStore();
    const { isDark, toggle } = useDarkMode();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Create Modal State
    const [newWsName, setNewWsName] = useState('');
    const [newWsDescription, setNewWsDescription] = useState('');
    const [newWsVisibility, setNewWsVisibility] = useState('private');
    const [newWsEnv, setNewWsEnv] = useState('development');

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const handleCreate = async () => {
        await createWorkspace({
            name: newWsName,
            description: newWsDescription,
            environment: newWsEnv as any,
            visibility: newWsVisibility as any,
        });
        setNewWsName('');
        setNewWsDescription('');
        setNewWsVisibility('private');
        setNewWsEnv('development');
        setIsModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors duration-300">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 h-16 px-6 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                        <span className="text-white font-bold text-lg leading-none">DC</span>
                    </div>
                    <span className="font-bold text-lg text-slate-950 dark:text-white">DevOps Canvas</span>
                </div>

                <div className="flex-1 max-w-xl mx-8">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search workspaces..."
                            className="w-full bg-slate-200 dark:bg-slate-800 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                        <button onClick={toggle} className="p-2 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                    </div>

                    <div className="relative z-20" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`flex items-center space-x-2 py-1 px-2 rounded-full border transition-all duration-200 focus:outline-none 
                                ${isDropdownOpen ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700' : 'border-transparent hover:bg-slate-100 hover:border-slate-300 dark:hover:bg-slate-800'}
                            `}
                        >
                            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium shadow-sm">
                                {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'JD'}
                            </div>
                            <div className="hidden sm:block text-left mr-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-300 flex items-center">
                                    {user?.name || 'Jane Doe'}
                                    <svg className={`ml-2 h-4 w-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </p>
                            </div>
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 transform transition-all duration-200 origin-top-right">
                                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 mb-1">
                                    <p className="text-sm font-medium text-slate-950 dark:text-white">{user?.name || 'Jane Doe'}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-500 truncate">{user?.email || 'jane@example.com'}</p>
                                </div>

                                <Link to="/profile" className="flex items-center px-4 py-2.5 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <UserIcon size={16} className="mr-3 text-slate-500" />
                                    Profile Settings
                                </Link>
                                <Link to="/team" className="flex items-center px-4 py-2.5 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <svg className="mr-3 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    Team Management
                                </Link>
                                <a href="#" className="flex items-center px-4 py-2.5 text-sm text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <svg className="mr-3 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    Billing
                                </a>

                                <div className="my-1 border-t border-slate-200 dark:border-slate-800"></div>

                                <button onClick={logout} className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                                    <LogOut size={16} className="mr-3" />
                                    Log out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-950 dark:text-white mb-1">Recent Workspaces</h1>
                        <p className="text-slate-600 dark:text-slate-500">Manage your infrastructure environments</p>
                    </div>

                    <div className="mt-4 md:mt-0">
                        <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus size={16} />}>
                            Create New Workspace
                        </Button>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {isLoading ? (
                        [...Array(4)].map((_, i) => (
                            <div key={i} className="h-48 bg-slate-300 dark:bg-slate-900 rounded-xl animate-pulse"></div>
                        ))
                    ) : (
                        workspaces.map((ws) => (
                            <WorkspaceCard
                                key={ws.id}
                                workspace={ws}
                                onClick={() => navigate(`/workspace/${ws.id}`)}
                            />
                        ))
                    )}
                </div>
            </main>

            {/* Create Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Workspace">
                <div className="space-y-4">
                    <Input
                        label="Workspace Name"
                        placeholder="e.g. Production Cluster"
                        value={newWsName}
                        onChange={e => setNewWsName(e.target.value)}
                    />

                    {/* Description Textarea */}
                    <div>
                        <label className="block text-xs font-medium text-slate-800 dark:text-slate-400 mb-1.5">
                            Description
                        </label>
                        <textarea
                            className="flex w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                            rows={3}
                            placeholder="What is this infrastructure for?"
                            value={newWsDescription}
                            onChange={e => setNewWsDescription(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Environment"
                            options={[
                                { value: 'development', label: 'Development' },
                                { value: 'staging', label: 'Staging' },
                                { value: 'production', label: 'Production' },
                            ]}
                            value={newWsEnv}
                            onChange={e => setNewWsEnv(e.target.value)}
                        />
                        <Select
                            label="Visibility"
                            options={[
                                { value: 'private', label: 'Private' },
                                { value: 'team', label: 'Team Shared' },
                                { value: 'public', label: 'Public' },
                            ]}
                            value={newWsVisibility}
                            onChange={e => setNewWsVisibility(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 mt-6">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={!newWsName}>Create Workspace</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
