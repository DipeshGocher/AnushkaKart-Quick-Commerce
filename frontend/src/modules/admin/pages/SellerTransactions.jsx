import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
    Receipt,
    Search,
    Filter,
    ArrowUpRight,
    Building2,
    Calendar,
    Download,
    Eye,
    TrendingUp,
    CreditCard,
    Percent,
    ShoppingBag,
    Undo2,
    RotateCw,
    Clock,
    FileText,
    Copy,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const parseBankDetails = (bank) => {
    if (!bank) return { summary: 'N/A', details: null };
    if (typeof bank === 'string') return { summary: bank.trim() || 'N/A', details: null };
    if (typeof bank === 'object') {
        const bankName = bank.bankName || '';
        const accountNumber = bank.accountNumber || bank.accountNo || '';
        const ifscCode = bank.ifscCode || bank.ifsc || '';
        const accountHolderName = bank.accountHolderName || bank.accountHolder || '';

        const parts = [];
        if (bankName) parts.push(bankName);
        if (accountNumber) parts.push(`A/C: ${accountNumber}`);
        if (ifscCode) parts.push(`IFSC: ${ifscCode}`);
        if (accountHolderName) parts.push(`Holder: ${accountHolderName}`);

        return {
            summary: parts.length > 0 ? parts.join(' • ') : 'N/A',
            details: {
                bankName: bankName || null,
                accountNumber: accountNumber || null,
                ifscCode: ifscCode || null,
                accountHolderName: accountHolderName || null,
            }
        };
    }
    return { summary: String(bank), details: null };
};

const SellerTransactions = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [selectedSeller, setSelectedSeller] = useState('all');
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [serverStats, setServerStats] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchTransactions = async (requestedPage = 1) => {
        try {
            setLoading(true);
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (filterStatus !== 'all') params.status = filterStatus;
            if (filterType !== 'all') params.type = filterType;
            if (selectedSeller !== 'all') params.sellerId = selectedSeller;
            
            const res = await adminApi.getSellerTransactions(params);
            if (res.data.success) {
                const payload = res.data.result || {};
                const data = Array.isArray(payload.items) ? payload.items : (res.data.results || []);
                const mapped = data.map(t => {
                    const rawBank = t.bankDetails || t.user?.bankDetails || (t.user?.accountNumber ? {
                        bankName: t.user?.bankName,
                        accountNumber: t.user?.accountNumber,
                        ifscCode: t.user?.ifsc,
                        accountHolderName: t.user?.accountHolder || t.user?.name
                    } : null);
                    const parsedBank = parseBankDetails(rawBank);

                    const rawType = String(t.type || '');
                    const isSale = rawType === 'Order Payment' || rawType === 'Seller Earning' || rawType.toLowerCase() === 'sale';
                    const isPayout = rawType === 'Withdrawal' || rawType === 'Payout' || rawType.toLowerCase() === 'payout';
                    const isRefund = rawType === 'Refund' || rawType.toLowerCase() === 'refund';

                    const mappedType = isSale ? 'sale' : isPayout ? 'payout' : isRefund ? 'refund' : rawType.toLowerCase();

                    const grossAmount = Math.abs(Number(t.amount) || 0);
                    const platformFee = Number(t.order?.pricing?.platformFee ?? t.order?.paymentBreakdown?.platformFee ?? 0);
                    const netPayable = isSale
                        ? Number(t.order?.paymentBreakdown?.sellerEarnings ?? Math.max(0, grossAmount - platformFee))
                        : grossAmount;

                    return {
                        id: t.reference || t._id,
                        referenceId: t.reference || t._id,
                        orderId: t.order?.orderId || null,
                        date: new Date(t.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        seller: String(t.user?.shopName || t.user?.name || 'Unknown Store'),
                        type: mappedType,
                        rawType: t.type,
                        amount: t.amount,
                        grossAmount,
                        commissionRate: t.order?.pricing?.platformFeeRate || (grossAmount > 0 ? Math.round((platformFee / grossAmount) * 100) : 0),
                        commissionAmount: platformFee,
                        taxAmount: Number(t.order?.pricing?.gst ?? t.order?.pricing?.tax ?? 0),
                        netPayable,
                        status: String(t.status || 'pending').toLowerCase(),
                        paymentMethod: String(t.order?.paymentMode || t.paymentMethod || 'Wallet'),
                        bankDetails: parsedBank.summary,
                        bankDetailsObj: parsedBank.details,
                        items: t.order?.items?.map(item => ({
                            name: item.product?.name || 'Product Item',
                            qty: item.quantity || 1,
                            price: item.price || 0
                        })) || []
                    };
                });
                setTransactions(mapped);
                setTotal(typeof payload.total === 'number' ? payload.total : mapped.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
                if (payload.stats) {
                    setServerStats(payload.stats);
                }
            }
        } catch (error) {
            toast.error("Failed to fetch transactions");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTransactions(1);
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, filterStatus, filterType, selectedSeller]);

    const sellers = useMemo(() => {
        const unique = Array.from(new Set(transactions.map(t => t.seller)));
        return unique.map(name => ({ id: name, name }));
    }, [transactions]);

    // Use global database statistics from backend, with local fallback
    const stats = useMemo(() => {
        if (serverStats) {
            return {
                totalGross: serverStats.totalSales || 0,
                totalCommission: serverStats.totalCommission || 0,
                totalPayouts: serverStats.totalPaidOut || 0,
                pendingSettlements: serverStats.pendingTotal || 0
            };
        }
        const validSales = transactions.filter(t => t.type === 'sale' && t.status !== 'failed');
        const settledPayouts = transactions.filter(t => t.type === 'payout' && (t.status === 'settled' || t.status === 'processed'));
        const pendingItems = transactions.filter(t => t.status === 'pending' || t.status === 'processing');

        return {
            totalGross: validSales.reduce((acc, t) => acc + t.grossAmount, 0),
            totalCommission: validSales.reduce((acc, t) => acc + (t.commissionAmount || 0), 0),
            totalPayouts: settledPayouts.reduce((acc, t) => acc + t.grossAmount, 0),
            pendingSettlements: pendingItems.reduce((acc, t) => acc + t.grossAmount, 0)
        };
    }, [serverStats, transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesSearch = t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.orderId && t.orderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                t.seller.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'paid' && (t.status === 'settled' || t.status === 'processed' || t.status === 'completed')) ||
                (filterStatus === 'pending' && (t.status === 'pending' || t.status === 'processing')) ||
                (filterStatus === 'failed' && (t.status === 'failed' || t.status === 'cancelled')) ||
                t.status === filterStatus;

            const matchesType = filterType === 'all' || t.type === filterType;
            const matchesSeller = selectedSeller === 'all' || t.seller === selectedSeller;

            return matchesSearch && matchesStatus && matchesType && matchesSeller;
        });
    }, [transactions, searchTerm, filterStatus, filterType, selectedSeller]);

    // Real CSV Master Ledger Export
    const handleExport = () => {
        const rowsToExport = filteredTransactions.length > 0 ? filteredTransactions : transactions;
        if (!rowsToExport.length) {
            toast.error('No transactions available to export');
            return;
        }

        setIsExporting(true);
        try {
            const headers = [
                'Txn Reference',
                'Order ID',
                'Date',
                'Shop / Merchant',
                'Type',
                'Gross Amount (₹)',
                'Platform Fee (₹)',
                'Merchant Net (₹)',
                'Status',
                'Payment Mode',
                'Bank Details'
            ];

            const csvRows = [headers.join(',')];

            rowsToExport.forEach(t => {
                const row = [
                    `"${t.id}"`,
                    `"${t.orderId || ''}"`,
                    `"${t.date}"`,
                    `"${t.seller.replace(/"/g, '""')}"`,
                    `"${t.type.toUpperCase()}"`,
                    t.grossAmount,
                    t.commissionAmount || 0,
                    t.netPayable || t.grossAmount,
                    `"${t.status.toUpperCase()}"`,
                    `"${t.paymentMethod}"`,
                    `"${(t.bankDetails || '').replace(/"/g, '""')}"`
                ];
                csvRows.push(row.join(','));
            });

            const csvString = '\uFEFF' + csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `seller-master-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success(`Exported ${rowsToExport.length} transactions to CSV`);
        } catch (e) {
            console.error('Export error:', e);
            toast.error('Failed to export ledger');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading && transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-10 w-10 text-brand-600 animate-spin" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing Ledger...</p>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Seller Ledger / Passbook
                        <Badge
                            variant="primary"
                            className="text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border-none"
                        >
                            FINANCIAL STATEMENT
                        </Badge>
                    </h1>
                    <p className="ds-description mt-1">
                        Track merchant sales, platform commission deduction, and settlement disbursement history.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchTransactions(page)}
                        disabled={loading}
                        title="Refresh"
                        className="p-3 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 active:scale-95"
                    >
                        <Download className="h-4 w-4 text-slate-500" />
                        {isExporting ? 'Generating CSV...' : 'Download Master Ledger'}
                    </button>
                </div>
            </div>

            {/* Live Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { 
                        label: 'Merchant Sales', 
                        value: `₹${stats.totalGross.toLocaleString('en-IN')}`, 
                        description: 'Products sold by sellers',
                        icon: ShoppingBag, 
                        bg: 'bg-emerald-50', 
                        color: 'text-emerald-600' 
                    },
                    { 
                        label: 'Commission Deducted', 
                        value: `₹${stats.totalCommission.toLocaleString('en-IN')}`, 
                        description: 'Platform fee on orders',
                        icon: Percent, 
                        bg: 'bg-brand-50', 
                        color: 'text-brand-600' 
                    },
                    { 
                        label: 'Paid Out to Sellers', 
                        value: `₹${stats.totalPayouts.toLocaleString('en-IN')}`, 
                        description: 'Disbursed via bank transfer',
                        icon: ArrowUpRight, 
                        bg: 'bg-blue-50', 
                        color: 'text-blue-600' 
                    },
                    { 
                        label: 'Pending Settlement', 
                        value: `₹${stats.pendingSettlements.toLocaleString('en-IN')}`, 
                        description: 'Payable merchant balance',
                        icon: Clock, 
                        bg: 'bg-amber-50', 
                        color: 'text-amber-600' 
                    },
                ].map((stat, i) => (
                    <Card key={i} className="px-5 py-4 border-none shadow-sm ring-1 ring-slate-100 hover:ring-brand-500/20 transition-all bg-white group overflow-hidden relative rounded-2xl">
                        <div className="relative z-10">
                            <div className={cn("p-2.5 rounded-xl w-fit mb-3 transition-transform group-hover:scale-105", stat.bg)}>
                                <stat.icon className={cn("h-5 w-5", stat.color)} />
                            </div>
                            <p className="ds-label mb-0.5 text-slate-400">{stat.label}</p>
                            <h3 className="ds-stat-medium text-slate-900">{stat.value}</h3>
                            <p className="text-[11px] font-medium text-slate-400 mt-1">{stat.description}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Filter & Search Bar */}
            <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter by Store, Order ID, or Txn Reference..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl ring-1 ring-slate-100">
                            <Filter className="h-3.5 w-3.5 text-slate-400" />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="bg-transparent text-[11px] font-bold text-slate-600 uppercase outline-none cursor-pointer"
                            >
                                <option value="all">All Types</option>
                                <option value="sale">Sales Only</option>
                                <option value="payout">Payouts Only</option>
                                <option value="refund">Refunds</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl ring-1 ring-slate-100">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <select
                                value={selectedSeller}
                                onChange={(e) => setSelectedSeller(e.target.value)}
                                className="bg-transparent text-[11px] font-bold text-slate-600 uppercase outline-none cursor-pointer max-w-[160px]"
                            >
                                <option value="all">All Merchants</option>
                                {sellers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {[
                                { key: 'all', label: 'ALL' },
                                { key: 'paid', label: 'SETTLED' },
                                { key: 'pending', label: 'PENDING' },
                                { key: 'failed', label: 'FAILED' }
                            ].map((status) => (
                                <button
                                    key={status.key}
                                    onClick={() => setFilterStatus(status.key)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all",
                                        filterStatus === status.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Master Table Area */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden bg-white rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/70 border-b border-slate-100">
                                <th className="ds-table-header-cell pl-8 py-4">TXN Details</th>
                                <th className="ds-table-header-cell">Shop</th>
                                <th className="ds-table-header-cell">Type & Order</th>
                                <th className="ds-table-header-cell text-center">Gross Amount</th>
                                <th className="ds-table-header-cell text-center">Net / Katoti</th>
                                <th className="ds-table-header-cell text-center">Status</th>
                                <th className="ds-table-header-cell text-right pr-8">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTransactions.map((txn) => (
                                <tr key={txn.id} className="group hover:bg-slate-50/50 transition-colors">
                                    {/* TXN Details */}
                                    <td className="px-6 py-4 pl-8">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                                                txn.type === 'sale'
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : txn.type === 'payout'
                                                    ? "bg-blue-50 text-blue-600"
                                                    : "bg-rose-50 text-rose-600"
                                            )}>
                                                {txn.type === 'sale' ? (
                                                    <ShoppingBag className="h-5 w-5" />
                                                ) : txn.type === 'payout' ? (
                                                    <ArrowUpRight className="h-5 w-5" />
                                                ) : (
                                                    <Undo2 className="h-5 w-5" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-mono font-bold text-slate-500">{txn.id}</p>
                                                <p className="text-xs font-semibold text-slate-900 mt-0.5">{txn.date}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Shop */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                            <p className="text-sm font-bold text-slate-800">{txn.seller}</p>
                                        </div>
                                    </td>

                                    {/* Type & Order */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className={cn(
                                                "text-[10px] font-extrabold uppercase tracking-wide",
                                                txn.type === 'sale'
                                                    ? "text-emerald-700"
                                                    : txn.type === 'payout'
                                                    ? "text-blue-700"
                                                    : "text-rose-700"
                                            )}>
                                                {txn.type === 'sale' ? 'ORDER SALE' : txn.type === 'payout' ? 'PAYOUT DISBURSEMENT' : 'REFUND ADJUSTMENT'}
                                            </span>
                                            {txn.orderId && (
                                                <span className="text-[11px] font-mono font-bold text-brand-600">
                                                    {txn.orderId}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-6 py-4 text-center">
                                        <p className={cn(
                                            "text-sm font-black",
                                            txn.type === 'payout' ? "text-blue-600" : txn.status === 'failed' ? "text-slate-400 line-through" : "text-slate-900"
                                        )}>
                                            ₹{txn.grossAmount.toLocaleString('en-IN')}
                                        </p>
                                    </td>

                                    {/* Net / Summary */}
                                    <td className="px-6 py-4 text-center">
                                        {txn.type === 'sale' ? (
                                            <div className="flex flex-col items-center">
                                                {txn.commissionAmount > 0 ? (
                                                    <span className="text-[10px] font-bold text-rose-500">
                                                        -₹{txn.commissionAmount} (Fee)
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold text-slate-400">Zero Fee (0%)</span>
                                                )}
                                                <span className="text-xs font-black text-emerald-600 pt-0.5">
                                                    Net: ₹{txn.netPayable.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ) : txn.type === 'payout' ? (
                                            <span className="text-blue-600 font-bold text-xs">Bank Transfer</span>
                                        ) : (
                                            <span className="text-rose-500 font-bold text-xs">Refund Deduction</span>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4 text-center">
                                        <Badge
                                            variant={
                                                txn.status === 'settled' || txn.status === 'processed' || txn.status === 'completed'
                                                    ? 'success'
                                                    : txn.status === 'pending' || txn.status === 'processing'
                                                    ? 'warning'
                                                    : 'danger'
                                            }
                                            className="text-[10px] font-extrabold uppercase px-2.5 py-0.5"
                                        >
                                            {txn.status}
                                        </Badge>
                                    </td>

                                    {/* Action */}
                                    <td className="px-6 py-4 text-right pr-8">
                                        <button
                                            onClick={() => setSelectedTxn(txn)}
                                            className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all active:scale-95 shadow-sm"
                                            title="View Details"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {filteredTransactions.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="p-4 bg-slate-50 rounded-full mb-3">
                                                <FileText className="h-8 w-8 text-slate-300" />
                                            </div>
                                            <p className="text-slate-500 font-bold text-sm">No transactions match your current filters.</p>
                                            <p className="text-slate-400 text-xs mt-1">Try clearing your search term or status selection.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchTransactions(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>

            {/* Drill-down Detail Modal */}
            <Modal
                isOpen={!!selectedTxn}
                onClose={() => setSelectedTxn(null)}
                title="Transaction Statement Detail"
                size="md"
            >
                {selectedTxn && (
                    <div className="space-y-6 pt-1">
                        <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className={cn(
                                "h-14 w-14 rounded-2xl flex items-center justify-center shadow-md mb-3 text-white",
                                selectedTxn.type === 'sale'
                                    ? "bg-emerald-600"
                                    : selectedTxn.type === 'payout'
                                    ? "bg-blue-600"
                                    : "bg-rose-600"
                            )}>
                                {selectedTxn.type === 'sale' ? (
                                    <ShoppingBag className="h-7 w-7" />
                                ) : selectedTxn.type === 'payout' ? (
                                    <ArrowUpRight className="h-7 w-7" />
                                ) : (
                                    <Undo2 className="h-7 w-7" />
                                )}
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                {selectedTxn.type === 'payout' ? '-' : ''}₹{selectedTxn.grossAmount.toLocaleString('en-IN')}
                            </h2>
                            <p className="text-xs font-mono font-bold text-slate-500 mt-1">{selectedTxn.id}</p>
                        </div>

                        {selectedTxn.status === 'failed' && (
                            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-700 font-medium">
                                Notice: This order transaction was cancelled/failed prior to settlement. No funds were debited or credited to the merchant.
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-bold text-slate-400 uppercase">Chronology</p>
                                <p className="text-xs font-bold text-slate-800 mt-1">{selectedTxn.date}</p>
                            </div>
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-bold text-slate-400 uppercase">Merchant</p>
                                <p className="text-xs font-bold text-slate-800 mt-1 truncate">{selectedTxn.seller}</p>
                            </div>
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-bold text-slate-400 uppercase">Payment Mode</p>
                                <p className="text-xs font-bold text-slate-800 mt-1">{selectedTxn.paymentMethod}</p>
                            </div>
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[11px] font-bold text-slate-400 uppercase">Status</p>
                                <div className="mt-1">
                                    <Badge
                                        variant={
                                            selectedTxn.status === 'settled' || selectedTxn.status === 'completed'
                                                ? 'success'
                                                : selectedTxn.status === 'pending'
                                                ? 'warning'
                                                : 'danger'
                                        }
                                        className="text-[9px] font-extrabold uppercase px-2 py-0.5"
                                    >
                                        {selectedTxn.status}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {selectedTxn.type === 'sale' && (
                            <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3">
                                <div className="flex justify-between items-center text-xs font-medium">
                                    <span className="opacity-70">Order Gross Total</span>
                                    <span>₹{selectedTxn.grossAmount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-medium">
                                    <span className="opacity-70">Platform Fee / Commission</span>
                                    {selectedTxn.commissionAmount > 0 ? (
                                        <span className="text-rose-400">-₹{selectedTxn.commissionAmount.toLocaleString('en-IN')}</span>
                                    ) : (
                                        <span className="text-slate-400">₹0 (Zero Fee / 0%)</span>
                                    )}
                                </div>
                                {selectedTxn.taxAmount > 0 && (
                                    <div className="flex justify-between items-center text-xs font-medium">
                                        <span className="opacity-70">Tax & Surcharge</span>
                                        <span className="text-rose-400">-₹{selectedTxn.taxAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                )}
                                <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider">Merchant Net Earnings</span>
                                    <span className="text-lg font-black text-emerald-400">₹{selectedTxn.netPayable.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        )}

                        {selectedTxn.type === 'payout' && (
                            <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 space-y-2">
                                <p className="text-xs font-bold text-brand-900 uppercase tracking-wider">Beneficiary Account</p>
                                <p className="text-xs font-medium text-slate-700">{selectedTxn.bankDetails || 'No bank details recorded'}</p>
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                onClick={() => setSelectedTxn(null)}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                            >
                                Close Statement
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SellerTransactions;
