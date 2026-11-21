import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowRight, Landmark, Loader2, X, Clock } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import {
    accountPayload,
    accountProblem,
    accountSummary,
    amountProblem,
    cleanAmountInput,
    emptyAccountForm,
    formatRupees,
    historyBadge,
    MIN_WITHDRAWAL,
} from '@shared/utils/walletWithdraw';

const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + time;
};

const TONES = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
};

const inputCls =
    'w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 placeholder:text-slate-400 placeholder:font-normal';

const WalletPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [wallet, setWallet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [open, setOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(false);
    const [form, setForm] = useState(emptyAccountForm());
    const [amount, setAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await customerApi.getWallet();
            setWallet(res.data?.result || null);
            setLoadError('');
        } catch (err) {
            setLoadError(err?.response?.data?.message || 'Could not load your wallet. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const balance = wallet?.balance ?? 0;
    const hasAccount = Boolean(wallet?.account);
    const useSaved = hasAccount && !editingAccount;
    const canWithdraw = balance >= MIN_WITHDRAWAL;

    const openSheet = () => {
        setError('');
        setAmount('');
        setEditingAccount(false);
        setForm(emptyAccountForm(wallet?.account?.method || 'bank'));
        setOpen(true);
    };

    const startEditing = () => {
        setEditingAccount(true);
        setForm(emptyAccountForm(wallet?.account?.method || 'bank'));
    };

    const set = (patch) => {
        setError('');
        setForm((f) => ({ ...f, ...patch }));
    };

    const submit = async () => {
        if (submitting) return;
        const amountMsg = amountProblem(amount, balance);
        if (amountMsg) return setError(amountMsg);
        if (!useSaved) {
            const accMsg = accountProblem(form);
            if (accMsg) return setError(accMsg);
        }
        setSubmitting(true);
        setError('');
        try {
            await customerApi.withdrawWallet({
                amount: Number(amount),
                ...(useSaved ? {} : { account: accountPayload(form) }),
            });
            showToast('Request sent. We will send the money to your account soon.', 'success');
            setOpen(false);
            await load();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not send your request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f1f4f8] pb-16 font-['Outfit',_sans-serif]">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-2 border-b border-slate-100 mb-2 flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1">
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Wallet</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs">
                    <p className="text-xs font-bold text-slate-800 tracking-tight">Refund Wallet</p>
                    <h2 data-testid="wallet-balance" className="text-3xl sm:text-4xl font-black text-slate-900 mt-1.5 leading-none tracking-tight">
                        {loading ? '...' : formatRupees(balance)}
                    </h2>
                    <p className="text-xs font-semibold text-slate-400 mt-1.5">
                        Money from your returns and cancelled orders. You can send it to your bank account or UPI.
                    </p>

                    {loadError && <p data-testid="wallet-load-error" className="mt-3 text-xs font-bold text-rose-600">{loadError}</p>}

                    {wallet?.inProcess > 0 && (
                        <div data-testid="wallet-in-process" className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs font-semibold text-amber-800">
                            <Clock size={14} className="mt-0.5 shrink-0" />
                            <span>{formatRupees(wallet.inProcess)} is waiting to be sent to your account.</span>
                        </div>
                    )}

                    {hasAccount && (
                        <p data-testid="wallet-account" className="mt-4 text-xs font-semibold text-slate-500">
                            Money goes to: <span className="text-slate-800">{accountSummary(wallet.account)}</span>
                        </p>
                    )}

                    <button
                        data-testid="withdraw-open"
                        onClick={openSheet}
                        disabled={loading || !canWithdraw}
                        className="mt-5 h-11 px-6 rounded-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] text-white font-black text-[12px] flex items-center gap-2 shadow-2xs active:scale-95 transition-all select-none disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                        <Landmark size={15} />
                        <span>Withdraw to Bank</span>
                        <ArrowRight size={14} strokeWidth={3} />
                    </button>
                    {!loading && !canWithdraw && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-400">
                            You can withdraw once you have at least {formatRupees(MIN_WITHDRAWAL)} in your wallet.
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                        <h3 className="text-base font-bold text-slate-800">History</h3>
                    </div>

                    {loading ? (
                        <div className="py-6 flex justify-center text-slate-400 text-sm font-semibold">Loading...</div>
                    ) : !wallet || wallet.history.length === 0 ? (
                        <div className="py-6 flex flex-col items-center justify-center text-center px-6">
                            <p className="text-sm font-semibold text-slate-500 mb-1">No refunds yet</p>
                            <p className="text-xs text-slate-400">Refunds for returned or cancelled orders will appear here.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {wallet.history.map((tx) => {
                                const badge = historyBadge(tx);
                                const credit = tx.type === 'credit';
                                return (
                                    <div key={tx.id} data-testid="history-item" className="px-4 py-3.5 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm">{tx.title}</h4>
                                            <p className="text-[11px] font-medium text-slate-500">{formatDate(tx.date)}</p>
                                            {tx.orderId && <p className="text-[10px] text-slate-400">Order #{tx.orderId}</p>}
                                            {badge && (
                                                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${TONES[badge.tone]}`}>
                                                    {badge.text}
                                                </span>
                                            )}
                                            {tx.reference && <p className="text-[10px] text-slate-400 mt-1">Reference: {tx.reference}</p>}
                                            {tx.reason && <p className="text-[11px] text-rose-600 font-semibold mt-1">Reason: {tx.reason}</p>}
                                        </div>
                                        <div className={`text-sm font-bold shrink-0 ${credit ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {credit ? '+' : '-'}{formatRupees(tx.amount)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {open && (
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" data-testid="withdraw-sheet">
                    <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setOpen(false)} />
                    <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 pb-28 sm:pb-5 max-h-[92vh] overflow-y-auto space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900">Withdraw to your account</h3>
                            <button onClick={() => !submitting && setOpen(false)} className="p-2 -mr-2 rounded-full hover:bg-slate-100">
                                <X size={18} />
                            </button>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-slate-600">Amount (you have {formatRupees(balance)})</label>
                                <button type="button" data-testid="withdraw-all" onClick={() => { setError(''); setAmount(String(balance)); }} className="text-xs font-black text-emerald-700">
                                    Withdraw all
                                </button>
                            </div>
                            <input
                                data-testid="withdraw-amount"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => { setError(''); setAmount(cleanAmountInput(e.target.value)); }}
                                placeholder={`Minimum ${formatRupees(MIN_WITHDRAWAL)}`}
                                className={inputCls}
                            />
                        </div>

                        {useSaved ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-500">Send money to</p>
                                    <p data-testid="saved-account" className="text-sm font-bold text-slate-900 truncate">{accountSummary(wallet.account)}</p>
                                </div>
                                <button type="button" data-testid="change-account" onClick={startEditing} className="text-xs font-black text-emerald-700 shrink-0">
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    {[['bank', 'Bank account'], ['upi', 'UPI ID']].map(([m, label]) => (
                                        <button
                                            key={m}
                                            type="button"
                                            data-testid={`method-${m}`}
                                            onClick={() => set({ method: m })}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${form.method === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {form.method === 'bank' ? (
                                    <>
                                        <input data-testid="acc-holder" value={form.holderName} onChange={(e) => set({ holderName: e.target.value })} placeholder="Account holder name" className={inputCls} />
                                        <input data-testid="acc-bank" value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="Bank name" className={inputCls} />
                                        <input data-testid="acc-number" inputMode="numeric" value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value.replace(/[^0-9 ]/g, '') })} placeholder="Account number" className={inputCls} />
                                        <input data-testid="acc-ifsc" value={form.ifsc} onChange={(e) => set({ ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })} placeholder="IFSC code (like SBIN0001234)" className={inputCls} />
                                    </>
                                ) : (
                                    <input data-testid="acc-upi" value={form.upiId} onChange={(e) => set({ upiId: e.target.value.replace(/\s/g, '') })} placeholder="UPI ID (like name@bank)" className={inputCls} />
                                )}
                                {hasAccount && (
                                    <button type="button" onClick={() => { setEditingAccount(false); setError(''); }} className="text-xs font-bold text-slate-500">
                                        Use my saved account instead
                                    </button>
                                )}
                            </div>
                        )}

                        {error && <p data-testid="withdraw-error" className="text-xs font-bold text-rose-600">{error}</p>}

                        <button
                            type="button"
                            data-testid="withdraw-submit"
                            onClick={submit}
                            disabled={submitting}
                            className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                            {submitting ? 'Sending...' : amount ? `Withdraw ${formatRupees(amount)}` : 'Withdraw'}
                        </button>
                        <p className="text-[11px] text-slate-400 text-center">
                            The amount leaves your wallet now. If we cannot send it, it comes back to your wallet.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletPage;
