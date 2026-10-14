import React, { useState, useEffect, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    TrendingUp,
    DollarSign,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    Download,
    Search,
    ChevronRight,
    History,
    ArrowDownCircle,
    ArrowUpCircle,
    RotateCw,
    CircleDollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";

const AdminWallet = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [walletData, setWalletData] = useState({ stats: {}, transactions: {} });
    const [txnPage, setTxnPage] = useState(1);
    const [txnPageSize, setTxnPageSize] = useState(25);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // all, earnings, payouts
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            const params = { page, limit: txnPageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const [summaryRes, ledgerRes] = await Promise.all([
                adminApi.getFinanceSummary(),
                adminApi.getFinanceLedger(params)
            ]);

            if (summaryRes.data.success || ledgerRes.data.success) {
                const summary = summaryRes.data.result || {};
                const ledger = ledgerRes.data.result || {};
                const mappedTransactions = (ledger.items || []).map((entry) => {
                    const typeStr = String(entry.type || '').toUpperCase();
                    const isDebit = entry.direction === 'DEBIT' || typeStr.includes('PAYOUT') || typeStr.includes('REFUND') || typeStr.includes('WITHDRAWAL');

                    let displayStatus = String(entry.status || 'COMPLETED').toUpperCase();
                    if (typeStr.includes('PENDING')) {
                        displayStatus = 'PENDING';
                    }

                    return {
                        id: entry.transactionId || entry.reference || entry._id,
                        type: entry.type || "UNKNOWN",
                        amount: isDebit ? -Math.abs(entry.amount || 0) : Math.abs(entry.amount || 0),
                        status: displayStatus,
                        sender: isDebit ? "PLATFORM" : (entry.actorType || "CUSTOMER"),
                        recipient: isDebit ? (entry.actorType || "SELLER") : "PLATFORM_WALLET",
                        date: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "-",
                        time: entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
                        notes: entry.description || entry.type,
                        method: entry.paymentMode || "N/A",
                    };
                });

                setWalletData({
                    stats: {
                        totalPlatformEarning: summary.totalPlatformEarning || 0,
                        totalAdminEarning: summary.totalAdminEarning || 0,
                        availableBalance: summary.availableBalance || 0,
                        systemFloat: summary.systemFloatCOD || 0,
                        sellerPendingPayouts: summary.sellerPendingPayouts || 0,
                        deliveryPendingPayouts: summary.deliveryPendingPayouts || 0,
                    },
                    transactions: {
                        items: mappedTransactions,
                        page: ledger.page || page,
                        limit: ledger.limit || txnPageSize,
                        total: ledger.total || mappedTransactions.length,
                        totalPages: ledger.totalPages || 1,
                    },
                });
                if (ledger && typeof ledger.page === "number") setTxnPage(ledger.page);
            }
        } catch (error) {
            console.error("Admin Wallet Fetch Error:", error);
            toast.error("Failed to load finance data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txnPageSize, searchTerm]);

    useEffect(() => {
        fetchData(txnPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [txnPage]);

    // 4 Core Clean Metrics (No Duplication)
    const stats = [
        {
            label: 'Total Platform Sales',
            value: `₹${(walletData.stats?.totalPlatformEarning || 0).toLocaleString()}`,
            description: 'Gross order checkout turnover',
            icon: TrendingUp,
            bg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            actionText: null,
            actionPath: null
        },
        {
            label: 'Admin Net Profit / Fees',
            value: `₹${(walletData.stats?.totalAdminEarning || 0).toLocaleString()}`,
            description: 'Realized profit on delivered orders',
            icon: DollarSign,
            bg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            actionText: null,
            actionPath: null
        },
        {
            label: 'Current Cash with Riders',
            value: `₹${(walletData.stats?.systemFloat || 0).toLocaleString()}`,
            description: (walletData.stats?.systemFloat || 0) > 0 ? 'Pending to collect from riders' : 'All clear (Zero pending cash)',
            icon: CircleDollarSign,
            bg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            actionText: 'Collect Cash',
            actionPath: '/admin/cash-collection'
        },
        {
            label: 'Pending Seller Payouts',
            value: `₹${(walletData.stats?.sellerPendingPayouts || 0).toLocaleString()}`,
            description: 'Seller requests waiting for review',
            icon: CreditCard,
            bg: 'bg-rose-50',
            iconColor: 'text-rose-600',
            actionText: 'Review Requests',
            actionPath: '/admin/withdrawals'
        }
    ];

    const transactionsList = useMemo(() =>
        Array.isArray(walletData.transactions?.items) ? walletData.transactions.items : [],
        [walletData.transactions]);

    const txnTotal = useMemo(() =>
        typeof walletData.transactions?.total === 'number' ? walletData.transactions.total : transactionsList.length,
        [walletData.transactions, transactionsList]);

    const filteredTransactions = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        return transactionsList.filter(txn => {
            const matchesSearch =
                (txn.id || '').toLowerCase().includes(query) ||
                (txn.type || '').toLowerCase().includes(query) ||
                (txn.sender || '').toLowerCase().includes(query) ||
                (txn.recipient || '').toLowerCase().includes(query) ||
                (txn.notes || '').toLowerCase().includes(query) ||
                String(txn.amount || '').includes(query);

            const matchesTab = activeTab === 'all' ||
                (activeTab === 'earnings' && txn.amount > 0) ||
                (activeTab === 'payouts' && txn.amount < 0);

            return matchesSearch && matchesTab;
        });
    }, [transactionsList, searchTerm, activeTab]);

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const res = await adminApi.exportFinanceStatement();
            const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `finance_statement_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Statement exported successfully");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to export statement");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1">Admin Wallet & Finance</h1>
                    <p className="ds-description mt-1">Real-time financial turnover, platform revenue, and live transaction ledger.</p>
                </div>
                <div className="flex items-center flex-wrap gap-2.5">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        {isExporting ? <RotateCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isExporting ? 'EXPORTING...' : 'EXPORT STATEMENT'}
                    </button>
                    <button
                        onClick={() => navigate('/admin/withdrawals')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
                    >
                        <CreditCard className="h-4 w-4" />
                        MONEY REQUESTS
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* 4 Clean Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx}
                    >
                        <Card className="p-5 border-none shadow-sm ring-1 ring-slate-100 hover:ring-primary/20 transition-all hover:shadow-lg bg-white relative overflow-hidden flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                                        <stat.icon className={cn("h-5 w-5", stat.iconColor)} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Live</span>
                                        <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
                                    </div>
                                </div>
                                <p className="ds-label mb-1 text-[11px]">{stat.label}</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
                            </div>

                            <div className="pt-3 border-t border-slate-50 mt-4 flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-slate-400/90 truncate">
                                    {stat.description}
                                </p>
                                {stat.actionText && stat.actionPath && (
                                    <button
                                        onClick={() => navigate(stat.actionPath)}
                                        className="text-[10px] font-black text-primary hover:underline shrink-0 ml-2 flex items-center gap-0.5"
                                    >
                                        {stat.actionText}
                                        <ChevronRight className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Full-Width Spacious Transactions Table (Passbook) */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="ds-h2">Recent Transactions</h2>
                            <p className="text-xs text-slate-400 font-semibold">Live order inflows, rider cash collections, and seller payouts</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {[
                                { key: 'all', label: 'ALL' },
                                { key: 'earnings', label: 'INFLOWS (CREDIT)' },
                                { key: 'payouts', label: 'OUTFLOWS (DEBIT)' },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all",
                                        activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative group w-full sm:w-auto">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by ID, entity, amount..."
                                className="pl-9 pr-4 py-2 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 w-full sm:w-64 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-2xl">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/70 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8 py-3.5">Transaction Details</th>
                                    <th className="ds-table-header-cell py-3.5">Flow / Entities</th>
                                    <th className="ds-table-header-cell py-3.5 text-center">Payment Mode</th>
                                    <th className="ds-table-header-cell py-3.5 text-center">Amount</th>
                                    <th className="ds-table-header-cell py-3.5 text-center">Status</th>
                                    <th className="ds-table-header-cell py-3.5 text-right pr-8">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredTransactions.map((txn) => (
                                    <tr
                                        key={txn.id}
                                        onClick={() => setSelectedTransaction(txn)}
                                        className="group hover:bg-slate-50/60 transition-all cursor-pointer"
                                    >
                                        <td className="px-6 py-4.5 pl-8">
                                            <div className="flex items-center gap-3.5">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                                                    txn.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                                )}>
                                                    {txn.amount > 0 ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                                                        {txn.type.replace(/_/g, ' ').toUpperCase()}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                                                        {txn.id} • {txn.date} {txn.time !== '-' ? txn.time : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4.5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                                                    <span className="text-[11px] font-bold text-slate-700">{txn.recipient}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 opacity-60">
                                                    <ArrowUpRight className="h-3 w-3 text-rose-500" />
                                                    <span className="text-[10px] font-semibold text-slate-400">{txn.sender}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4.5 text-center">
                                            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-black uppercase">
                                                {txn.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4.5 text-center">
                                            <p className={cn(
                                                "text-sm font-black",
                                                txn.amount > 0 ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {txn.amount > 0 ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString()}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4.5 text-center">
                                            <Badge
                                                variant={txn.status === 'COMPLETED' || txn.status === 'SETTLED' ? 'success' : txn.status === 'PENDING' ? 'warning' : 'secondary'}
                                                className="text-[9px] font-black px-2.5 py-0.5"
                                            >
                                                {txn.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4.5 text-right pr-8">
                                            <button className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all text-slate-400 hover:text-primary active:scale-90">
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-slate-50 rounded-full mb-3">
                                                    <Search className="h-8 w-8 text-slate-300" />
                                                </div>
                                                <p className="text-slate-500 font-bold text-sm">No transactions found matching your criteria.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {txnTotal > 0 && (
                        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/30">
                            <Pagination
                                page={txnPage}
                                totalPages={Math.ceil(txnTotal / txnPageSize) || 1}
                                total={txnTotal}
                                pageSize={txnPageSize}
                                onPageChange={(p) => { setTxnPage(p); fetchData(p); }}
                                onPageSizeChange={(newSize) => {
                                    setTxnPageSize(newSize);
                                    setTxnPage(1);
                                }}
                                loading={loading}
                            />
                        </div>
                    )}
                </Card>
            </div>

            {/* Transaction Detail Modal */}
            <Modal
                isOpen={!!selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
                title="Transaction Details"
                size="md"
            >
                {selectedTransaction && (
                    <div className="space-y-6">
                        <div className="text-center pb-6 border-b border-slate-100">
                            <div className={cn(
                                "h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                                selectedTransaction.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                                {selectedTransaction.amount > 0 ? <ArrowDownCircle className="h-8 w-8" /> : <ArrowUpCircle className="h-8 w-8" />}
                            </div>
                            <h4 className="text-3xl font-black text-slate-900">
                                {selectedTransaction.amount > 0 ? '+' : '-'}₹{Math.abs(selectedTransaction.amount).toLocaleString()}
                            </h4>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedTransaction.status}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</p>
                                <p className="text-sm font-bold text-slate-900">{selectedTransaction.type.replace(/_/g, ' ').toUpperCase()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</p>
                                <p className="text-sm font-bold text-slate-900">{selectedTransaction.date} {selectedTransaction.time}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From</p>
                                <p className="text-sm font-bold text-slate-700">{selectedTransaction.sender}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To</p>
                                <p className="text-sm font-bold text-slate-700">{selectedTransaction.recipient}</p>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference ID</p>
                                <p className="text-sm font-mono font-bold text-slate-900">{selectedTransaction.id}</p>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</p>
                                <p className="text-sm font-bold text-slate-700">{selectedTransaction.method}</p>
                            </div>
                            <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes / Description</p>
                                <p className="text-xs font-medium text-slate-600 italic">"{selectedTransaction.notes}"</p>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => setSelectedTransaction(null)}
                                className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AdminWallet;
