import React, { useEffect, useState } from 'react';
import { Send as TgIcon, Loader2, Power, Save, Users, Megaphone, Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import TgAdminChatsPanel from './TgAdminChatsPanel';
import TgPaymentInfoPanel from './TgPaymentInfoPanel';
import PendingDepositsPanel from './PendingDepositsPanel';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Customer Telegram Bot manager — sits inside the Notifications tab.
 * - Enable/Disable: registers/clears the Telegram webhook so the bot starts/stops
 *   accepting customer DMs. Reuses the bot_token from the existing "Telegram Alerts"
 *   panel above (so admin only has to enter the token once).
 * - Welcome message: HTML-supported (parse_mode=HTML in backend).
 * - Command toggles: per-command on/off so admin can disable a feature without code.
 * - Broadcast: send a one-shot message to every linked customer (rate-limited).
 * - Linked users: shows the operators connected via deep-link from /me.
 */
const TelegramBotPanel = () => {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState([]);
  const [broadcast, setBroadcast] = useState('');
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [welcome, setWelcome] = useState('');
  const [commands, setCommands] = useState({ track: true, orders: true, pay: true, recover: true, help: true });
  const [copied, setCopied] = useState('');

  const load = async () => {
    try {
      const c = await api.tgBotGet();
      setCfg(c);
      setWelcome(c.welcome_message || '');
      setCommands(c.commands || { track: true, orders: true, pay: true, recover: true, help: true });
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const loadUsers = async () => {
    try { setUsers(await api.tgBotUsers()); } catch (e) { /* ignore */ }
  };

  useEffect(() => { load(); loadUsers(); }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const r = await api.tgBotEnable(BACKEND_URL);
      setCfg({ ...cfg, ...r.telegram_bot, webhook_secret_set: true });
      toast.success('Bot enabled', { description: `@${r.telegram_bot.username} now listening` });
    } catch (e) { toast.error('Enable failed', { description: e.message }); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (!window.confirm('Disable the customer bot? Webhook will be cleared.')) return;
    setBusy(true);
    try {
      const r = await api.tgBotDisable();
      setCfg({ ...cfg, ...r.telegram_bot });
      toast.success('Bot disabled');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.tgBotSave({ welcome_message: welcome, commands });
      setCfg(c => ({ ...c, ...r.telegram_bot }));
      toast.success('Settings saved');
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const sendBroadcast = async () => {
    if (!broadcast.trim()) { toast.error('Type a message first'); return; }
    if (!window.confirm(`Send to ${users.length} linked user(s)?`)) return;
    setBroadcastBusy(true);
    try {
      const r = await api.tgBotBroadcast(broadcast);
      toast.success(`Sent ${r.sent} · failed ${r.failed}`);
      setBroadcast('');
    } catch (e) { toast.error(e.message); }
    finally { setBroadcastBusy(false); }
  };
  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(''), 1500);
    toast.success('Copied');
  };

  if (loading || !cfg) return <div className="py-6 text-center"><Loader2 className="animate-spin inline-block" /></div>;

  const enabled = !!cfg.enabled;

  return (
    <div className="space-y-5" data-testid="admin-tg-bot-panel">
      {/* Header / status */}
      <div className="eh-panel p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// CUSTOMER BOT</div>
            <div className="eh-display text-xl font-black flex items-center gap-2">
              <TgIcon size={18} className="text-[var(--eh-green)]" />
              {enabled ? (
                <>Active <span className="eh-neon eh-mono text-sm">@{cfg.username || '—'}</span></>
              ) : 'Inactive'}
            </div>
            {enabled && (
              <a href={`https://t.me/${cfg.username}`} target="_blank" rel="noreferrer" className="eh-mono text-[11px] text-[var(--eh-green)] hover:underline inline-flex items-center gap-1 mt-1">
                <ExternalLink size={10} /> Open bot in Telegram
              </a>
            )}
          </div>
          <div className="flex gap-2">
            {!enabled ? (
              <button onClick={enable} disabled={busy} data-testid="admin-tg-bot-enable" className="eh-btn-primary text-xs inline-flex items-center gap-1.5">
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />} ENABLE BOT
              </button>
            ) : (
              <>
                <button onClick={enable} disabled={busy} title="Re-register webhook" className="eh-btn-ghost text-xs inline-flex items-center gap-1.5">
                  <RefreshCw size={12} /> RE-LINK
                </button>
                <button onClick={disable} disabled={busy} data-testid="admin-tg-bot-disable" className="text-xs eh-mono tracking-widest px-3 py-2 rounded border border-red-400/40 text-red-400 hover:bg-red-400/10">
                  <Power size={12} className="inline-block mr-1.5" /> DISABLE
                </button>
              </>
            )}
          </div>
        </div>

        {enabled ? (
          <div className="grid sm:grid-cols-2 gap-3 eh-mono text-[11px]">
            <div className="eh-panel p-3">
              <div className="opacity-60 mb-1 tracking-widest text-[10px]">// WEBHOOK</div>
              <div className="break-all">{cfg.webhook_url}</div>
            </div>
            <div className="eh-panel p-3">
              <div className="opacity-60 mb-1 tracking-widest text-[10px]">// LINKED USERS</div>
              <div className="text-[var(--eh-green)] font-bold eh-display text-2xl">{cfg.linked_users ?? users.length}</div>
            </div>
          </div>
        ) : (
          <div className="eh-mono text-[11px] opacity-70 leading-6">
            Enabling registers the webhook with Telegram using the bot token from <b>"Telegram Alerts"</b> above.
            Make sure your bot token is saved & alerts are working before you enable the customer bot.
          </div>
        )}
      </div>

      {/* Welcome + commands */}
      <div className="eh-panel p-5 space-y-3">
        <div className="eh-mono text-xs tracking-widest opacity-70">// WELCOME MESSAGE (HTML)</div>
        <textarea rows={6} className="eh-textarea text-sm" value={welcome} onChange={e => setWelcome(e.target.value)} data-testid="admin-tg-bot-welcome" placeholder="Shown when a user types /start" />

        <div className="eh-mono text-xs tracking-widest opacity-70 pt-2">// ENABLED COMMANDS</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { k: 'track', l: '/track' },
            { k: 'orders', l: '/orders' },
            { k: 'pay', l: '/pay' },
            { k: 'recover', l: '/recover' },
            { k: 'help', l: '/help' },
          ].map(c => (
            <label key={c.k} className={`eh-mono text-xs tracking-widest cursor-pointer p-3 rounded border transition-colors ${commands[c.k] ? 'border-[var(--eh-green)] text-[var(--eh-green)] bg-[rgba(0,255,157,.05)]' : 'border-[var(--eh-border)]'}`}>
              <input type="checkbox" checked={!!commands[c.k]} onChange={e => setCommands({ ...commands, [c.k]: e.target.checked })} className="mr-2 accent-[var(--eh-green)]" data-testid={`admin-tg-bot-cmd-${c.k}`} /> {c.l}
            </label>
          ))}
        </div>

        <button onClick={save} disabled={busy} className="eh-btn-primary text-xs inline-flex items-center gap-1.5 mt-2" data-testid="admin-tg-bot-save">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SAVE
        </button>
      </div>

      {/* Broadcast */}
      <div className="eh-panel p-5 space-y-3">
        <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2"><Megaphone size={12} /> // BROADCAST</div>
        <p className="eh-mono text-[11px] opacity-70 leading-6">Sends an HTML-formatted DM to every linked user. ~20 msg/sec to stay under Telegram limits.</p>
        <textarea rows={4} className="eh-textarea text-sm" value={broadcast} onChange={e => setBroadcast(e.target.value)} placeholder="<b>// FLASH OFFER</b> 20% off all recovery cases this week — reply YES to claim." data-testid="admin-tg-bot-broadcast" />
        <button onClick={sendBroadcast} disabled={broadcastBusy || !enabled || users.length === 0} className="eh-btn-primary text-xs inline-flex items-center gap-1.5" data-testid="admin-tg-bot-broadcast-send">
          {broadcastBusy ? <Loader2 size={12} className="animate-spin" /> : <Megaphone size={12} />} SEND TO {users.length} USER(S)
        </button>
      </div>

      {/* Admin chat IDs (for deposit approvals via Telegram) */}
      <TgAdminChatsPanel />

      {/* Customizable /pay payment info */}
      <TgPaymentInfoPanel />

      {/* Pending wallet deposits — approve / reject inline */}
      <PendingDepositsPanel />

      {/* Linked users list */}
      <div className="eh-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2"><Users size={12} /> // LINKED USERS ({users.length})</div>
          <button onClick={loadUsers} className="eh-btn-ghost text-[10px]"><RefreshCw size={10} /> REFRESH</button>
        </div>
        {users.length === 0 ? (
          <div className="eh-mono text-xs opacity-60 text-center py-6">No customer has linked Telegram yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full eh-mono text-xs">
              <thead className="bg-[rgba(255,255,255,.03)] text-[10px] tracking-widest opacity-70">
                <tr>
                  <th className="text-left p-2">EMAIL</th>
                  <th className="text-left p-2">TG</th>
                  <th className="text-left p-2">CHAT ID</th>
                  <th className="text-left p-2">LINKED</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-t border-[var(--eh-border)]">
                    <td className="p-2 break-all">{u.email}</td>
                    <td className="p-2">{u.telegram_username ? `@${u.telegram_username}` : (u.telegram_first_name || '—')}</td>
                    <td className="p-2 flex items-center gap-1.5">
                      <code>{u.telegram_chat_id}</code>
                      <button onClick={() => copy(String(u.telegram_chat_id), u.user_id)} className="opacity-60 hover:opacity-100">{copied === u.user_id ? <Check size={10} /> : <Copy size={10} />}</button>
                    </td>
                    <td className="p-2 opacity-70">{u.telegram_linked_at ? new Date(u.telegram_linked_at).toLocaleDateString() : '—'}</td>
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

export default TelegramBotPanel;
