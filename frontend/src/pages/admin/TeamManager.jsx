import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2, ShieldCheck, UserCog, AlertCircle, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const TeamManager = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [draft, setDraft] = useState({ email: '', name: '', password: '', role: 'feed_mod', daily_upload_limit: 10, max_upload_mb: 15 });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await api.teamList()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const loadAudit = async () => {
    try { setAudit(await api.auditList()); setShowAudit(true); }
    catch (e) { toast.error(e.message); }
  };

  const create = async () => {
    if (!draft.email.trim() || !draft.password) { toast.error('Email and password required'); return; }
    setCreating(true);
    try {
      const u = await api.teamAdd(draft);
      setRows(prev => [u, ...prev.filter(r => r.user_id !== u.user_id)]);
      setDraft({ email: '', name: '', password: '', role: 'feed_mod', daily_upload_limit: 10, max_upload_mb: 15 });
      toast.success(`Added ${u.email}`);
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const patch = async (id, p) => {
    try {
      const u = await api.teamUpdate(id, p);
      setRows(prev => prev.map(r => r.user_id === id ? u : r));
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id, email) => {
    if (!window.confirm(`Revoke moderator access for ${email}?`)) return;
    try { await api.teamRemove(id); setRows(prev => prev.filter(r => r.user_id !== id)); toast.success('Demoted to customer'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="mb-5">
        <div className="eh-kicker mb-2">// TEAM & PERMISSIONS</div>
        <h2 className="eh-display text-2xl md:text-3xl font-black flex items-center gap-2"><UserCog className="text-[var(--eh-green)]" /> Team Management</h2>
        <p className="text-sm opacity-70 mt-1">Add feed moderators with limited permissions. Moderators can post & hide but cannot delete or change site settings.</p>
      </div>

      <div className="eh-panel p-4 mb-5">
        <div className="eh-mono text-xs opacity-70 mb-3 tracking-widest">// ADD MODERATOR</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">EMAIL</div><input className="eh-input" value={draft.email} onChange={e=>setDraft({...draft, email:e.target.value.toLowerCase()})} placeholder="mod@example.com" data-testid="team-add-email" /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">DISPLAY NAME</div><input className="eh-input" value={draft.name} onChange={e=>setDraft({...draft, name:e.target.value})} placeholder="Mod Name" /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">TEMP PASSWORD (6+ chars)</div><input className="eh-input" type="text" value={draft.password} onChange={e=>setDraft({...draft, password:e.target.value})} placeholder="Will be shared with the mod" data-testid="team-add-pass" /></div>
          <div>
            <div className="eh-mono text-[10px] opacity-60 mb-1">ROLE</div>
            <select className="eh-input" value={draft.role} onChange={e=>setDraft({...draft, role:e.target.value})}>
              <option value="feed_mod">Feed Moderator (limited)</option>
              <option value="owner">Owner (full access)</option>
            </select>
          </div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">DAILY UPLOAD LIMIT</div><input className="eh-input" type="number" value={draft.daily_upload_limit} onChange={e=>setDraft({...draft, daily_upload_limit:Number(e.target.value)})} /></div>
          <div><div className="eh-mono text-[10px] opacity-60 mb-1">MAX UPLOAD SIZE (MB)</div><input className="eh-input" type="number" value={draft.max_upload_mb} onChange={e=>setDraft({...draft, max_upload_mb:Number(e.target.value)})} /></div>
        </div>
        <button onClick={create} disabled={creating} data-testid="team-add-btn" className="eh-btn-primary text-xs mt-3 flex items-center gap-1.5 disabled:opacity-50">
          {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {creating ? 'CREATING…' : 'CREATE / PROMOTE'}
        </button>
        <div className="eh-mono text-[10px] opacity-50 mt-3">// If the email is already a registered user, that account gets promoted instead of recreated.</div>
      </div>

      {loading ? <div className="text-center py-10"><Loader2 className="animate-spin inline-block" /></div> : (
        <div className="space-y-3">
          {rows.length === 0 && <div className="eh-panel p-10 text-center eh-mono text-xs opacity-60">No moderators yet. Create one above.</div>}
          {rows.map(u => (
            <div key={u.user_id} className={`eh-panel p-4 ${u.disabled ? 'opacity-60' : ''}`} data-testid={`team-row-${u.user_id}`}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-full grid place-items-center text-sm eh-mono shrink-0" style={{ background: 'rgba(0,255,157,.15)', color: 'var(--eh-green)' }}>{(u.name || u.email || '?')[0].toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold text-sm">{u.name || u.email.split('@')[0]}</div>
                    <span className={`text-[10px] eh-mono tracking-widest px-2 py-0.5 rounded ${u.role==='owner'?'bg-[rgba(77,224,255,.15)] text-[#4de0ff]':'bg-[rgba(0,255,157,.15)] text-[var(--eh-green)]'}`}>{u.role.toUpperCase()}</span>
                    {u.disabled && <span className="text-[10px] eh-mono tracking-widest px-2 py-0.5 rounded bg-red-500/15 text-red-400">DISABLED</span>}
                  </div>
                  <div className="eh-mono text-xs opacity-70">{u.email}</div>
                  <div className="eh-mono text-[10px] opacity-60 mt-1.5">Uploads today: <span className="text-[var(--eh-green)]">{u.today_uploads || 0}</span> / {u.daily_upload_limit || 10} · Max file: {u.max_upload_mb || 15} MB</div>
                </div>
              </div>
              {u.role === 'feed_mod' && (
                <div className="grid sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-[var(--eh-border)]">
                  <div><div className="eh-mono text-[10px] opacity-60 mb-1">DAILY LIMIT</div><input className="eh-input" type="number" value={u.daily_upload_limit || 10} onChange={e=>patch(u.user_id, { daily_upload_limit: Number(e.target.value) })} /></div>
                  <div><div className="eh-mono text-[10px] opacity-60 mb-1">MAX MB</div><input className="eh-input" type="number" value={u.max_upload_mb || 15} onChange={e=>patch(u.user_id, { max_upload_mb: Number(e.target.value) })} /></div>
                  <div><div className="eh-mono text-[10px] opacity-60 mb-1">RESET PASSWORD</div><input className="eh-input" type="text" placeholder="new password…" onKeyDown={e => { if (e.key==='Enter' && e.target.value.length>=6) { patch(u.user_id, { password: e.target.value }); toast.success('Password updated'); e.target.value=''; } }} /></div>
                </div>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--eh-border)] flex-wrap gap-2">
                <button onClick={() => patch(u.user_id, { disabled: !u.disabled })} className={`text-[10px] eh-mono tracking-widest px-3 py-1.5 rounded border ${u.disabled ? 'border-[var(--eh-green)] text-[var(--eh-green)]' : 'border-[var(--eh-border)] hover:border-[var(--eh-green)]'}`}>{u.disabled ? 'ENABLE' : 'DISABLE'}</button>
                <button onClick={() => remove(u.user_id, u.email)} className="text-[10px] eh-mono text-red-400 hover:text-red-300 px-3 py-1.5 rounded border border-red-400/30 flex items-center gap-1.5"><Trash2 size={11} /> REVOKE</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-5 border-t border-[var(--eh-border)]">
        <button onClick={loadAudit} className="text-xs eh-mono px-3 py-2 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] flex items-center gap-1.5 mb-3"><Activity size={12} /> {showAudit ? 'REFRESH AUDIT LOG' : 'SHOW AUDIT LOG'}</button>
        {showAudit && (
          <div className="eh-panel overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-[rgba(255,255,255,.03)] eh-mono text-[10px] tracking-widest uppercase opacity-70">
                <tr><th className="text-left p-2">When</th><th className="text-left p-2">Actor</th><th className="text-left p-2">Role</th><th className="text-left p-2">Action</th><th className="text-left p-2">Target</th></tr>
              </thead>
              <tbody>
                {audit.length===0 && <tr><td colSpan={5} className="p-4 text-center opacity-60">No activity logged yet.</td></tr>}
                {audit.map(a => (
                  <tr key={a.id} className="border-t border-[var(--eh-border)]">
                    <td className="p-2 eh-mono text-[10px] opacity-70">{new Date(a.at).toLocaleString()}</td>
                    <td className="p-2">{a.actor || '—'}</td>
                    <td className="p-2 eh-mono uppercase opacity-80">{a.actor_role || '—'}</td>
                    <td className="p-2 eh-mono text-[var(--eh-green)]">{a.action}</td>
                    <td className="p-2 eh-mono opacity-70">{a.target_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamManager;
