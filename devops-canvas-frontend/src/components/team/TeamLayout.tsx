import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Settings, Shield, Mail, MoreHorizontal, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';
import { Input } from '../shared/Input';
import { Select } from '../shared/Select';

// Mock Data
const MOCK_MEMBERS = [
    { id: '1', name: 'Jane Doe', email: 'jane@example.com', role: 'Admin', status: 'Active', lastActive: '2 mins ago', avatar: 'JD' },
    { id: '2', name: 'John Smith', email: 'john@example.com', role: 'Editor', status: 'Active', lastActive: '1 day ago', avatar: 'JS' },
    { id: '3', name: 'Mike Johnson', email: 'mike@example.com', role: 'Viewer', status: 'Invited', lastActive: '-', avatar: 'MJ' },
];

const OverviewTab = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Total Members</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">3</dd>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Pending Invites</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">1</dd>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Seats Used</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">3 / 5</dd>
                </div>
            </div>
        </div>
    </div>
);

const MembersTab = () => {
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Team Members</h3>
                <Button onClick={() => setIsInviteModalOpen(true)} leftIcon={<UserPlus size={16} />}>
                    Invite User
                </Button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <ul role="list" className="divide-y divide-gray-200 dark:divide-slate-800">
                    {MOCK_MEMBERS.map((person) => (
                        <li key={person.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="flex items-center min-w-0 gap-x-4">
                                <div className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                                    {person.avatar}
                                </div>
                                <div className="min-w-0 flex-auto">
                                    <p className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">{person.name}</p>
                                    <p className="mt-1 truncate text-xs leading-5 text-gray-500 dark:text-slate-400">{person.email}</p>
                                </div>
                            </div>
                            <div className="hidden sm:flex sm:flex-col sm:items-end">
                                <div className="flex items-center gap-x-2">
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${person.role === 'Admin' ? 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-400/10 dark:text-purple-400' :
                                            person.role === 'Editor' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-400/10 dark:text-blue-400' :
                                                'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400'
                                        }`}>
                                        {person.role}
                                    </span>
                                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${person.status === 'Active' ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-400/10 dark:text-green-400' : 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 dark:bg-yellow-400/10 dark:text-yellow-400'
                                        }`}>
                                        {person.status}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-500">
                                    Last active {person.lastActive}
                                </p>
                            </div>
                            <div className="flex sm:hidden items-center">
                                <button className="text-gray-400 hover:text-gray-500">
                                    <MoreHorizontal className="h-5 w-5" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Team Member">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                        Invite a new member to your workspace. They will receive an email invitation.
                    </p>
                    <Input
                        label="Email Address"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Select
                        label="Role"
                        options={[
                            { value: 'viewer', label: 'Viewer (Read-only)' },
                            { value: 'editor', label: 'Editor (Can edit)' },
                            { value: 'admin', label: 'Admin (Full access)' },
                        ]}
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>Cancel</Button>
                        <Button onClick={() => setIsInviteModalOpen(false)}>Send Invitation</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const RolesTab = () => (
    <div className="space-y-6">
        <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Role Permissions</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                View what each role can do in the workspace.
            </p>
        </div>

        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg border border-gray-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-900">
                    <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Permission</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Viewer</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Editor</th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Admin</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                    {[
                        { name: 'View Workspace', viewer: true, editor: true, admin: true },
                        { name: 'Edit Canvas', viewer: false, editor: true, admin: true },
                        { name: 'Deploy Infrastructure', viewer: false, editor: true, admin: true },
                        { name: 'Manage Team', viewer: false, editor: false, admin: true },
                        { name: 'Billing Access', viewer: false, editor: false, admin: true },
                    ].map((item) => (
                        <tr key={item.name}>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">{item.name}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-slate-400">
                                {item.viewer ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-slate-700 ml-2" />}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-slate-400">
                                {item.editor ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-slate-700 ml-2" />}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-slate-400">
                                {item.admin ? <CheckCircle2 className="text-green-500 h-5 w-5" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-200 dark:bg-slate-700 ml-2" />}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

export default function TeamLayout() {
    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', name: 'Overview', icon: Users },
        { id: 'members', name: 'Members', icon: UserPlus },
        { id: 'roles', name: 'Roles & Permissions', icon: Shield },
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
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Team Management</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold border border-orange-200">
                                PRO
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-slate-800 mb-8">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                        ${activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                                        }
                                    `}
                                >
                                    <Icon
                                        className={`
                                            -ml-0.5 mr-2 h-5 w-5
                                            ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500 dark:text-slate-500'}
                                        `}
                                    />
                                    {tab.name}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content */}
                <div className="min-h-[500px]">
                    {activeTab === 'overview' && <OverviewTab />}
                    {activeTab === 'members' && <MembersTab />}
                    {activeTab === 'roles' && <RolesTab />}
                </div>
            </main>
        </div>
    );
}
