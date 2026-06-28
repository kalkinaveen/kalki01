import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle2, Circle, Clock, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { api } from '../lib/api';

const STAGES = [
  { key: 'requested', icon: Clock, label: 'Refund Requested' },
  { key: 'reviewing', icon: ShieldCheck, label: 'Under Review' },
  { key: 'approved',  icon: CheckCircle2, label: 'Approved' },
  { key: 'completed', icon: CheckCircle2, label: 'Completed (wallet credited)' },
];

const RefundTracker = () => {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Try authed first (more info), fall back to public if 401
        try { setR(await api.refundMine(id)); }
        catch (e) { setR(await api.refundPublic(id)); }
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <section className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></section>;
  if (err || !r) {
    return (
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="eh-display text-2xl font-black mb-2">Refund not found</div>
        <p className="eh-mono text-xs opacity-70 mb-6">{err || 'This refund ID does not exist.'}</p>
        <Link to="/me" className="eh-btn-primary text-xs" data-testid="refund-back">← BACK TO ACCOUNT</Link>
      </section>
    );
  }

  const isRejected = r.status === 'rejected';
  const visibleStages = isRejected
    ? [STAGES[0], STAGES[1], { key: 'rejected', icon: XCircle, label: 'Rejected' }]
    : STAGES;
  const idx = visibleStages.findIndex(s => s.key === r.status);

  return (
    <section className="max-w-3xl mx-auto px-4 py-8 sm:py-12" data-testid="refund-tracker">
      <Link to="/me" className="inline-flex items-center gap-2 eh-mono text-xs opacity-70 hover:opacity-100 mb-6"><ArrowLeft size={12} /> back to account</Link>

      <div className="eh-panel eh-brackets p-5 sm:p-7 mb-6 overflow-hidden bg-[rgba(0,255,157,.03)] border-[rgba(0,255,157,.18)]">
        <span className="br-bl" /><span className="br-br" />
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="eh-mono text-[10px] opacity-60 flex items-center gap-1.5"><RotateCcw size={11} className="text-[var(--eh-green)]" /> REFUND ID</div>
            <div className="eh-display text-xl sm:text-2xl font-black eh-neon-soft break-all">{r.id}</div>
          </div>
          <div className="text-right">
            <div className="eh-mono text-[10px] opacity-60">STATUS</div>
            <div className={`eh-display font-black text-base sm:text-lg ${isRejected ? 'text-red-300' : 'eh-neon'}`}>{(r.status || '').toUpperCase()}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
          <div className="eh-panel p-3 min-w-0">
            <div className="eh-mono text-[10px] opacity-60">ORDER</div>
            <div className="truncate font-mono text-[var(--eh-green)]">{r.order_id}</div>
          </div>
          <div className="eh-panel p-3 min-w-0">
            <div className="eh-mono text-[10px] opacity-60">ORDER AMOUNT</div>
            <div className="font-bold">₹{Number(r.order_amount || 0).toLocaleString('en-IN')}</div>
          </div>
          {r.refund_amount > 0 && (
            <div className="eh-panel p-3 min-w-0">
              <div className="eh-mono text-[10px] opacity-60">REFUND</div>
              <div className="font-bold eh-neon">+₹{Number(r.refund_amount).toLocaleString('en-IN')}</div>
              <div className="eh-mono text-[10px] opacity-50">via {r.refund_method || 'wallet'}</div>
            </div>
          )}
        </div>

        {/* Timeline / stages */}
        <div>
          {visibleStages.map((s, i) => {
            const I = s.icon;
            const active = i <= idx;
            const current = i === idx;
            return (
              <div key={s.key} className="flex gap-4 pb-5 relative">
                {i < visibleStages.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-px" style={{ background: active ? 'var(--eh-green)' : 'var(--eh-border)' }} />}
                <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 relative" style={{ background: active ? 'rgba(0,255,157,.12)' : 'transparent', border: `1px solid ${active ? 'var(--eh-green)' : 'var(--eh-border)'}`, boxShadow: current ? '0 0 12px rgba(0,255,157,.4)' : 'none' }}>
                  {active ? <I size={16} color={s.key === 'rejected' ? '#fca5a5' : 'var(--eh-green)'} /> : <Circle size={14} className="opacity-40" />}
                </div>
                <div className="flex-1 pt-1">
                  <div className={`font-semibold ${active ? '' : 'opacity-60'}`}>{s.label}</div>
                  {current && r.admin_note && <div className="eh-mono text-[11px] opacity-70 mt-1 italic">&ldquo;{r.admin_note}&rdquo;</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail timeline */}
      {(r.timeline || []).length > 0 && (
        <div className="eh-panel p-5">
          <div className="eh-mono text-xs tracking-widest opacity-70 mb-3">// FULL LOG</div>
          <div className="space-y-2">
            {(r.timeline || []).map((t, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-[var(--eh-green)] mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="eh-mono"><b>{(t.status || '').toUpperCase()}</b> · <span className="opacity-60">{(t.at || '').slice(0, 19).replace('T', ' ')}</span></div>
                  {t.note && <div className="opacity-70 mt-0.5">{t.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default RefundTracker;
