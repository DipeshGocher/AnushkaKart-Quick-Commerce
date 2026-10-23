import React, { useState, useEffect } from "react";
import {
    IndianRupee,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    ArrowUpRight,
    Wallet,
    AlertCircle,
    RotateCw,
    ChevronLeft,
    ArrowRight,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Button from "@/shared/components/ui/Button";
import { deliveryApi } from "../../services/deliveryApi";
import { useAuth } from "@core/context/AuthContext";

const Withdrawals = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [stats, setStats] = useState({
        availableBalance: 0,
        pendingWithdrawals: 0,
        history: []
    });

    const fetchData = async () => {
        try {
            setFetching(true);
            // Fetch both dedicated withdrawals endpoint and wallet summary for guaranteed consistency
            const [wdrRes, walletRes] = await Promise.allSettled([
                deliveryApi.getWithdrawals(),
                deliveryApi.getWalletSummary()
            ]);

            let available = 0;
            let pending = 0;
            let historyList = [];

            if (wdrRes.status === 'fulfilled' && wdrRes.value?.data?.success) {
                const resData = wdrRes.value.data.result || {};
                available = Number(resData.availableBalance) || 0;
                pending = Number(resData.pendingWithdrawals) || 0;
                const rawHistory = resData.history || resData.transactions || [];
                historyList = Array.isArray(rawHistory) ? rawHistory : [];
            } else {
                // Secondary fallback: getEarnings
                try {
                    const earnRes = await deliveryApi.getEarnings();
                    if (earnRes?.data?.success) {
                        const result = earnRes.data.result || {};
                        const txs = result.transactions || result.recentTransactions || [];
                        const settledEarnings = (result.totalEarnings || 0);
                        const settledWithdrawals = txs
                            .filter(t => t.type?.includes('Withdrawal') && t.status === 'Settled')
                            .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
                        const pendingPayouts = txs
                            .filter(t => t.type?.includes('Withdrawal') && (t.status === 'Pending' || t.status === 'Processing'))
                            .reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
                        
                        available = Math.max(0, settledEarnings - settledWithdrawals - pendingPayouts);
                        pending = pendingPayouts;
                        historyList = txs.filter(t => t.type?.includes('Withdrawal'));
                    }
                } catch (e) {
                    console.error("Secondary earnings fetch failed:", e);
                }
            }

            // If wallet summary gave a verified positive availableBalance, prioritize or sync it
            if (walletRes.status === 'fulfilled' && walletRes.value?.data?.success) {
                const wSummary = walletRes.value.data.result || {};
                if (typeof wSummary.availableBalance === 'number' && wSummary.availableBalance >= 0) {
                    available = wSummary.availableBalance;
                }
                if (typeof wSummary.pendingBalance === 'number' && wSummary.pendingBalance >= 0) {
                    pending = wSummary.pendingBalance;
                }
            }

            setStats({
                availableBalance: available,
                pendingWithdrawals: pending,
                history: historyList
            });
        } catch (error) {
            console.error("Fetch Error:", error);
            toast.error("Failed to load withdrawal data");
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRequest = async () => {
        const numAmount = Number(amount);
        if (!amount || isNaN(numAmount) || numAmount <= 0) {
            return toast.error("Please enter a valid amount");
        }
        if (numAmount > stats.availableBalance) {
            return toast.error(`Insufficient balance. Max withdrawable: ₹${stats.availableBalance.toLocaleString()}`);
        }

        const hasPayoutDestination = Boolean(
            user?.bankDetails?.accountNumber || user?.accountNumber ||
            user?.bankDetails?.upiId || user?.upiId
        );
        if (!hasPayoutDestination) {
            toast.error("Please link your Bank Account or UPI ID first in Bank Account page.");
            setIsModalOpen(false);
            navigate("/delivery/profile/bank-account");
            return;
        }

        setLoading(true);
        try {
            const res = await deliveryApi.requestWithdrawal({ amount: numAmount });
            if (res.data.success) {
                toast.success("Withdrawal request submitted successfully!");
                setIsModalOpen(false);
                setAmount("");
                await fetchData();
            } else {
                toast.error(res.data.message || "Failed to submit request");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to submit request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f1f4f8] pb-36 font-['Outfit',_sans-serif]">
            {/* Top Header */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-2 border-b border-slate-100 mb-2 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Withdrawals</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                {/* Balance Card */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs flex items-center justify-between overflow-hidden relative card-left-pill-orange">
                    {/* Left Column */}
                    <div className="flex flex-col items-start text-left">
                        <p className="text-xs font-bold text-slate-800 tracking-tight">Available Balance</p>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1.5 leading-none tracking-tight">
                            ₹{stats.availableBalance.toLocaleString()}
                        </h2>
                        
                        <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <Clock size={12} />
                            <span>Pending: ₹{stats.pendingWithdrawals.toLocaleString()}</span>
                        </div>
                        
                        <button 
                            onClick={() => {
                                if (stats.availableBalance <= 0) {
                                    return toast.error("No available balance to withdraw");
                                }
                                setIsModalOpen(true);
                            }}
                            disabled={stats.availableBalance <= 0}
                            className="mt-4 h-9 px-4 rounded-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#2e7d32]/95 hover:to-[#1b5e20]/95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-[11px] flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all select-none"
                        >
                            <span>Withdraw Funds</span>
                            <ArrowRight size={13} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Right Column */}
                    <div className="w-[140px] h-[120px] flex items-center justify-center shrink-0">
                        <img 
                            src="/wallet iamge .png" 
                            alt="Wallet Illustration" 
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                {/* History */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden card-left-pill-orange">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-800">Transfer History</h3>
                        <button
                            onClick={fetchData}
                            className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0 hover:bg-slate-100 transition-colors"
                        >
                            <RotateCw size={18} className={fetching ? "animate-spin" : ""} />
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {stats.history.length > 0 ? (
                            stats.history.map((item, idx) => {
                                const itemId = item.reference || item.id || item._id || `WDR-${idx}`;
                                const itemDate = item.createdAt || item.date;
                                const formattedDate = itemDate
                                    ? new Date(itemDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : 'Recent';
                                const itemAmount = Math.abs(Number(item.amount) || 0);
                                const isSettled = item.status === 'Settled' || item.status === 'settled';
                                const isFailed = item.status === 'Failed' || item.status === 'failed';

                                return (
                                    <div key={itemId} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-2xs shrink-0 ${
                                                isSettled ? 'bg-teal-50/80 border-teal-100 text-teal-700' :
                                                isFailed ? 'bg-red-50 border-red-100 text-red-700' :
                                                'bg-amber-50 border-amber-100 text-amber-700'
                                            }`}>
                                                {isSettled ? <CheckCircle2 size={18} /> :
                                                 isFailed ? <XCircle size={18} /> :
                                                 <Clock size={18} />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">₹{itemAmount.toLocaleString()}</h4>
                                                <p className="text-[11px] font-medium text-slate-500">
                                                    {formattedDate} • {itemId}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`text-[10px] font-bold px-2 py-1 rounded leading-none ${
                                            isSettled ? 'bg-emerald-50 text-emerald-700' : 
                                            isFailed ? 'bg-red-50 text-red-600' : 
                                            'bg-amber-50 text-amber-600'
                                        }`}>
                                            {(item.status || 'PENDING').toUpperCase()}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-8 flex flex-col items-center justify-center text-center px-6">
                                <Clock className="mx-auto text-slate-300 mb-2" size={32} />
                                <p className="text-sm font-semibold text-slate-500 mb-1">No history found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Withdrawal Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-sm relative z-10 overflow-hidden shadow-2xl border border-slate-100"
                        >
                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Wallet size={18} className="text-[#6666FF]" />
                                    Withdraw Funds
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-5 space-y-5">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                            Amount to Withdraw
                                        </label>
                                        {stats.availableBalance > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setAmount(String(stats.availableBalance))}
                                                className="text-[11px] font-bold text-[#6666FF] hover:text-[#5555EE] transition-colors"
                                            >
                                                Withdraw All (₹{stats.availableBalance.toLocaleString()})
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 font-bold text-xl outline-none focus:border-[#6666FF] focus:ring-2 focus:ring-[#6666FF]/20 transition-all"
                                        />
                                    </div>
                                </div>

                                {user?.bankDetails?.upiId || user?.upiId || user?.bankDetails?.accountNumber || user?.accountNumber ? (
                                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 text-xs">
                                        <p className="font-bold text-emerald-900 mb-0.5">Transfer Destination:</p>
                                        {user?.bankDetails?.upiId || user?.upiId ? (
                                            <p className="font-mono text-emerald-700 font-bold">UPI: {user?.bankDetails?.upiId || user?.upiId}</p>
                                        ) : null}
                                        {user?.bankDetails?.accountNumber || user?.accountNumber ? (
                                            <p className="text-emerald-700">
                                                {user?.bankDetails?.bankName || user?.bankName || "Bank"}: ••••{String(user?.bankDetails?.accountNumber || user?.accountNumber || "").slice(-4)} ({user?.bankDetails?.ifsc || user?.ifsc || ""})
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100/50">
                                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={16} />
                                        <p className="text-[11px] text-rose-700 font-medium leading-relaxed">
                                            No bank account or UPI linked yet. Please add your payout details first.
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100/50">
                                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                                    <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                                        Processing may take 24-48 business hours. Funds will be manually transferred by Admin to your linked Bank/UPI.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleRequest}
                                    disabled={loading || !amount || Number(amount) <= 0 || Number(amount) > stats.availableBalance}
                                    className="w-full py-3.5 rounded-xl font-bold text-sm shadow-md bg-[#6666FF] hover:bg-[#5555EE] text-white disabled:opacity-50"
                                >
                                    {loading ? <RotateCw className="animate-spin mr-2" size={18} /> : null}
                                    {loading ? "PROCESSING..." : "SUBMIT REQUEST"}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Withdrawals;
