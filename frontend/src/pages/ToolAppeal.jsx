import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Copy, RefreshCw, Sparkles, Mail, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import ToolsUsageBar from '../components/ToolsUsageBar';
import LimitReachedDialog from '../components/LimitReachedDialog';

const REASONS = [
  'Community Guidelines violation',
  'Spam / unauthentic activity',
  'Impersonation',
  'Hate speech / sensitive content',
  'Copyright (DMCA) strike',
  'Underage / age policy',
  'Bought / sold / shared account',
  'Suspicious login (security lock)',
  'Other (specify in story)',
];
const TONES = [
  ['polite',    'Polite & respectful (recommended)'],
  ['formal',    'Formal & corporate'],
  ['emotional', 'Personal & emotional'],
];
const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Twitter / X', 'Snapchat'];
const LANGUAGES = ['English', 'Hindi', 'Spanish', 'Portuguese', 'French', 'German'];

const TOOL_FORM_KEY = 'eh.tool.appeal.draft';

const ToolAppeal = () => {
  // Restore any draft saved before a paywall/sign-in detour, so users never lose work.
  const restoredForm = (() => {
    try { return JSON.parse(localStorage.getItem(TOOL_FORM_KEY) || 'null'); } catch { return null; }
  })();
  const [form, setForm] = useState(restoredForm || {
    platform: 'Instagram',
    violation_reason: REASONS[0],
    account_handle: '',
    account_age: '',
    followers: '',
    backstory: '',
    tone: 'polite',
    language: 'english',
  });
  const [letter, setLetter] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState(null);
  const [limitDialog, setLimitDialog] = useState(null);

  const refreshUsage = () => api.toolsUsage().then(setUsage).catch(() => {});
  useEffect(() => { refreshUsage(); }, []);

  // Clear the draft after a successful generation OR an explicit reset.
  // Kept on the page until then so paywalled users can finish where they left off.
  useEffect(() => {
    if (letter) {
      try { localStorage.removeItem(TOOL_FORM_KEY); } catch { /* ignore */ }
    }
  }, [letter]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    if (!form.violation_reason) {
      toast.error('Please pick the violation reason');
      return;
    }
    setBusy(true);
    setLetter('');
    try {
      const r = await api.toolsAppeal(form);
      setLetter(r.letter || '');
      refreshUsage();
      toast.success('Appeal generated · review before sending');
    } catch (e) {
      if (e.status === 429 && e.detail?.limit_reached) {
        setLimitDialog(e.detail);
        refreshUsage();
      } else {
        toast.error(e.message || 'Failed to generate appeal');
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy — please select & copy manually');
    }
  };

  return (
    <div className="pt-10 pb-20">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <Link to="/tools" className="inline-flex items-center gap-1.5 eh-mono text-[11px] tracking-widest opacity-70 hover:opacity-100 mb-6">
          <ArrowLeft size={12} /> BACK TO TOOLS
        </Link>

        <div className="text-center mb-8">
          <div className="eh-kicker justify-center mb-3">// AI TOOL · APPEAL GENERATOR</div>
          <h1 className="font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.7rem, 5vw, 2.8rem)' }}>
            Write a <span className="eh-neon">winning</span> appeal in 30 seconds
          </h1>
          <p className="opacity-70 mt-3 text-sm max-w-xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
            Drop a few details. Our AI drafts a polite, platform-ready letter you can send straight from your registered email.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full border border-[var(--eh-border)] bg-[#0d1115] eh-mono text-[10px] tracking-widest opacity-80">
            <Sparkles size={11} className="text-[#ffd34d]" /> POWERED BY CLAUDE SONNET 4.5
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* FORM */}
          <div className="eh-panel eh-brackets p-5 sm:p-6 space-y-4">
            <span className="br-bl" /><span className="br-br" />
            <ToolsUsageBar
              used={usage?.tools?.appeal?.used ?? 0}
              freeLimit={usage?.tools?.appeal?.free_limit ?? 2}
              walletCost={usage?.tools?.appeal?.wallet_cost ?? 49}
              balance={usage?.logged_in ? usage?.balance : null}
              paidUses={usage?.tools?.appeal?.paid_uses ?? 0}
              loading={!usage}
            />
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Platform</label>
              <select data-testid="appeal-platform" className="eh-input" value={form.platform} onChange={(e) => update('platform', e.target.value)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Reason given by platform</label>
              <select data-testid="appeal-reason" className="eh-input" value={form.violation_reason} onChange={(e) => update('violation_reason', e.target.value)}>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Your handle</label>
                <input data-testid="appeal-handle" className="eh-input" placeholder="@yourhandle" value={form.account_handle} onChange={(e) => update('account_handle', e.target.value)} />
              </div>
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Account age</label>
                <input data-testid="appeal-age" className="eh-input" placeholder="e.g. 3 years" value={form.account_age} onChange={(e) => update('account_age', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Followers (optional)</label>
                <input data-testid="appeal-followers" className="eh-input" placeholder="e.g. 12k" value={form.followers} onChange={(e) => update('followers', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Your side of the story (optional)</label>
              <textarea data-testid="appeal-backstory" rows={3} className="eh-textarea" placeholder="Briefly explain what really happened, in your own words." value={form.backstory} onChange={(e) => update('backstory', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Tone</label>
                <select data-testid="appeal-tone" className="eh-input" value={form.tone} onChange={(e) => update('tone', e.target.value)}>
                  {TONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block eh-mono text-[11px] tracking-widest opacity-80 mb-2">Language</label>
                <select data-testid="appeal-language" className="eh-input" value={form.language} onChange={(e) => update('language', e.target.value)}>
                  {LANGUAGES.map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)}
                </select>
              </div>
            </div>

            <button data-testid="appeal-generate" onClick={generate} disabled={busy} className="eh-btn-primary w-full" style={{ opacity: busy ? .7 : 1 }}>
              {busy ? <><RefreshCw size={14} className="eh-spin-slow" /> GENERATING…</> : <><Sparkles size={14} /> GENERATE APPEAL</>}
            </button>
          </div>

          {/* RESULT */}
          <div className="eh-panel eh-brackets p-5 sm:p-6 min-h-[420px] flex flex-col">
            <span className="br-bl" /><span className="br-br" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} color="var(--eh-green)" />
                <span className="eh-mono text-[11px] tracking-widest opacity-80">// YOUR APPEAL</span>
              </div>
              {letter && (
                <button data-testid="appeal-copy" onClick={copy} className="eh-mono text-[10px] tracking-widest px-2.5 py-1.5 rounded border border-[var(--eh-border)] hover:border-[var(--eh-green)] inline-flex items-center gap-1.5">
                  {copied ? <><Check size={11} /> COPIED</> : <><Copy size={11} /> COPY</>}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto rounded border border-[var(--eh-border)] bg-[#050608] p-4 whitespace-pre-wrap text-sm leading-relaxed" data-testid="appeal-letter" style={{ fontFamily: 'Inter, sans-serif', minHeight: 320 }}>
              {letter ? letter : (busy ? <span className="opacity-50 eh-mono text-xs">{`> drafting your appeal letter...`}</span> : <span className="opacity-40 eh-mono text-xs">{`> your generated letter will appear here.`}</span>)}
            </div>

            {letter && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={`mailto:?subject=${encodeURIComponent('Account appeal — ' + form.platform)}&body=${encodeURIComponent(letter)}`}
                  data-testid="appeal-mail"
                  className="eh-btn-ghost text-xs justify-center"
                >
                  <Mail size={12} /> EMAIL DRAFT
                </a>
                <Link to="/recovery" data-testid="appeal-cta-recovery" className="eh-btn-primary text-xs">
                  GET PRO HELP
                </Link>
              </div>
            )}
            <p className="text-[10px] opacity-50 eh-mono mt-3 text-center">
              · AI output · review &amp; personalize before sending · no data stored
            </p>
          </div>
        </div>
        <LimitReachedDialog open={!!limitDialog} detail={limitDialog} onClose={() => setLimitDialog(null)} formStateKey={TOOL_FORM_KEY} formState={form} />
      </div>
    </div>
  );
};

export default ToolAppeal;
