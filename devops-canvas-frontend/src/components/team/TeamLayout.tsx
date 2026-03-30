import React, { useState, useMemo } from 'react';
import {
    LayoutDashboard,
    Users,
    UserPlus,
    ShieldCheck,
    ArrowLeft,
    Mail,
    Layers,
    Trash2,
    Check,
    Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useTeamStore } from '../../store/teamStore';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { formatRelativeTime, getDisplayInitials } from '../../utils/relativeTime';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from 'sonner';
import { RoleBadge } from './RoleBadge';



export default function TeamLayout() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'invite' | 'roles'>('overview');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'Admin' | 'Editor' | 'Viewer'>('Viewer');
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [inviteSubmitting, setInviteSubmitting] = useState(false);

    // Store integration
    const { members, fetchMembers, inviteMember, updateRole, removeMember } = useTeamStore();
    const { workspaces, fetchWorkspaces } = useWorkspaceStore();
    const { user } = useAuthStore();
    const teamMembers = members || [];

    React.useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    React.useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const workspaceActivity = useMemo(() => {
        return [...workspaces]
            .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
            .slice(0, 10)
            .map((w) => ({
                id: w.id,
                user: w.last_updated_by_name?.trim() || 'Someone',
                target: w.name,
                time: formatRelativeTime(w.lastModified),
                initials: getDisplayInitials(w.last_updated_by_name || 'User'),
            }));
    }, [workspaces]);


    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'members', label: 'Members', icon: Users },
        ...((user?.role === 'Owner' || user?.role === 'Admin') ? [{ id: 'invite', label: 'Invite Users', icon: UserPlus }] : []),
        { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
    ];

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = inviteEmail.trim();
        if (!email) return;
        setInviteSubmitting(true);
        try {
            const url = await inviteMember(email, inviteRole);
            setInviteLink(url);
            setInviteEmail('');
            toast.success('Invitation created — copy the link and send it to your teammate');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create invitation');
        } finally {
            setInviteSubmitting(false);
        }
    };

    const copyInviteLink = async () => {
        if (!inviteLink) return;
        const ok = await copyToClipboard(inviteLink);
        if (ok) {
            toast.success('Link copied to clipboard');
        } else {
            toast.error('Could not copy — select the link and copy manually');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col transition-colors">
            <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
                <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md text-gray-500">
                    <ArrowLeft size={18} />
                </button>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Team Management</h1>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 flex flex-col lg:flex-row gap-8">
                <aside className="w-full lg:w-64 flex-shrink-0">
                    <nav className="space-y-1">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                                    activeTab === item.id
                                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                                )}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>

                <section className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm min-h-[600px]">
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Team Overview</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">At a glance view of your team's activity.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Members</span>
                                        <Users size={18} className="text-blue-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{teamMembers.length}</div>
                                </div>
                                <div className="p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Invites</span>
                                        <Mail size={18} className="text-orange-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{teamMembers.filter(m => m.status === 'Invited').length}</div>
                                </div>
                                <div className="p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800/50">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Workspaces</span>
                                        <Layers size={18} className="text-green-500" />
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {workspaces.filter((w) => w.componentCount > 0).length}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-4">Recent Activity</h3>
                                <div className="space-y-4">
                                    {workspaceActivity.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            No workspace updates yet. Edit a workspace canvas to see activity here.
                                        </p>
                                    ) : (
                                        workspaceActivity.map((activity) => (
                                            <div key={activity.id} className="flex items-center gap-3 text-sm">
                                                <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">
                                                    {activity.initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-medium text-gray-900 dark:text-white">{activity.user}</span>
                                                    <span className="text-gray-500 dark:text-gray-400"> updated workspace </span>
                                                    <span className="font-medium text-gray-900 dark:text-white">{activity.target}</span>
                                                </div>
                                                <span className="text-xs text-gray-400 shrink-0">{activity.time}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'members' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Team Members</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage access and roles for your team.</p>
                                </div>
                                {(user?.role === 'Owner' || user?.role === 'Admin') && (
                                    <Button onClick={() => setActiveTab('invite')} className="h-9 text-sm"><UserPlus size={16} /> Invite Member</Button>
                                )}
                            </div>

                            <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                                            <tr>
                                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
                                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Last Active</th>
                                                <th className="px-6 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                            {teamMembers.map((member) => (
                                                <tr key={member.id} className="group hover:bg-gray-50 dark:hover:bg-slate-800/30">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-200">
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-gray-900 dark:text-white">{member.name}</div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {/* Conditionally render select or RoleBadge based on user permissions */}
                                                        {user?.role === 'Owner' && user?.id !== member.id ? (
                                                            <select
                                                                value={member.role}
                                                                onChange={(e) => updateRole(member.id, e.target.value)}
                                                                className="bg-transparent border-none text-gray-700 dark:text-gray-300 focus:ring-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 rounded px-2 py-1 -ml-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                                disabled={user?.role !== 'Owner' || user?.id === member.id}
                                                            >
                                                                {member.role === 'Owner' && <option>Owner</option>}
                                                                <option>Admin</option>
                                                                <option>Editor</option>
                                                                <option>Viewer</option>
                                                            </select>
                                                        ) : (
                                                            <RoleBadge role={member.role} />
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn("px-2 py-1 rounded-full text-xs font-medium", member.status === 'Active' ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400")}>
                                                            {member.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{member.lastActive || '-'}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        {member.id !== user?.id && member.role !== 'Owner' && (user?.role === 'Owner' || (user?.role === 'Admin' && member.role !== 'Admin')) && (
                                                            <button onClick={() => removeMember(member.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'invite' && (
                        <div className="space-y-8 animate-in fade-in duration-300 max-w-lg">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Invite Users</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Create an invite for this email. We do not send email yet — copy the link and share it (chat, email, etc.).
                                </p>
                            </div>

                            <form onSubmit={handleInvite} className="space-y-6">
                                <Input
                                    label="Email Address"
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                // required prop is not standard on Custom Input, handling validation manually or type assertion if acceptable
                                />

                                <div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Role</span>
                                    <div className="grid grid-cols-1 gap-3">
                                        {['Admin', 'Editor', 'Viewer'].map((role) => (
                                            <label key={role} htmlFor={`role-${role}`} className={cn("flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all", inviteRole === role ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : "border-gray-200 dark:border-slate-700 hover:border-gray-300")}>
                                                <input
                                                    type="radio"
                                                    id={`role-${role}`}
                                                    name="role"
                                                    className="mt-1"
                                                    checked={inviteRole === role}
                                                    onChange={() => setInviteRole(role as any)}
                                                    aria-label={`Select ${role} role`}
                                                />
                                                <div>
                                                    <div className="font-medium text-sm text-gray-900 dark:text-white">{role}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {role === 'Admin' ? 'Full access to workspace settings and billing.' :
                                                            role === 'Editor' ? 'Can create and edit infrastructure, but not manage team.' :
                                                                'Read-only access to infrastructure views.'}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <Button type="button" variant="ghost" onClick={() => setActiveTab('members')}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" isLoading={inviteSubmitting} disabled={!inviteEmail.trim()}>
                                        Create invitation
                                    </Button>
                                </div>
                            </form>

                            {inviteLink && (
                                <div className="space-y-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-4">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Invitation link
                                    </span>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                                        <Input
                                            readOnly
                                            value={inviteLink}
                                            className="font-mono text-xs sm:flex-1"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                            aria-label="Invitation link"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="shrink-0"
                                            leftIcon={<Copy size={16} />}
                                            onClick={copyInviteLink}
                                        >
                                            Copy
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'roles' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Roles & Permissions</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Understand the capabilities of each role.</p>
                            </div>

                            <div className="grid gap-6">
                                {[
                                    { role: 'Owner', perms: ['Manage Billing', 'Delete Workspace', 'Manage Team', 'Edit Infrastructure', 'View Analytics'], color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
                                    { role: 'Admin', perms: ['Manage Team', 'Edit Infrastructure', 'View Analytics', 'Configure Integrations'], color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                                    { role: 'Editor', perms: ['Edit Infrastructure', 'View Analytics', 'Deploy Changes'], color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                                    { role: 'Viewer', perms: ['View Infrastructure', 'View Logs', 'View Analytics'], color: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400' },
                                ].map((item) => (
                                    <div key={item.role} className="border border-gray-200 dark:border-slate-700 rounded-xl p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className={cn("px-2.5 py-0.5 rounded-full text-sm font-bold", item.color)}>{item.role}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {item.perms.map(perm => (
                                                <span key={perm} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-50 dark:bg-slate-800 text-xs text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-slate-700">
                                                    <Check size={12} className="text-green-500" /> {perm}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};
