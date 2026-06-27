import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

/**
 * Manages the list of Telegram chat IDs allowed to approve/decline wallet
 * deposits via the bot's inline buttons. Mirrors `telegram_bot.admin_chat_ids`.
 */
const TgAdminChatsPanel = () => {
  const [ids, setIds] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await api.adminTgChatsGet();
      setIds(r.admin_chat_ids || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = () => {
    const n = parseInt(input.trim(), 10);
    if (!n || isNaN(n)) { toast.error('Enter a numeric Telegram chat ID'); return; }
    if (ids.includes(n)) { toast.warning('Already in the list'); return; }
    setIds([...ids, n]);
    setInput('');
  };
  const remove = (n) => setIds(ids.filter(x => x !== n));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.adminTgChatsSet(ids);
      setIds(r.admin_chat_ids || []);
      toast.success('Admin chat list saved');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const test = async () => {
    if (ids.length === 0) { toast.error('Add at least one chat ID first'); return; }
    setBusy(true);
    try {
      const r = await api.adminTgChatsTest();
      if (r.ok) toast.success(`Test ping sent to ${r.sent}/${r.total} admin chat(s)`);
      else toast.error(r.error || 'Test failed');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="eh-panel p-5 grid place-items-center min-h-[100px]"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="eh-panel p-5 space-y-3" data-testid="admin-tg-chats-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2">
          <ShieldCheck size={12} className="text-[var(--eh-green)]" /> // ADMIN CHATS (DEPOSIT APPROVALS)
        </div>
        <button onClick={test} disabled={busy || ids.length === 0} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="admin-tg-chats-test">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} PING ALL
        </button>
      </div>
      <p className="eh-mono text-[11px] opacity-70 leading-6">
        Chat IDs listed here will receive inline <b className="text-[var(--eh-green)]">Approve / Decline</b> buttons whenever a customer submits a wallet deposit.
        Each admin must <b>/start</b> the bot at least once. Get a chat ID with <code>/myid</code> or use <a className="text-[var(--eh-green)] hover:underline" href="https://t.me/userinfobot" target="_blank" rel="noreferrer">@userinfobot</a>.
      </p>

      <div className="flex gap-2 flex-wrap mt-2">
        {ids.length === 0 && <div className="eh-mono text-[11px] opacity-50">No admin chats configured yet.</div>}
        {ids.map(id => (
          <span key={id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded eh-mono text-xs bg-[rgba(0,255,157,.08)] text-[var(--eh-green)] border border-[rgba(0,255,157,.3)]" data-testid={`admin-tg-chat-${id}`}>
            {id}
            <button onClick={() => remove(id)} className="opacity-70 hover:opacity-100 hover:text-red-400" data-testid={`admin-tg-chat-remove-${id}`}><Trash2 size={11} /></button>
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="> e.g. 123456789"
          className="eh-input flex-1"
          inputMode="numeric"
          data-testid="admin-tg-chat-input"
        />
        <button onClick={add} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="admin-tg-chat-add"><Plus size={12} /> ADD</button>
        <button onClick={save} disabled={busy} className="eh-btn-primary text-xs inline-flex items-center gap-1.5" data-testid="admin-tg-chats-save">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SAVE
        </button>
      </div>
    </div>
  );
};

export default TgAdminChatsPanel;
