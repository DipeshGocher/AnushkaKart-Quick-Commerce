import React, { useState, useEffect, useMemo } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    TrendingUp,
    DollarSign,
    Building2,
    Clock,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Download,
    Search,
    ChevronRight,
    ArrowRight,
    History,
    PieChart,
    BarChart3,
    ArrowDownCircle,
    ArrowUpCircle,
    RotateCw,
    CircleDollarSign,
    Receipt
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

    const stats = [
        {
            label: 'Total Order Sales (Gross)',
            value: `₹${(walletData.stats?.totalPlatformEarning || 0).toLocaleString()}`,
            description: 'Total order checkout turnover',
            icon: TrendingUp,
            color: 'blue',
            bg: 'bg-brand-50',
            iconColor: 'text-brand-500'
        },
        {
            label: 'Admin Net Profit / Fees',
            value: `₹${(walletData.stats?.totalAdminEarning || 0).toLocaleString()}`,
            description: 'Handling & platform commission',
            icon: DollarSign,
            color: 'purple',
            bg: 'bg-purple-50',
            iconColor: 'text-purple-500'
        },
        {
            label: 'Net Platform Balance',
            value: `₹${(walletData.stats?.availableBalance || 0).toLocaleString()}`,
            description: 'Sales volume minus pending liabilities',
            icon: Building2,
            color: 'emerald',
            bg: 'bg-brand-50',
            iconColor: 'text-brand-500'
        },
        {
            label: 'COD Cash with Riders',
            value: `₹${(walletData.stats?.systemFloat || 0).toLocaleString()}`,
            description: 'In-hand cash with delivery boys',
            icon: Clock,
            color: 'amber',
            bg: 'bg-orange-50',
            iconColor: 'text-orange-500'
        },
        {
            label: 'Pending Seller Withdrawals',
            value: `₹${(walletData.stats?.sellerPendingPayouts || 0).toLocaleString()}`,
            description: 'Requested payouts awaiting review',
            icon: CreditCard,
            color: 'rose',
            bg: 'bg-rose-50',
            iconColor: 'text-rose-500'
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
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1">Admin Wallet & Finance</h1>
                    <p className="ds-description mt-1">Real-time master financial metrics, order turnover, cash flow, and ledger passbook.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        {isExporting ? <RotateCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isExporting ? 'EXPORTING...' : 'EXPORT STATEMENT'}
                    </button>
                    <button
                        onClick={() => navigate('/admin/withdrawals')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                    >
                        <CreditCard className="h-4 w-4" />
                        REVIEW WITHDRAWALS
                        <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {stats.map((stat, idx) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx}
                    >
                        <Card className="px-5 py-4 border-none shadow-sm ring-1 ring-slate-100 hover:ring-primary/20 transition-all hover:shadow-xl bg-white group relative overflow-hidden h-full">
                            <div className="flex flex-col h-full relative z-10">
                                {/* Top Row: Icon and Live Status */}
                                <div className="flex justify-between items-center mb-3">
                                    <div className={cn("p-2 rounded-xl transition-all duration-500 group-hover:rotate-6", stat.bg)}>
                                        <stat.icon className={cn("h-4 w-4", stat.iconColor)} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Live</span>
                                        <div className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
                                    </div>
                                </div>

                                {/* Middle Row: Label and Value */}
                                <div className="mb-3">
                                    <p className="ds-label mb-1 text-[11px]">{stat.label}</p>
                                    <h3 className="text-xl font-black text-slate-900">{stat.value}</h3>
                                </div>

                                {/* Bottom Row: Description */}
                                <div className="pt-2 border-t border-slate-50 mt-auto">
                                    <p className="text-[10px] font-semibold text-slate-400/80 flex items-center gap-1.5">
                                        <span className="w-1 h-3 rounded-full bg-slate-100" />
                                        {stat.description}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Transaction History (Passbook) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                                <History className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="ds-h2">Recent Transactions</h2>
                                <p className="text-xs text-slate-400 font-semibold">Live ledger movements & settlement logs</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
                                {[
                                    { key: 'all', label: 'ALL' },
                                    { key: 'earnings', label: 'INFLOWS' },
                                    { key: 'payouts', label: 'OUTFLOWS' },
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all",
                                            activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative group w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search details..."
                                    className="pl-9 pr-4 py-2 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 w-full sm:w-48 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <Card className="border-none shadow-2xl ring-1 ring-slate-100/50 overflow-hidden bg-white rounded-[32px]">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <th className="ds-table-header-cell pl-8">Transaction Details</th>
                                        <th className="ds-table-header-cell">Entities</th>
                                        <th className="ds-table-header-cell text-center">Amount</th>
                                        <th className="ds-table-header-cell text-center">Status</th>
                                        <th className="ds-table-header-cell text-right pr-8">View</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredTransactions.map((txn) => (
                                        <tr
                                            key={txn.id}
                                            onClick={() => setSelectedTransaction(txn)}
                                            className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                                        >
                                            <td className="px-6 py-5 pl-8">
                                                <div className="flex items-center gap-3">
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
                                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                            {txn.id} • {txn.date} {txn.time !== '-' ? txn.time : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
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
                                            <td className="px-6 py-5 text-center">
                                                <p className={cn(
                                                    "text-sm font-black",
                                                    txn.amount > 0 ? "text-emerald-600" : "text-rose-600"
                                                )}>
                                                    {txn.amount > 0 ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString()}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <Badge
                                                    variant={txn.status === 'COMPLETED' || txn.status === 'SETTLED' ? 'success' : txn.status === 'PENDING' ? 'warning' : 'secondary'}
                                                    className="text-[8px] font-black px-2.5 py-1"
                                                >
                                                    {txn.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-5 text-right pr-8">
                                                <button className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all text-slate-400 hover:text-primary active:scale-90">
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                                                        <Search className="h-8 w-8 text-slate-200" />
                                                    </div>
                                                    <p className="text-slate-400 font-bold text-sm">No transactions found matching your criteria.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {txnTotal > 0 && (
                            <div className="px-6 py-3 border-t border-slate-100">
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

                {/* Side Panels */}
                <div className="space-y-6">
                    {/* Dedicated Money Requests Hub */}
                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative rounded-3xl">
                        <div className="relative z-10 space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <CreditCard className="h-5 w-5 text-brand-400" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Withdrawals Hub</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-2">Pending Seller Payouts</p>
                                <h3 className="text-3xl font-black text-white">₹{(walletData.stats?.sellerPendingPayouts || 0).toLocaleString()}</h3>
                                <p className="text-xs text-slate-400 mt-2">
                                    Review seller bank account details and approve individual or batch payouts.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/admin/withdrawals')}
                                className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 group"
                            >
                                <Wallet className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                                Open Money Requests
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="absolute -bottom-8 -right-8 opacity-10">
                            <Wallet className="h-40 w-40" />
                        </div>
                    </Card>

                    {/* Dedicated COD Cash Collection Hub */}
                    <Card className="p-6 border-none shadow-md ring-1 ring-slate-100 bg-white rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                                <CircleDollarSign className="h-5 w-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">COD Float</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash with Delivery Boys</p>
                            <h4 className="text-2xl font-black text-slate-900">₹{(walletData.stats?.systemFloat || 0).toLocaleString()}</h4>
                            <p className="text-xs text-slate-500 mt-1">
                                Reconcile in-hand COD cash collected by riders when deposited at the hub.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/cash-collection')}
                            className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 ring-1 ring-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all hover:text-slate-900"
                        >
                            Collect Cash from Riders
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </Card>

                    {/* Dedicated Navigation Links */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">Dedicated Financial Pages</h4>
                        {[
                            { label: 'Money Requests (Approvals)', icon: CreditCard, path: '/admin/withdrawals', desc: 'Approve seller/warehouse payouts' },
                            { label: 'Collect Cash Hub', icon: CircleDollarSign, path: '/admin/cash-collection', desc: 'Rider COD cash settlements' },
                            { label: 'Seller Payments Ledger', icon: Receipt, path: '/admin/seller-transactions', desc: 'Commission and order breakdowns' },
                        ].map((link, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(link.path)}
                                className="w-full p-4 bg-white ring-1 ring-slate-100 rounded-2xl flex items-center justify-between group hover:ring-primary/20 hover:shadow-md transition-all text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 text-slate-500 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                        <link.icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-slate-800 block">{link.label}</span>
                                        <span className="text-[10px] text-slate-400 block">{link.desc}</span>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                            </button>
                        ))}
                    </div>
                </div>
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
