import React, { useEffect, useState } from 'react';
import { Send as TgIcon, Loader2, Copy, Check, ExternalLink, Unlink, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

/**
 * "Connect Telegram" card for the My Account page.
 * Flow:
 *  1. Fetch status — if linked, show linked TG username + Unlink.
 *  2. If not linked, click "Generate code" → POST /me/telegram/link-code returns
 *     a 6-digit code + deep_link to t.me/<bot>?start=link_CODE.
 *  3. User taps the deep link → bot fires /start link_<code> → backend matches the
 *     code to the user and stores telegram_chat_id on their user doc.
 *  4. Card auto-polls /me/telegram/status every 4s while a code is active so it
 *     flips to "linked" the moment the user taps the bot button.
 */
const TelegramAccountCard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState(null); // { code, deep_link, expires_at }
  const [copied, setCopied] = useState(false);

  const reload = async () => {
    try { setStatus(await api.meTelegramStatus()); }
    catch (e) { /* not logged in or network */ }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, []);

  // Poll while waiting for the user to tap the bot link
  useEffect(() => {
    if (!link || status?.linked) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [link, status?.linked]);

  // Auto-clear the code once linked
  useEffect(() => { if (status?.linked) setLink(null); }, [status?.linked]);

  if (loading) return null;
  if (!status) return null;

  if (!status.bot_enabled) {
    return (
      <div className="eh-panel p-5">
        <div className="eh-mono text-xs tracking-widest opacity-60 mb-2 flex items-center gap-2"><TgIcon size={12} /> // TELEGRAM</div>
        <div className="eh-display text-base font-bold mb-1">Bot is not active yet</div>
        <p className="eh-mono text-xs opacity-70 leading-6">The team will enable the live bot soon. You'll be able to track orders and get instant updates right inside Telegram.</p>
      </div>
    );
  }

  const generate = async () => {
    setBusy(true);
    try {
      const r = await api.meTelegramLinkCode();
      setLink(r);
    } catch (e) { toast.error(e.message || 'Could not generate code'); }
    finally { setBusy(false); }
  };

  const unlink = async () => {
    if (!window.confirm('Disconnect your Telegram from this account?')) return;
    setBusy(true);
    try {
      await api.meTelegramUnlink();
      toast.success('Disconnected');
      await reload();
      setLink(null);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const copyCode = () => {
    if (!link?.code) return;
    navigator.clipboard.writeText(link.code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success('Code copied');
  };

  const botHandle = status.bot_username ? `@${status.bot_username}` : '@errorhackerbot';
  const botUrl = status.bot_username ? `https://t.me/${status.bot_username}` : 'https://t.me/errorhackerbot';

  return (
    <div className="eh-panel p-5" data-testid="telegram-account-card">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="eh-mono text-xs tracking-widest opacity-60 flex items-center gap-2"><TgIcon size={12} /> // TELEGRAM</div>
        {status.linked && <BadgeCheck size={14} className="text-[var(--eh-green)]" />}
      </div>

      {status.linked ? (
        <>
          <div className="eh-display text-base font-bold mb-1 flex items-center gap-2">
            Connected
            {status.telegram_username && <span className="eh-neon eh-mono text-sm">@{status.telegram_username}</span>}
          </div>
          <p className="eh-mono text-xs opacity-70 leading-6 mb-3">
            You'll get instant DMs whenever your order or recovery case status changes.
          </p>
          <button onClick={unlink} disabled={busy} data-testid="telegram-unlink-btn" className="eh-btn-ghost text-xs">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />} DISCONNECT
          </button>
        </>
      ) : link ? (
        <>
          <div className="eh-display text-base font-bold mb-1">Tap the button to confirm</div>
          <p className="eh-mono text-xs opacity-70 leading-6 mb-3">Opens our bot in Telegram and links this account. This page auto-detects the connection in a few seconds.</p>
          <a href={link.deep_link} target="_blank" rel="noreferrer" data-testid="telegram-open-bot-btn" className="eh-btn-primary text-xs inline-flex items-center gap-1.5 mb-3">
            <TgIcon size={12} /> OPEN @{link.bot_username}
          </a>
          <div className="eh-panel p-3 bg-[rgba(0,255,157,.04)] border-dashed">
            <div className="eh-mono text-[10px] opacity-60 mb-1">// FALLBACK: type this in the bot manually</div>
            <div className="flex items-center justify-between gap-2">
              <code className="eh-mono text-sm eh-neon-soft font-bold">/start link_{link.code}</code>
              <button onClick={copyCode} className="eh-btn-ghost text-[10px]">{copied ? <Check size={10} /> : <Copy size={10} />} COPY</button>
            </div>
          </div>
          <div className="eh-mono text-[10px] opacity-50 mt-2 flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Waiting for confirmation — code expires in 10 min</div>
        </>
      ) : (
        <>
          <div className="eh-display text-base font-bold mb-1">Two easy ways to use our bot</div>
          <p className="eh-mono text-xs opacity-75 leading-6 mb-4">No password, no scary stuff. Pick whichever feels comfortable.</p>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Option 1 — fastest, zero commitment */}
            <a href={botUrl} target="_blank" rel="noreferrer" data-testid="telegram-open-bot-direct" className="block p-3 rounded-lg border border-[var(--eh-border)] hover:border-[var(--eh-green)] transition-colors group">
              <div className="flex items-center gap-2 mb-1.5">
                <TgIcon size={14} className="text-[var(--eh-green)]" />
                <div className="eh-mono text-[10px] tracking-widest text-[var(--eh-green)]">// OPTION 1 · INSTANT</div>
              </div>
              <div className="font-bold text-sm mb-1">Just chat with the bot</div>
              <p className="eh-mono text-[10px] opacity-70 leading-5 mb-2">Paste your <span className="eh-neon-soft">REC-XXX</span> or <span className="eh-neon-soft">ORD-XXX</span> ID — that's it. Zero login.</p>
              <span className="inline-flex items-center gap-1 eh-mono text-[10px] font-bold text-[var(--eh-green)] group-hover:underline">
                OPEN {botHandle} <ExternalLink size={10} />
              </span>
            </a>

            {/* Option 2 — link for live alerts */}
            <div className="p-3 rounded-lg border border-[var(--eh-border)]">
              <div className="flex items-center gap-2 mb-1.5">
                <BadgeCheck size={14} className="opacity-70" />
                <div className="eh-mono text-[10px] tracking-widest opacity-70">// OPTION 2 · LIVE ALERTS</div>
              </div>
              <div className="font-bold text-sm mb-1">Auto-DM when status changes</div>
              <p className="eh-mono text-[10px] opacity-70 leading-5 mb-2">Optional — link your account and get instant DMs the moment something happens. Takes 5 seconds, no password.</p>
              <button onClick={generate} disabled={busy} data-testid="telegram-connect-btn" className="eh-btn-ghost text-[10px] inline-flex items-center gap-1.5">
                {busy ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />} {busy ? 'GENERATING…' : 'CONNECT FOR ALERTS'}
              </button>
            </div>
          </div>

          <div className="eh-mono text-[10px] opacity-50 mt-3 leading-5">
            // We never see your Telegram password. Connection is one-tap and you can disconnect anytime.
          </div>
        </>
      )}
    </div>
  );
};

export default TelegramAccountCard;
