import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAuthStore } from '../../store/authStore';
import { WorkspaceCard } from './WorkspaceCard';
import { Button } from '../shared/Button';
import { Plus, Search, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import { Input } from '../shared/Input';
import { WorkspaceModal } from './WorkspaceModal';
import { Select } from '../shared/Select';
import { useDarkMode } from '../../hooks/useDarkMode';
import { Workspace } from '../../types';
import { Modal } from '../shared/Modal';


export function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { workspaces, fetchWorkspaces, createWorkspace, updateWorkspace, duplicateWorkspace, deleteWorkspace, isLoading } = useWorkspaceStore();
    const { isDark, toggle } = useDarkMode();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingWorkspace, setEditingWorkspace] = useState<Workspace | undefined>(undefined);
    const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const handleModalSubmit = async (data: any) => {
        try {
            if (modalMode === 'create') {
                await createWorkspace(data);
                toast.success('Workspace created successfully');
            } else if (modalMode === 'edit' && editingWorkspace) {
                await updateWorkspace(editingWorkspace.id, data);
                toast.success('Workspace updated successfully');
            }
            setIsModalOpen(false);
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || 'Operation failed';
            toast.error(msg);
        }
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingWorkspace(undefined);
        setIsModalOpen(true);
    };

    const openEditModal = (ws: Workspace) => {
        setModalMode('edit');
        setEditingWorkspace(ws);
        setIsModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!workspaceToDelete) return;
        try {
            await deleteWorkspace(workspaceToDelete.id);
            toast.success('Workspace deleted');
            setWorkspaceToDelete(null);
        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || 'Deletion failed';
            toast.error(msg);
        }
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
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                        <Button onClick={openCreateModal} leftIcon={<Plus size={16} />}>
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
                        workspaces
                            .filter(ws => ws.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((ws) => (
                                <WorkspaceCard
                                    key={ws.id}
                                    workspace={ws}
                                    onClick={() => navigate(`/workspace/${ws.id}`)}
                                    onEdit={() => openEditModal(ws)}
                                    onDuplicate={async () => {
                                        try {
                                            await duplicateWorkspace(ws.id);
                                            toast.success('Workspace duplicated');
                                        } catch (error: any) {
                                            const msg = error.response?.data?.error || error.message || 'Duplication failed';
                                            toast.error(msg);
                                        }
                                    }}
                                    onDelete={async () => {
                                        setWorkspaceToDelete(ws);
                                    }}
                                    highlight={searchTerm}
                                />
                            ))
                    )}
                </div>
            </main>

            {/* Workspace Modal (Create/Edit) */}
            <WorkspaceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingWorkspace}
                mode={modalMode}
            />

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!workspaceToDelete}
                onClose={() => setWorkspaceToDelete(null)}
                title="Delete Workspace"
                size="sm"
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{workspaceToDelete?.name}</span>? This action cannot be undone.
                    </p>
                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-3 rounded-md text-xs border border-amber-200 dark:border-amber-800/30">
                        <strong>Warning:</strong> Deleting this workspace will immediately terminate all running components and clusters (Kind/Docker) associated with it.
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                        <Button variant="secondary" onClick={() => setWorkspaceToDelete(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete}>Delete</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
