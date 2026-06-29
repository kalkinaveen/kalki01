import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Check, X, Clock, Wallet as WalletIcon, RotateCcw, ExternalLink, FileText, Search, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const STATUS_BADGE = {
  requested: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
  reviewing: 'border-blue-400/40 text-blue-300 bg-blue-400/10',
  approved: 'border-[rgba(0,255,157,.4)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]',
  rejected: 'border-red-400/40 text-red-300 bg-red-400/10',
  processed: 'border-purple-400/40 text-purple-300 bg-purple-400/10',
  completed: 'border-[rgba(0,255,157,.4)] text-[var(--eh-green)] bg-[rgba(0,255,157,.12)]',
};

const IssueByTrackingPanel = ({ onIssued }) => {
  const [tid, setTid] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('wallet');
  const [issuing, setIssuing] = useState(false);

  const lookup = async () => {
    const id = tid.trim();
    if (!id) { toast.error('Enter a tracking ID'); return; }
    setLookingUp(true); setTarget(null);
    try {
      const r = await api.adminRefundLookup(id);
      setTarget(r);
      setAmount(r.suggested_amount ? String(r.suggested_amount) : '');
      toast.success(`Found · ${r.kind.replace('_', ' ')}`);
    } catch (e) { toast.error(e.message || 'Lookup failed'); }
    finally { setLookingUp(false); }
  };

  const issue = async () => {
    const amt = parseFloat(amount);
    if (!(amt > 0)) { toast.error('Enter a valid refund amount'); return; }
    if (method === 'wallet' && !target?.user?.user_id) {
      if (!window.confirm('No linked user account — wallet credit will be skipped. Continue anyway?')) return;
    }
    if (!window.confirm(`Issue refund of ₹${amt} via ${method.toUpperCase()} for ${tid}?`)) return;
    setIssuing(true);
    try {
      const r = await api.adminRefundIssue({ tracking_id: tid.trim(), amount: amt, reason, method });
      toast.success('Refund issued · customer notified', { description: `Refund ID: ${r.refund?.id}` });
      setTid(''); setTarget(null); setAmount(''); setReason(''); setMethod('wallet');
      onIssued?.(r.refund);
    } catch (e) { toast.error(e.message || 'Issue failed'); }
    finally { setIssuing(false); }
  };

  const order = target?.order;
  const usr = target?.user;
  const sym = '₹';

  return (
    <div className="eh-panel p-5 border border-[rgba(0,255,157,.3)] bg-[rgba(0,255,157,.04)]" data-testid="admin-issue-refund-panel">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded border border-[var(--eh-green)] grid place-items-center"><Zap size={14} className="text-[var(--eh-green)]" /></div>
        <div>
          <div className="eh-mono text-[10px] tracking-widest opacity-60">// DIRECT REFUND</div>
          <div className="eh-display text-lg font-black">Issue refund by tracking ID</div>
        </div>
      </div>
      <div className="eh-mono text-[11px] opacity-70 leading-5 mb-3">Paste any ORD-, REC- or RFD- ID. We&apos;ll resolve the order + user, then credit the wallet (or queue a manual payout) and ping the customer on Telegram + email.</div>

      <div className="flex gap-2 mb-3">
        <input value={tid} onChange={e => setTid(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} placeholder="> ORD-XXXX  /  REC-XXXX  /  RFD-XXXX" className="eh-input text-sm flex-1" data-testid="admin-issue-refund-tid" />
        <button onClick={lookup} disabled={lookingUp || !tid.trim()} data-testid="admin-issue-refund-lookup" className="eh-btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50 px-4">
          {lookingUp ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          {lookingUp ? 'LOOKING…' : 'LOOKUP'}
        </button>
      </div>

      {target && (
        <div className="space-y-3" data-testid="admin-issue-refund-target">
          <div className="grid grid-cols-2 gap-3 p-3 rounded border border-[var(--eh-border)] bg-black/30">
            <div>
              <div className="eh-mono text-[9px] tracking-widest opacity-60">KIND</div>
              <div className="eh-mono text-xs eh-neon-soft">{(target.kind || '—').replace('_', ' ').toUpperCase()}</div>
            </div>
            <div>
              <div className="eh-mono text-[9px] tracking-widest opacity-60">SUGGESTED</div>
              <div className="eh-mono text-xs eh-neon">{sym}{Number(target.suggested_amount || 0).toLocaleString('en-IN')}</div>
            </div>
            {order && (
              <>
                <div>
                  <div className="eh-mono text-[9px] tracking-widest opacity-60">SERVICE</div>
                  <div className="text-xs">{order.serviceName || order.service_name || order.service || '—'}</div>
                </div>
                <div>
                  <div className="eh-mono text-[9px] tracking-widest opacity-60">ORDER STATUS</div>
                  <div className="eh-mono text-xs">{(order.status || '—').toUpperCase()}</div>
                </div>
              </>
            )}
            <div>
              <div className="eh-mono text-[9px] tracking-widest opacity-60">CUSTOMER</div>
              <div className="text-xs break-all">{usr ? `${usr.name || ''} · ${usr.email}` : order ? (order.name || order.email || '—') : '—'}</div>
            </div>
            <div>
              <div className="eh-mono text-[9px] tracking-widest opacity-60">WALLET BALANCE</div>
              <div className="eh-mono text-xs">{usr ? `${sym}${Number(usr.balance || 0).toLocaleString('en-IN')}` : <span className="opacity-50">— no linked account</span>}</div>
            </div>
          </div>

          {target.existing_refunds?.length > 0 && (
            <div className="rounded border border-amber-400/40 bg-amber-400/5 p-3 text-xs eh-mono flex items-start gap-2">
              <AlertTriangle size={12} className="text-amber-300 mt-0.5 shrink-0" />
              <div>
                <span className="text-amber-200">{target.existing_refunds.length} existing refund record(s)</span> for this order — re-issuing will <b>update</b> the latest record instead of duplicating.
                <div className="opacity-70 mt-1">{target.existing_refunds.map(r => `${r.id}·${r.status}·${sym}${r.refund_amount || r.order_amount}`).join('  ·  ')}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="eh-mono text-[10px] opacity-60 tracking-widest mb-1 block">REFUND AMOUNT (₹)</label>
              <input type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} className="eh-input text-sm w-full" data-testid="admin-issue-refund-amount" />
            </div>
            <div>
              <label className="eh-mono text-[10px] opacity-60 tracking-widest mb-1 block">METHOD</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="eh-input text-sm w-full" data-testid="admin-issue-refund-method">
                <option value="wallet">WALLET (instant)</option>
                <option value="upi">UPI (manual)</option>
                <option value="crypto">CRYPTO (manual)</option>
                <option value="manual">MANUAL / OTHER</option>
              </select>
            </div>
          </div>

          <div>
            <label className="eh-mono text-[10px] opacity-60 tracking-widest mb-1 block">REASON / NOTE</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Shown to customer · e.g. service unavailable, customer request" className="eh-input text-sm w-full resize-none" data-testid="admin-issue-refund-reason" />
          </div>

          <button onClick={issue} disabled={issuing || !amount} data-testid="admin-issue-refund-submit" className="eh-btn-primary text-sm w-full justify-center inline-flex items-center gap-2 disabled:opacity-50">
            {issuing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {issuing ? 'PROCESSING…' : `ISSUE ${sym}${Number(amount || 0).toLocaleString('en-IN')} REFUND`}
          </button>
        </div>
      )}
    </div>
  );
};

const RefundsManager = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('requested');
  const [busyId, setBusyId] = useState('');
  const [open, setOpen] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.adminRefunds(filter === 'all' ? '' : filter);
      setRows(r || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  const approve = async (r) => {
    const amt = window.prompt(`Approve refund — credit wallet with how much?\n(Default = order amount ₹${r.order_amount})`, String(r.order_amount || 0));
    if (amt === null) return;
    const amount = parseFloat(amt);
    if (!(amount > 0)) { toast.error('Enter a positive amount'); return; }
    if (!window.confirm(`Approve ₹${amount} refund (instant wallet credit) for ${r.user_email}?`)) return;
    setBusyId(r.id);
    try {
      await api.adminRefundUpdate(r.id, { status: 'approved', refund_amount: amount, refund_method: 'wallet' });
      toast.success('Approved · wallet credited');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(''); }
  };
  const reject = async (r) => {
    const note = window.prompt('Reason for rejection (shown to customer):', '');
    if (note === null) return;
    setBusyId(r.id);
    try {
      await api.adminRefundUpdate(r.id, { status: 'rejected', admin_note: note });
      toast.success('Rejected · user notified');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(''); }
  };
  const review = async (r) => {
    setBusyId(r.id);
    try {
      await api.adminRefundUpdate(r.id, { status: 'reviewing' });
      toast.success('Marked under review');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(''); }
  };

  return (
    <div className="space-y-5" data-testid="admin-refunds-manager">
      <IssueByTrackingPanel onIssued={() => load()} />
      <div className="eh-panel p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="eh-mono text-[10px] tracking-widest opacity-60 mb-1">// REFUNDS</div>
            <div className="eh-display text-xl font-black">Refund Requests <span className="eh-mono text-sm opacity-60">({rows.length})</span></div>
          </div>
          <div className="flex gap-2 items-center">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="eh-input text-xs py-1.5" data-testid="admin-refunds-filter">
              <option value="requested">Requested</option>
              <option value="reviewing">Reviewing</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
            <button onClick={load} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="admin-refunds-refresh">
              <RefreshCw size={12} /> REFRESH
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center min-h-[120px]"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="eh-mono text-xs opacity-60 text-center py-8">No {filter} refunds.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full eh-mono text-xs min-w-[820px]">
              <thead className="bg-[rgba(255,255,255,.03)] text-[10px] tracking-widest opacity-70">
                <tr>
                  <th className="text-left p-2">REFUND</th>
                  <th className="text-left p-2">ORDER</th>
                  <th className="text-left p-2">USER</th>
                  <th className="text-left p-2">AMOUNT</th>
                  <th className="text-left p-2">STATUS</th>
                  <th className="text-left p-2">DATE</th>
                  <th className="text-right p-2">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-[var(--eh-border)]" data-testid={`admin-refund-row-${r.id}`}>
                    <td className="p-2 align-top">
                      <button onClick={() => setOpen(r)} className="text-[var(--eh-green)] hover:underline inline-flex items-center gap-1" data-testid={`admin-refund-open-${r.id}`}>
                        {r.id} <FileText size={10} />
                      </button>
                    </td>
                    <td className="p-2 align-top">
                      <div className="opacity-80">{r.order_id}</div>
                      <div className="opacity-50 text-[10px]">{(r.order_service || '').slice(0, 32)}</div>
                    </td>
                    <td className="p-2 align-top">
                      <div>{r.user_email || '—'}</div>
                      <div className="opacity-50 text-[10px]">{r.user_id}</div>
                    </td>
                    <td className="p-2 align-top font-bold">₹{Number(r.order_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="p-2 align-top">
                      <span className={`inline-block px-2 py-0.5 rounded border eh-mono text-[10px] tracking-widest ${STATUS_BADGE[r.status] || ''}`}>
                        {(r.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 align-top opacity-60 text-[10px]">{(r.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-2 align-top text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {r.status === 'requested' && (
                          <button onClick={() => review(r)} disabled={busyId === r.id} className="eh-btn-ghost text-[10px] inline-flex items-center gap-1" data-testid={`admin-refund-review-${r.id}`}>
                            <Clock size={10} /> REVIEW
                          </button>
                        )}
                        {['requested', 'reviewing'].includes(r.status) && (
                          <>
                            <button onClick={() => approve(r)} disabled={busyId === r.id} className="eh-btn-primary text-[10px] inline-flex items-center gap-1" data-testid={`admin-refund-approve-${r.id}`}>
                              {busyId === r.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} APPROVE
                            </button>
                            <button onClick={() => reject(r)} disabled={busyId === r.id} className="text-[10px] eh-mono tracking-widest px-2 py-1.5 rounded border border-red-400/40 text-red-400 hover:bg-red-400/10 inline-flex items-center gap-1" data-testid={`admin-refund-reject-${r.id}`}>
                              <X size={10} /> REJECT
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setOpen(null)}>
          <div className="eh-panel p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="eh-mono text-[10px] opacity-60">// REFUND</div>
                <div className="eh-display text-lg font-black eh-neon-soft">{open.id}</div>
              </div>
              <button onClick={() => setOpen(null)} className="eh-btn-ghost text-xs"><X size={12} /></button>
            </div>
            <div className="space-y-2 eh-mono text-xs">
              <Row k="ORDER" v={open.order_id} />
              <Row k="SERVICE" v={open.order_service || '—'} />
              <Row k="USER" v={`${open.user_email} (${open.user_id})`} />
              <Row k="STATUS" v={(open.status || '').toUpperCase()} />
              <Row k="ORDER AMOUNT" v={`₹${Number(open.order_amount || 0).toLocaleString('en-IN')}`} />
              {open.refund_amount > 0 && <Row k="REFUND AMOUNT" v={`₹${Number(open.refund_amount).toLocaleString('en-IN')}  via ${open.refund_method || 'wallet'}`} />}
              {open.admin_note && <Row k="ADMIN NOTE" v={open.admin_note} />}
              <div className="pt-3">
                <div className="opacity-60 mb-1.5">REASON</div>
                <div className="p-3 border border-[var(--eh-border)] rounded leading-6">{open.reason}</div>
              </div>
              {open.proof_url && <div className="pt-2"><a href={open.proof_url} target="_blank" rel="noreferrer" className="text-[var(--eh-green)] hover:underline inline-flex items-center gap-1.5"><ExternalLink size={11} /> View attached proof</a></div>}
              <div className="pt-3">
                <div className="opacity-60 mb-1.5">TIMELINE</div>
                <div className="space-y-1.5">
                  {(open.timeline || []).map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <div className="w-2 h-2 rounded-full bg-[var(--eh-green)] mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div><b>{(t.status || '').toUpperCase()}</b> · <span className="opacity-60">{(t.at || '').slice(0, 19).replace('T', ' ')}</span></div>
                        {t.note && <div className="opacity-70 mt-0.5">{t.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ k, v }) => (
  <div className="flex items-start justify-between gap-3 py-1 border-b border-dashed border-[var(--eh-border)]/60 last:border-0">
    <span className="opacity-60 shrink-0">{k}</span>
    <span className="text-right break-all">{v}</span>
  </div>
);

export default RefundsManager;
