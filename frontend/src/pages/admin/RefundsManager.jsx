import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Check, X, Clock, Wallet as WalletIcon, RotateCcw, ExternalLink, FileText } from 'lucide-react';
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
