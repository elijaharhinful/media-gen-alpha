'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Zap, ImageIcon, Film, Wand2,
  Plus, Trash2, Ban, CheckCircle, Edit2, Loader2, Shield, BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Student {
  id: string;
  email: string;
  name: string | null;
  creditLimit: number | null;
  isBlocked: boolean;
  createdAt: string;
  creditsUsed: number;
  generationCount: number;
}

interface CreditStats {
  totalPool: number;
  totalUsed: number;
  recentUsed: number;
  recentCount: number;
  usageByTool: { tool: string; totalCredits: number; count: number }[];
  topUsers: { id: string; name: string; email: string; role: string; creditsUsed: number; generationCount: number }[];
  totalUsers: number;
  totalStudents: number;
}

const toolIcons: Record<string, any> = {
  IMAGE_GENERATOR: ImageIcon,
  VIDEO_GENERATOR: Film,
  PROMPT_MULTIPLIER: Wand2,
};

const toolColors: Record<string, string> = {
  IMAGE_GENERATOR: 'text-lime-400 bg-lime-400/10',
  VIDEO_GENERATOR: 'text-purple-400 bg-purple-400/10',
  PROMPT_MULTIPLIER: 'text-blue-400 bg-blue-400/10',
};

export default function AdminPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'students'>('overview');
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ email: '', password: '', name: '', creditLimit: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState('');

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleOpenAddStudent = () => {
    setNewStudent({ email: '', password: generatePassword(), name: '', creditLimit: '' });
    setShowPassword(false);
    setShowAddStudent(true);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsRes, statsRes] = await Promise.all([
        fetch('/api/admin/students'),
        fetch('/api/admin/credits'),
      ]);
      if (studentsRes.ok) {
        const d = await studentsRes.json();
        setStudents(d.students || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && !isAdmin) router.replace('/');
    else if (status === 'authenticated' && isAdmin) fetchData();
  }, [status, isAdmin, router, fetchData]);

  const addStudent = async () => {
    if (!newStudent.email || !newStudent.password) {
      toast.error('Email and password are required');
      return;
    }
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStudent,
          creditLimit: newStudent.creditLimit ? parseInt(newStudent.creditLimit) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create student');
        return;
      }
      toast.success('Student created');
      setShowAddStudent(false);
      setNewStudent({ email: '', password: '', name: '', creditLimit: '' });
      fetchData();
    } catch {
      toast.error('Something went wrong');
    }
  };

  const toggleBlock = async (id: string, currentlyBlocked: boolean) => {
    try {
      await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isBlocked: !currentlyBlocked }),
      });
      toast.success(currentlyBlocked ? 'Student unblocked' : 'Student blocked');
      fetchData();
    } catch {
      toast.error('Failed to update');
    }
  };

  const updateLimit = async (id: string) => {
    try {
      await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          creditLimit: editLimit === '' ? null : parseInt(editLimit),
        }),
      });
      toast.success('Credit limit updated');
      setEditingId(null);
      fetchData();
    } catch {
      toast.error('Failed to update');
    }
  };

  const deleteStudent = async (id: string) => {
    if (!confirm('Delete this student? This cannot be undone.')) return;
    try {
      await fetch(`/api/admin/students?id=${id}`, { method: 'DELETE' });
      toast.success('Student deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (status === 'loading' || !isAdmin) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="hero-gradient">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-400/10">
              <LayoutDashboard className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage students and monitor credit usage</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-card/50 border border-border/50 p-1 w-fit mb-6">
            {(['overview', 'students'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'overview' ? <BarChart3 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {t === 'overview' ? 'Overview' : 'Students'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[1100px]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tab === 'overview' ? (
            /* Overview Tab */
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Credit Pool', value: stats?.totalPool ?? 0, icon: Zap, color: 'text-amber-400' },
                  { label: 'Credits Used', value: stats?.totalUsed ?? 0, icon: BarChart3, color: 'text-blue-400' },
                  { label: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-green-400' },
                  { label: 'Students', value: stats?.totalStudents ?? 0, icon: Shield, color: 'text-purple-400' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5"
                  >
                    <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                    <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Usage by Tool */}
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
                <h3 className="text-sm font-semibold mb-4">Usage by Tool</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(stats?.usageByTool || []).map(t => {
                    const Icon = toolIcons[t.tool] || Zap;
                    const colorClass = toolColors[t.tool] || 'text-foreground bg-muted';
                    return (
                      <div key={t.tool} className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/50 p-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{t.tool.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">{t.totalCredits} credits • {t.count} uses</p>
                        </div>
                      </div>
                    );
                  })}
                  {(!stats?.usageByTool || stats.usageByTool.length === 0) && (
                    <p className="text-sm text-muted-foreground col-span-3">No usage recorded yet</p>
                  )}
                </div>
              </div>

              {/* Top Users */}
              {stats?.topUsers && stats.topUsers.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
                  <h3 className="text-sm font-semibold mb-4">Top Users by Credit Usage</h3>
                  <div className="space-y-2">
                    {stats.topUsers.map((u, i) => (
                      <div key={u.id || i} className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/50 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{u.creditsUsed}</p>
                          <p className="text-xs text-muted-foreground">{u.generationCount} gens</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Students Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{students.length} student(s)</p>
                <button
                  onClick={() => {
                    if (showAddStudent) {
                      setShowAddStudent(false);
                    } else {
                      handleOpenAddStudent();
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" /> Add Student
                </button>
              </div>

              {/* Add Student Form */}
              {showAddStudent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6"
                >
                  <h3 className="text-sm font-semibold mb-4">Create Student Account</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                      <input
                        value={newStudent.name}
                        onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="Student name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Email *</label>
                      <input
                        value={newStudent.email}
                        onChange={e => setNewStudent(p => ({ ...p, email: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="student@example.com"
                        type="email"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex justify-between">
                        <span>Password *</span>
                        <button type="button" onClick={() => setNewStudent(p => ({ ...p, password: generatePassword() }))} className="text-primary hover:underline">Regenerate</button>
                      </label>
                      <div className="relative">
                        <input
                          value={newStudent.password}
                          onChange={e => setNewStudent(p => ({ ...p, password: e.target.value }))}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm pr-10"
                          placeholder="Min 6 characters"
                          type={showPassword ? "text" : "password"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye-off"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Credit Limit (%)</label>
                      <input
                        value={newStudent.creditLimit}
                        onChange={e => setNewStudent(p => ({ ...p, creditLimit: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        placeholder="e.g., 30 (empty = unlimited)"
                        type="number"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={addStudent}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowAddStudent(false)}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Student List */}
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
                {students.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No students yet. Create one above.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {students.map(s => (
                      <div key={s.id} className="flex items-center gap-4 px-6 py-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          s.isBlocked ? 'bg-red-400/10 text-red-400' : 'bg-primary/10 text-primary'
                        }`}>
                          {(s.name || s.email)[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {s.name || s.email}
                            {s.isBlocked && <span className="ml-2 text-xs text-red-400">[Blocked]</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium">{s.creditsUsed} credits</p>
                          <p className="text-xs text-muted-foreground">{s.generationCount} generations</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          {editingId === s.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editLimit}
                                onChange={e => setEditLimit(e.target.value)}
                                className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                                placeholder="%"
                                type="number"
                                min="0"
                                max="100"
                              />
                              <button onClick={() => updateLimit(s.id)} className="text-xs text-primary hover:underline">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-muted-foreground">
                                Limit: {s.creditLimit !== null ? `${s.creditLimit}%` : '∞'}
                              </p>
                              <button
                                onClick={() => { setEditingId(s.id); setEditLimit(s.creditLimit?.toString() || ''); }}
                                className="text-muted-foreground hover:text-foreground p-1"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleBlock(s.id, s.isBlocked)}
                            className={`p-2 rounded-lg transition-colors ${
                              s.isBlocked
                                ? 'text-green-400 hover:bg-green-400/10'
                                : 'text-amber-400 hover:bg-amber-400/10'
                            }`}
                            title={s.isBlocked ? 'Unblock' : 'Block'}
                          >
                            {s.isBlocked ? <CheckCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => deleteStudent(s.id)}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
