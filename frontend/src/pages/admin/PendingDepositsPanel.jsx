import React, { useEffect, useState } from 'react';
import { Loader2, Check, X, RefreshCw, Receipt, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';

const PendingDepositsPanel = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.adminWalletDeposits(filter === 'all' ? '' : filter);
      setRows(r || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  const approve = async (d) => {
    if (!window.confirm(`Approve ₹${d.amount} for ${d.user_email || d.user_id}?`)) return;
    setBusyId(d.id);
    try {
      const r = await api.adminWalletApprove(d.id);
      if (r.ok) toast.success(`Approved · new balance ₹${(r.balance || 0).toLocaleString('en-IN')}`);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(''); }
  };
  const reject = async (d) => {
    const reason = window.prompt(`Reject ₹${d.amount} deposit?\nOptional reason (will be shown to user):`, '') ?? null;
    if (reason === null) return;
    setBusyId(d.id);
    try {
      await api.adminWalletReject(d.id, reason);
      toast.success('Rejected · user notified');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(''); }
  };
  const copy = (t) => { navigator.clipboard.writeText(t); toast.success('Copied'); };

  const STATUS_BADGE = {
    pending: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
    approved: 'border-[rgba(0,255,157,.4)] text-[var(--eh-green)] bg-[rgba(0,255,157,.08)]',
    rejected: 'border-red-400/40 text-red-300 bg-red-400/10',
  };

  return (
    <div className="eh-panel p-5 space-y-3" data-testid="admin-pending-deposits-panel">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="eh-mono text-xs tracking-widest opacity-70 flex items-center gap-2">
          <Receipt size={12} className="text-[var(--eh-green)]" /> // WALLET DEPOSITS ({rows.length})
        </div>
        <div className="flex gap-2 items-center">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="eh-input text-xs py-1.5" data-testid="admin-deposits-filter">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button onClick={load} className="eh-btn-ghost text-xs inline-flex items-center gap-1.5" data-testid="admin-deposits-refresh">
            <RefreshCw size={12} /> REFRESH
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center min-h-[120px]"><Loader2 className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="eh-mono text-xs opacity-60 text-center py-8">No {filter} deposits.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full eh-mono text-xs min-w-[760px]">
            <thead className="bg-[rgba(255,255,255,.03)] text-[10px] tracking-widest opacity-70">
              <tr>
                <th className="text-left p-2">USER</th>
                <th className="text-left p-2">AMOUNT</th>
                <th className="text-left p-2">METHOD</th>
                <th className="text-left p-2">REFERENCE</th>
                <th className="text-left p-2">STATUS</th>
                <th className="text-left p-2">DATE</th>
                <th className="text-right p-2">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => (
                <tr key={d.id} className="border-t border-[var(--eh-border)]" data-testid={`admin-deposit-row-${d.id}`}>
                  <td className="p-2 align-top">
                    <div className="text-[var(--eh-green)]">{d.user_email || '—'}</div>
                    <div className="opacity-50 text-[10px]">{d.user_id}</div>
                  </td>
                  <td className="p-2 align-top font-bold text-sm">₹{Number(d.amount).toLocaleString('en-IN')}</td>
                  <td className="p-2 align-top">
                    <div className="uppercase">{d.method}</div>
                    {d.coin && <div className="opacity-50 text-[10px]">{d.coin}</div>}
                  </td>
                  <td className="p-2 align-top break-all max-w-[220px]">
                    <button onClick={() => copy(d.tx_reference || '')} className="inline-flex items-center gap-1 hover:text-[var(--eh-green)]" title="Copy">
                      {d.tx_reference || '—'} {d.tx_reference && <Copy size={10} className="opacity-60" />}
                    </button>
                  </td>
                  <td className="p-2 align-top">
                    <span className={`inline-block px-2 py-0.5 rounded border eh-mono text-[10px] tracking-widest ${STATUS_BADGE[d.status] || ''}`}>
                      {(d.status || '').toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 align-top opacity-60 text-[10px]">{(d.createdAt || '').slice(0, 16).replace('T', ' ')}</td>
                  <td className="p-2 align-top text-right">
                    {d.status === 'pending' ? (
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => approve(d)} disabled={busyId === d.id} className="eh-btn-primary text-[10px] inline-flex items-center gap-1" data-testid={`admin-deposit-approve-${d.id}`}>
                          {busyId === d.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} APPROVE
                        </button>
                        <button onClick={() => reject(d)} disabled={busyId === d.id} className="text-[10px] eh-mono tracking-widest px-2.5 py-1.5 rounded border border-red-400/40 text-red-400 hover:bg-red-400/10 inline-flex items-center gap-1" data-testid={`admin-deposit-reject-${d.id}`}>
                          <X size={10} /> REJECT
                        </button>
                      </div>
                    ) : (
                      <span className="opacity-40 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingDepositsPanel;
