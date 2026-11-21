import React, { useCallback, useEffect, useState } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { Banknote, CheckCircle2, Clock, Copy, Loader2, RotateCw, Search, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { formatRupees } from '@shared/utils/walletWithdraw';

const TABS = [
    ['pending', 'Pending'],
    ['paid', 'Paid'],
    ['rejected', 'Rejected'],
    ['all', 'All'],
];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

function Detail({ label, value, copy }) {
    if (!value) return null;
    return (
        <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-semibold">{label}</span>
            <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                {value}
                {copy && (
                    <button
                        type="button"
                        title="Copy"
                        onClick={() => {
                            navigator.clipboard?.writeText(String(value));
                            toast.success(`${label} copied`);
                        }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400"
                    >
                        <Copy className="h-3 w-3" />
                    </button>
                )}
            </span>
        </div>
    );
}

function AccountBlock({ item }) {
    const a = item.account || {};
    if (item.method === 'upi') {
        return (
            <div className="space-y-1">
                <Detail label="UPI ID" value={a.upiId} copy />
                <Detail label="Name" value={a.holderName} />
            </div>
        );
    }
    return (
        <div className="space-y-1">
            <Detail label="Account holder" value={a.holderName} />
            <Detail label="Bank" value={a.bankName} />
            <Detail label="Account no." value={a.accountNumber} copy />
            <Detail label="IFSC" value={a.ifsc} copy />
        </div>
    );
}

const CustomerRefundRequests = () => {
    const [status, setStatus] = useState('pending');
    const [search, setSearch] = useState('');
    const [items, setItems] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ type: null, item: null, text: '' });
    const [busy, setBusy] = useState(false);
    const [modalError, setModalError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getCustomerWithdrawals({ status, search: search.trim() || undefined, limit: 50 });
            const r = res.data?.result || {};
            setItems(Array.isArray(r.items) ? r.items : []);
            setStats(r.stats || null);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not load customer refund requests');
        } finally {
            setLoading(false);
        }
    }, [status, search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    const close = () => !busy && setModal({ type: null, item: null, text: '' });

    const confirm = async () => {
        const { type, item, text } = modal;
        setBusy(true);
        setModalError('');
        try {
            if (type === 'pay') {
                await adminApi.payCustomerWithdrawal(item.id, { reference: text });
                toast.success('Marked as paid. The customer has been told.');
            } else {
                await adminApi.rejectCustomerWithdrawal(item.id, { reason: text });
                toast.success('Request rejected. The money is back in the customer\'s wallet.');
            }
            setModal({ type: null, item: null, text: '' });
            await load();
        } catch (err) {
            setModalError(err?.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-6" data-testid="customer-refunds">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-amber-50"><Clock className="h-6 w-6 text-amber-500" /></div>
                        <div>
                            <p className="ds-label mb-1 text-slate-400">Waiting to be paid</p>
                            <h3 data-testid="cw-stat-pending" className="ds-stat-medium text-slate-900">{stats?.pendingCount ?? 0}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-brand-50"><Banknote className="h-6 w-6 text-brand-600" /></div>
                        <div>
                            <p className="ds-label mb-1 text-slate-400">Amount to pay</p>
                            <h3 data-testid="cw-stat-amount" className="ds-stat-medium text-slate-900">{formatRupees(stats?.pendingAmount ?? 0)}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-emerald-50"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
                        <div>
                            <p className="ds-label mb-1 text-slate-400">Paid so far</p>
                            <h3 className="ds-stat-medium text-slate-900">{formatRupees(stats?.paidAmount ?? 0)}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                    {TABS.map(([key, label]) => (
                        <button
                            key={key}
                            data-testid={`cw-tab-${key}`}
                            onClick={() => setStatus(key)}
                            className={cn('px-4 py-2 rounded-lg text-xs font-bold transition-all', status === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            data-testid="cw-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search customer name, phone, reference..."
                            className="pl-10 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/20 w-72"
                        />
                    </div>
                    <button onClick={load} disabled={loading} title="Refresh" className="p-2.5 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 disabled:opacity-50">
                        <RotateCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <Card className="border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden">
                {loading && items.length === 0 ? (
                    <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
                ) : items.length === 0 ? (
                    <div className="py-16 text-center text-sm font-semibold text-slate-400" data-testid="cw-empty">
                        No {status === 'all' ? '' : status} customer refund requests.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                    <th className="px-5 py-3">Requested</th>
                                    <th className="px-5 py-3">Customer</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                    <th className="px-5 py-3">Send to</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((it) => (
                                    <tr key={it.id} data-testid="cw-row" data-status={it.status} className="align-top">
                                        <td className="px-5 py-4 text-xs font-semibold text-slate-600 whitespace-nowrap">{fmtDate(it.requestedAt)}</td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-bold text-slate-900">{it.customer.name || 'Customer'}</p>
                                            <p className="text-xs font-mono text-slate-500">{it.customer.phone}</p>
                                        </td>
                                        <td className="px-5 py-4 text-right text-sm font-black text-slate-900">{formatRupees(it.amount)}</td>
                                        <td className="px-5 py-4 min-w-[260px]"><AccountBlock item={it} /></td>
                                        <td className="px-5 py-4">
                                            <Badge variant={it.status === 'pending' ? 'warning' : it.status === 'paid' ? 'success' : 'danger'} className="text-[10px] font-extrabold px-2.5 py-0.5 uppercase tracking-wide">
                                                {it.status}
                                            </Badge>
                                            {it.status === 'paid' && <p className="text-[10px] font-mono text-slate-500 mt-1">Ref: {it.reference}</p>}
                                            {it.status === 'rejected' && <p className="text-[10px] text-rose-600 mt-1 max-w-[180px]">{it.rejectionReason}</p>}
                                            {it.processedAt && <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(it.processedAt)}</p>}
                                        </td>
                                        <td className="px-5 py-4 text-right whitespace-nowrap">
                                            {it.status === 'pending' && (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        data-testid="cw-pay"
                                                        onClick={() => { setModalError(''); setModal({ type: 'pay', item: it, text: '' }); }}
                                                        className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-extrabold hover:bg-emerald-600 hover:text-white transition-all"
                                                    >
                                                        Mark as paid
                                                    </button>
                                                    <button
                                                        data-testid="cw-reject"
                                                        onClick={() => { setModalError(''); setModal({ type: 'reject', item: it, text: '' }); }}
                                                        className="px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-extrabold hover:bg-rose-600 hover:text-white transition-all"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal
                isOpen={!!modal.type}
                onClose={close}
                title={modal.type === 'pay' ? 'Mark as paid' : 'Reject this request'}
                size="md"
                footer={
                    <>
                        <button onClick={close} disabled={busy} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button
                            data-testid="cw-confirm"
                            onClick={confirm}
                            disabled={busy}
                            className={cn('px-5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 disabled:opacity-60', modal.type === 'pay' ? 'bg-emerald-600' : 'bg-rose-600')}
                        >
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {modal.type === 'pay' ? 'Yes, I have sent the money' : 'Reject and return the money'}
                        </button>
                    </>
                }
            >
                {modal.item && (
                    <div className="space-y-4">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                            <p className="text-sm font-bold text-slate-900">{modal.item.customer.name} · {formatRupees(modal.item.amount)}</p>
                            <AccountBlock item={modal.item} />
                        </div>
                        {modal.type === 'pay' ? (
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">Bank transfer reference / UTR</label>
                                <input
                                    data-testid="cw-ref-input"
                                    value={modal.text}
                                    onChange={(e) => { setModalError(''); setModal((m) => ({ ...m, text: e.target.value })); }}
                                    placeholder="Type the reference from your bank"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/25"
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5">Send the money from your bank first, then confirm here. The customer is told it was sent.</p>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1.5">Reason (the customer will see this)</label>
                                <textarea
                                    data-testid="cw-reason-input"
                                    value={modal.text}
                                    onChange={(e) => { setModalError(''); setModal((m) => ({ ...m, text: e.target.value })); }}
                                    rows={3}
                                    placeholder="For example: account name does not match"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-rose-500/25"
                                />
                                <p className="text-[11px] text-slate-400 mt-1.5">The money goes back to the customer&apos;s wallet and they can ask again.</p>
                            </div>
                        )}
                        {modalError && <p data-testid="cw-modal-error" className="text-xs font-bold text-rose-600 flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5" />{modalError}</p>}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CustomerRefundRequests;
