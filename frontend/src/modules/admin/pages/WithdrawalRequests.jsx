import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import {
    Banknote,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    Building2,
    Truck,
    Download,
    Eye,
    Check,
    X,
    RotateCw,
    Copy,
    FileText,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

/**
 * Extracts and normalizes bank details from a requester or transaction record.
 */
const parseBankDetails = (user, meta) => {
    const rawBank =
        user?.bankDetails ||
        (user?.accountNumber
            ? {
                  bankName: user?.bankName,
                  accountNumber: user?.accountNumber,
                  ifscCode: user?.ifsc || user?.ifscCode,
                  accountHolderName: user?.accountHolder || user?.accountHolderName || user?.name,
              }
            : null) ||
        (meta?.bankDetails ? meta.bankDetails : null);

    if (!rawBank) {
        return { summary: 'Not Provided', details: null };
    }

    if (typeof rawBank === 'string') {
        return { summary: rawBank.trim() || 'Not Provided', details: null };
    }

    if (typeof rawBank === 'object') {
        const bankName = rawBank.bankName || rawBank.bank || '';
        const accountNumber = rawBank.accountNumber || rawBank.accountNo || '';
        const ifscCode = rawBank.ifscCode || rawBank.ifsc || '';
        const accountHolderName = rawBank.accountHolderName || rawBank.accountHolder || user?.name || '';
        const upiId = rawBank.upiId || rawBank.upi || '';

        const summaryParts = [];
        if (bankName) summaryParts.push(bankName);
        if (accountNumber) {
            const masked =
                accountNumber.length > 4
                    ? `••••${accountNumber.slice(-4)}`
                    : accountNumber;
            summaryParts.push(`A/C: ${masked}`);
        }
        if (ifscCode) summaryParts.push(`IFSC: ${ifscCode}`);

        return {
            summary: summaryParts.length > 0 ? summaryParts.join(' • ') : 'Not Provided',
            details: {
                bankName: bankName || null,
                accountNumber: accountNumber || null,
                ifscCode: ifscCode || null,
                accountHolderName: accountHolderName || null,
                upiId: upiId || null,
            },
        };
    }

    return { summary: String(rawBank), details: null };
};

const WithdrawalRequests = () => {
    const [activeTab, setActiveTab] = useState('sellers'); // 'sellers' | 'delivery'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [loading, setLoading] = useState(true);

    const [sellerRequests, setSellerRequests] = useState([]);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [sellerPage, setSellerPage] = useState(1);
    const [deliveryPage, setDeliveryPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sellerTotal, setSellerTotal] = useState(0);
    const [deliveryTotal, setDeliveryTotal] = useState(0);

    // Detail view modal
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Action modals: { isOpen, type: 'approve' | 'reject', request, note: '' }
    const [actionModal, setActionModal] = useState({
        isOpen: false,
        type: null,
        request: null,
        note: '',
    });
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch withdrawals from live backend
    const fetchData = async (sPage = 1, dPage = 1) => {
        try {
            setLoading(true);
            const commonParams = { limit: pageSize };
            if (filterStatus !== 'all') {
                commonParams.status = filterStatus;
            }

            const [sellerRes, deliveryRes] = await Promise.all([
                adminApi
                    .getSellerWithdrawals({ ...commonParams, page: sPage })
                    .catch(() => ({ data: { success: false, result: {} } })),
                adminApi
                    .getDeliveryWithdrawals({ ...commonParams, page: dPage })
                    .catch(() => ({ data: { success: false, result: {} } })),
            ]);

            if (sellerRes.data?.success) {
                const payload = sellerRes.data.result || {};
                const items = Array.isArray(payload.items)
                    ? payload.items
                    : sellerRes.data.results || [];
                setSellerRequests(items);
                setSellerTotal(
                    typeof payload.total === 'number' ? payload.total : items.length
                );
                setSellerPage(
                    typeof payload.page === 'number' ? payload.page : sPage
                );
            }

            if (deliveryRes.data?.success) {
                const payload = deliveryRes.data.result || {};
                const items = Array.isArray(payload.items)
                    ? payload.items
                    : deliveryRes.data.results || [];
                setDeliveryRequests(items);
                setDeliveryTotal(
                    typeof payload.total === 'number' ? payload.total : items.length
                );
                setDeliveryPage(
                    typeof payload.page === 'number' ? payload.page : dPage
                );
            }
        } catch (error) {
            console.error('Failed to load withdrawal requests:', error);
            toast.error('Failed to load withdrawal requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1, 1);
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, filterStatus]);

    // Compute real top statistics from current dataset
    const stats = useMemo(() => {
        const sList = Array.isArray(sellerRequests) ? sellerRequests : [];
        const dList = Array.isArray(deliveryRequests) ? deliveryRequests : [];
        const combined = [...sList, ...dList];

        const isPending = (r) => r.status === 'Pending' || r.status === 'Processing';
        const pendingItems = combined.filter(isPending);
        const settledItems = combined.filter((r) => r.status === 'Settled');

        const pendingCount = pendingItems.length;
        const pendingVolume = pendingItems.reduce(
            (acc, r) => acc + Math.abs(Number(r.amount) || 0),
            0
        );
        const settledCount = settledItems.length;

        return {
            pendingCount,
            pendingVolume,
            settledCount,
            sellerPendingCount: sList.filter(isPending).length,
            deliveryPendingCount: dList.filter(isPending).length,
        };
    }, [sellerRequests, deliveryRequests]);

    // Active tab items with search filtering
    const activeData = useMemo(() => {
        const list = activeTab === 'sellers' ? sellerRequests : deliveryRequests;
        if (!searchTerm.trim()) return list;

        const term = searchTerm.trim().toLowerCase();
        return list.filter((r) => {
            const name = (r.user?.shopName || r.user?.name || '').toLowerCase();
            const phone = (r.user?.phone || '').toLowerCase();
            const ref = (r.reference || r._id || '').toLowerCase();
            return name.includes(term) || phone.includes(term) || ref.includes(term);
        });
    }, [activeTab, sellerRequests, deliveryRequests, searchTerm]);

    // Handle Approve / Reject action submission
    const handleExecuteAction = async () => {
        if (!actionModal.request) return;

        try {
            setActionLoading(true);
            const status = actionModal.type === 'approve' ? 'Settled' : 'Failed';
            const reason = actionModal.note?.trim() || undefined;

            const res = await adminApi.updateWithdrawalStatus(
                actionModal.request._id,
                { status, reason }
            );

            if (res.data?.success) {
                toast.success(
                    actionModal.type === 'approve'
                        ? 'Withdrawal approved & marked as settled'
                        : 'Withdrawal rejected. Balance returned to wallet.'
                );
                setActionModal({ isOpen: false, type: null, request: null, note: '' });
                if (selectedRequest?._id === actionModal.request._id) {
                    setSelectedRequest(null);
                }
                fetchData(sellerPage, deliveryPage);
            } else {
                toast.error(res.data?.message || 'Failed to update withdrawal status');
            }
        } catch (err) {
            console.error('Update withdrawal error:', err);
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(false);
        }
    };

    // Copy to clipboard helper
    const handleCopy = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    // Real CSV Export
    const handleExportCSV = () => {
        const rowsToExport = activeData.length > 0
            ? activeData
            : (activeTab === 'sellers' ? sellerRequests : deliveryRequests);

        if (!rowsToExport.length) {
            toast.error('No requests to export');
            return;
        }

        const headers = [
            'Date',
            'Transaction Ref',
            'Requester Name',
            'Shop Name',
            'Phone',
            'Role',
            'Amount (₹)',
            'Status',
            'Bank Name',
            'Account Number',
            'IFSC Code',
            'Account Holder',
            'Notes',
        ];

        const csvRows = [headers.join(',')];

        rowsToExport.forEach((r) => {
            const bank = parseBankDetails(r.user, r.meta).details || {};
            const row = [
                `"${r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : ''}"`,
                `"${r.reference || r._id || ''}"`,
                `"${(r.user?.name || '').replace(/"/g, '""')}"`,
                `"${(r.user?.shopName || '').replace(/"/g, '""')}"`,
                `"${r.user?.phone || ''}"`,
                `"${activeTab === 'sellers' ? 'Seller' : 'Delivery Partner'}"`,
                Math.abs(Number(r.amount) || 0),
                `"${r.status || 'Pending'}"`,
                `"${(bank.bankName || '').replace(/"/g, '""')}"`,
                `"${bank.accountNumber || ''}"`,
                `"${bank.ifscCode || ''}"`,
                `"${(bank.accountHolderName || '').replace(/"/g, '""')}"`,
                `"${(r.notes || r.meta?.reason || '').replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute(
            'download',
            `withdrawal-requests-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${rowsToExport.length} requests successfully`);
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Money Requests
                        <Badge
                            variant="primary"
                            className="text-[10px] px-2.5 py-0.5 font-bold uppercase tracking-wider bg-brand-50 text-brand-700 border-none"
                        >
                            FINANCIAL HUB
                        </Badge>
                    </h1>
                    <p className="ds-description mt-1">
                        Review, verify bank details, and process fund disbursement requests from sellers and delivery partners.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchData(sellerPage, deliveryPage)}
                        disabled={loading}
                        title="Refresh live requests"
                        className="p-2.5 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <RotateCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        <Download className="h-4 w-4 text-slate-500" />
                        EXPORT CSV
                    </button>
                </div>
            </div>

            {/* Top Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-amber-50">
                            <Clock className="h-6 w-6 text-amber-500" />
                        </div>
                        <div>
                            <p className="ds-label mb-1 text-slate-400">Total Pending</p>
                            <h3 className="ds-stat-medium text-slate-900">
                                {stats.pendingCount}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-brand-50">
                            <Banknote className="h-6 w-6 text-brand-600" />
                        </div>
                        <div>
                            <p className="ds-label mb-1 text-slate-400">Pending Volume</p>
                            <h3 className="ds-stat-medium text-slate-900">
                                ₹{stats.pendingVolume.toLocaleString('en-IN')}
                            </h3>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white rounded-2xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-emerald-50">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="ds-label mb-1 text-slate-400">Settled Requests</p>
                            <h3 className="ds-stat-medium text-slate-900">
                                {stats.settledCount}
                            </h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Tabs & Search / Filter Controls */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Role Tabs: SELLERS & DELIVERY PARTNERS (Warehouse removed) */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('sellers')}
                            className={cn(
                                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all',
                                activeTab === 'sellers'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            <Building2 className="h-4 w-4" />
                            SELLERS
                            <span
                                className={cn(
                                    'ml-1 px-2 py-0.5 rounded-full text-[10px] font-black',
                                    activeTab === 'sellers'
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-200 text-slate-600'
                                )}
                            >
                                {sellerTotal}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('delivery')}
                            className={cn(
                                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all',
                                activeTab === 'delivery'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            )}
                        >
                            <Truck className="h-4 w-4" />
                            DELIVERY PARTNERS
                            <span
                                className={cn(
                                    'ml-1 px-2 py-0.5 rounded-full text-[10px] font-black',
                                    activeTab === 'delivery'
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-200 text-slate-600'
                                )}
                            >
                                {deliveryTotal}
                            </span>
                        </button>
                    </div>

                    {/* Search & Status Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, ref..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/20 w-64 md:w-72 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {['all', 'pending', 'settled', 'failed'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all',
                                        filterStatus === status
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600'
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table Content Card */}
                <Card className="border-none shadow-sm ring-1 ring-slate-100 overflow-hidden bg-white rounded-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/60 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8">Requester Details</th>
                                    <th className="ds-table-header-cell">Transaction Ref</th>
                                    <th className="ds-table-header-cell">Beneficiary Bank</th>
                                    <th className="ds-table-header-cell text-center">Amount</th>
                                    <th className="ds-table-header-cell">Status</th>
                                    <th className="ds-table-header-cell text-right pr-8">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeData.map((req) => {
                                    const bankInfo = parseBankDetails(req.user, req.meta);
                                    const displayName =
                                        activeTab === 'sellers'
                                            ? req.user?.shopName || req.user?.name || 'Seller'
                                            : req.user?.name || 'Rider';

                                    return (
                                        <tr
                                            key={req._id}
                                            className="group hover:bg-slate-50/50 transition-colors"
                                        >
                                            {/* Requester Details */}
                                            <td className="px-6 py-5 pl-8">
                                                <div className="flex items-center gap-3.5">
                                                    <div
                                                        className={cn(
                                                            'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm',
                                                            activeTab === 'sellers'
                                                                ? 'bg-brand-50 text-brand-600'
                                                                : 'bg-blue-50 text-blue-600'
                                                        )}
                                                    >
                                                        {activeTab === 'sellers' ? (
                                                            <Building2 className="h-5 w-5" />
                                                        ) : (
                                                            <Truck className="h-5 w-5" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p
                                                            onClick={() => setSelectedRequest(req)}
                                                            className="text-sm font-bold text-slate-900 hover:text-brand-600 cursor-pointer transition-colors"
                                                        >
                                                            {displayName}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[11px] font-semibold text-slate-400">
                                                                {req.user?.phone || 'No phone'}
                                                            </span>
                                                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                            <span className="text-[11px] font-semibold text-slate-400">
                                                                {req.createdAt
                                                                    ? new Date(req.createdAt).toLocaleDateString('en-IN', {
                                                                          day: '2-digit',
                                                                          month: 'short',
                                                                          year: 'numeric',
                                                                      })
                                                                    : 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Reference */}
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        {req.reference || req._id}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Bank Account Summary */}
                                            <td className="px-6 py-5">
                                                {bankInfo.details ? (
                                                    <div className="text-xs">
                                                        <p className="font-bold text-slate-800">
                                                            {bankInfo.details.bankName || 'Bank A/C'}
                                                        </p>
                                                        <p className="text-[11px] font-mono text-slate-500">
                                                            {bankInfo.details.accountNumber
                                                                ? `A/C: ${bankInfo.details.accountNumber}`
                                                                : ''}
                                                            {bankInfo.details.ifscCode
                                                                ? ` • ${bankInfo.details.ifscCode}`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">
                                                        {bankInfo.summary}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td className="px-6 py-5 text-center">
                                                <span className="text-sm font-black text-slate-900">
                                                    ₹{Math.abs(Number(req.amount) || 0).toLocaleString('en-IN')}
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-6 py-5">
                                                <Badge
                                                    variant={
                                                        req.status === 'Pending'
                                                            ? 'warning'
                                                            : req.status === 'Settled'
                                                            ? 'success'
                                                            : req.status === 'Processing'
                                                            ? 'primary'
                                                            : 'danger'
                                                    }
                                                    className="text-[10px] font-extrabold px-2.5 py-0.5 uppercase tracking-wide"
                                                >
                                                    {req.status || 'Pending'}
                                                </Badge>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-5 text-right pr-8">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {req.status === 'Pending' && (
                                                        <>
                                                            <button
                                                                onClick={() =>
                                                                    setActionModal({
                                                                        isOpen: true,
                                                                        type: 'approve',
                                                                        request: req,
                                                                        note: '',
                                                                    })
                                                                }
                                                                title="Approve & Settle"
                                                                className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setActionModal({
                                                                        isOpen: true,
                                                                        type: 'reject',
                                                                        request: req,
                                                                        note: '',
                                                                    })
                                                                }
                                                                title="Reject Request"
                                                                className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm active:scale-95"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedRequest(req)}
                                                        title="View Full Details"
                                                        className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {activeData.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-slate-50 rounded-full mb-3">
                                                    <FileText className="h-8 w-8 text-slate-300" />
                                                </div>
                                                <p className="text-slate-500 font-bold text-sm">
                                                    No withdrawal requests found.
                                                </p>
                                                <p className="text-slate-400 text-xs mt-1">
                                                    {searchTerm || filterStatus !== 'all'
                                                        ? 'Try clearing the search or status filter.'
                                                        : `No ${activeTab} money requests are currently recorded.`}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-slate-100">
                        <Pagination
                            page={activeTab === 'sellers' ? sellerPage : deliveryPage}
                            totalPages={
                                Math.ceil(
                                    (activeTab === 'sellers' ? sellerTotal : deliveryTotal) /
                                        pageSize
                                ) || 1
                            }
                            total={activeTab === 'sellers' ? sellerTotal : deliveryTotal}
                            pageSize={pageSize}
                            onPageChange={(p) => {
                                if (activeTab === 'sellers') {
                                    setSellerPage(p);
                                    fetchData(p, deliveryPage);
                                } else {
                                    setDeliveryPage(p);
                                    fetchData(sellerPage, p);
                                }
                            }}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setSellerPage(1);
                                setDeliveryPage(1);
                            }}
                            loading={loading}
                        />
                    </div>
                </Card>
            </div>

            {/* Request Detail Modal */}
            <Modal
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title="Withdrawal Details"
                size="md"
            >
                {selectedRequest && (() => {
                    const bankInfo = parseBankDetails(selectedRequest.user, selectedRequest.meta);
                    const b = bankInfo.details;
                    const displayName =
                        activeTab === 'sellers'
                            ? selectedRequest.user?.shopName || selectedRequest.user?.name || 'Seller'
                            : selectedRequest.user?.name || 'Rider';

                    return (
                        <div className="space-y-6 pt-2">
                            {/* Requester Header */}
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div
                                    className={cn(
                                        'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm',
                                        activeTab === 'sellers'
                                            ? 'bg-brand-500 text-white'
                                            : 'bg-blue-600 text-white'
                                    )}
                                >
                                    {activeTab === 'sellers' ? (
                                        <Building2 className="h-7 w-7" />
                                    ) : (
                                        <Truck className="h-7 w-7" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-black text-slate-900 truncate">
                                        {displayName}
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-500">
                                        {selectedRequest.user?.phone || 'No phone'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge
                                            variant={
                                                selectedRequest.status === 'Pending'
                                                    ? 'warning'
                                                    : selectedRequest.status === 'Settled'
                                                    ? 'success'
                                                    : 'danger'
                                            }
                                            className="text-[9px] font-black px-2.5 py-0.5 uppercase"
                                        >
                                            {selectedRequest.status}
                                        </Badge>
                                        <span className="text-[11px] font-medium text-slate-400">
                                            {selectedRequest.createdAt
                                                ? new Date(selectedRequest.createdAt).toLocaleString('en-IN')
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Amount & Reference */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        Requested Amount
                                    </p>
                                    <h4 className="text-2xl font-black text-slate-900 mt-1">
                                        ₹{Math.abs(Number(selectedRequest.amount) || 0).toLocaleString('en-IN')}
                                    </h4>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                        Reference ID
                                    </p>
                                    <p className="text-xs font-mono font-bold text-slate-700 mt-2 truncate">
                                        {selectedRequest.reference || selectedRequest._id}
                                    </p>
                                </div>
                            </div>

                            {/* Beneficiary Bank Account Details Box */}
                            <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Banknote className="h-4 w-4 text-brand-600" />
                                        <p className="text-xs font-extrabold text-brand-900 uppercase tracking-wider">
                                            Beneficiary Bank Information
                                        </p>
                                    </div>
                                </div>

                                {b ? (
                                    <div className="space-y-2 text-xs pt-1">
                                        {b.accountHolderName && (
                                            <div className="flex justify-between items-center py-1 border-b border-brand-100/60">
                                                <span className="text-slate-500 font-medium">Account Holder</span>
                                                <span className="font-bold text-slate-900">{b.accountHolderName}</span>
                                            </div>
                                        )}
                                        {b.bankName && (
                                            <div className="flex justify-between items-center py-1 border-b border-brand-100/60">
                                                <span className="text-slate-500 font-medium">Bank Name</span>
                                                <span className="font-bold text-slate-900">{b.bankName}</span>
                                            </div>
                                        )}
                                        {b.accountNumber && (
                                            <div className="flex justify-between items-center py-1 border-b border-brand-100/60">
                                                <span className="text-slate-500 font-medium">Account Number</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-900">{b.accountNumber}</span>
                                                    <button
                                                        onClick={() => handleCopy(b.accountNumber, 'Account Number')}
                                                        className="p-1 hover:bg-brand-100 rounded text-brand-700 transition-colors"
                                                        title="Copy Account Number"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {b.ifscCode && (
                                            <div className="flex justify-between items-center py-1 border-b border-brand-100/60">
                                                <span className="text-slate-500 font-medium">IFSC Code</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-900">{b.ifscCode}</span>
                                                    <button
                                                        onClick={() => handleCopy(b.ifscCode, 'IFSC Code')}
                                                        className="p-1 hover:bg-brand-100 rounded text-brand-700 transition-colors"
                                                        title="Copy IFSC"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {b.upiId && (
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-slate-500 font-medium">UPI ID</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-900">{b.upiId}</span>
                                                    <button
                                                        onClick={() => handleCopy(b.upiId, 'UPI ID')}
                                                        className="p-1 hover:bg-brand-100 rounded text-brand-700 transition-colors"
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">
                                        No structured bank details registered for this account.
                                    </p>
                                )}
                            </div>

                            {/* Rejection reason or admin notes if any */}
                            {(selectedRequest.notes || selectedRequest.meta?.reason) && (
                                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                    <div className="flex items-center gap-2 text-rose-800 text-xs font-bold mb-1">
                                        <AlertCircle className="h-4 w-4" />
                                        Admin Note / Reason
                                    </div>
                                    <p className="text-xs text-rose-700 font-medium">
                                        {selectedRequest.notes || selectedRequest.meta?.reason}
                                    </p>
                                </div>
                            )}

                            {/* Modal Bottom Actions */}
                            <div className="pt-2">
                                {selectedRequest.status === 'Pending' ? (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                const req = selectedRequest;
                                                setSelectedRequest(null);
                                                setActionModal({
                                                    isOpen: true,
                                                    type: 'approve',
                                                    request: req,
                                                    note: '',
                                                });
                                            }}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="h-4 w-4" />
                                            Approve Disbursement
                                        </button>
                                        <button
                                            onClick={() => {
                                                const req = selectedRequest;
                                                setSelectedRequest(null);
                                                setActionModal({
                                                    isOpen: true,
                                                    type: 'reject',
                                                    request: req,
                                                    note: '',
                                                });
                                            }}
                                            className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-rose-200 active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Reject Request
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setSelectedRequest(null)}
                                        className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                                    >
                                        Close Details
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Approve / Reject Action Confirmation Modal */}
            <Modal
                isOpen={actionModal.isOpen}
                onClose={() =>
                    !actionLoading &&
                    setActionModal({ isOpen: false, type: null, request: null, note: '' })
                }
                title={
                    actionModal.type === 'approve'
                        ? 'Approve Money Disbursement'
                        : 'Reject Money Request'
                }
                size="sm"
            >
                {actionModal.request && (() => {
                    const isApprove = actionModal.type === 'approve';
                    const amount = Math.abs(Number(actionModal.request.amount) || 0);
                    const name =
                        activeTab === 'sellers'
                            ? actionModal.request.user?.shopName || actionModal.request.user?.name || 'Seller'
                            : actionModal.request.user?.name || 'Rider';

                    return (
                        <div className="space-y-5 pt-1">
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div
                                    className={cn(
                                        'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
                                        isApprove ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                                    )}
                                >
                                    {isApprove ? (
                                        <CheckCircle2 className="h-6 w-6" />
                                    ) : (
                                        <XCircle className="h-6 w-6" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500">
                                        {isApprove ? 'Disbursing funds to' : 'Declining request from'}
                                    </p>
                                    <h4 className="text-sm font-bold text-slate-900">{name}</h4>
                                    <p className="text-base font-black text-slate-900 mt-0.5">
                                        ₹{amount.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>

                            {isApprove ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                        Confirming this action marks the withdrawal as <b className="text-slate-900">Settled</b>.
                                        Ensure the bank transfer has been executed.
                                    </p>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                            Bank UTR / Transaction Reference (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. UTR1234567890 / IMPS..."
                                            value={actionModal.note}
                                            onChange={(e) =>
                                                setActionModal({ ...actionModal, note: e.target.value })
                                            }
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-700 font-medium">
                                        Declining this request will restore <b className="font-bold">₹{amount.toLocaleString('en-IN')}</b> back to the requester&apos;s available wallet balance.
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                            Reason for Rejection <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder="e.g., Incorrect IFSC code, bank name mismatch, account unverified..."
                                            value={actionModal.note}
                                            onChange={(e) =>
                                                setActionModal({ ...actionModal, note: e.target.value })
                                            }
                                            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActionModal({
                                            isOpen: false,
                                            type: null,
                                            request: null,
                                            note: '',
                                        })
                                    }
                                    disabled={actionLoading}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExecuteAction}
                                    disabled={actionLoading}
                                    className={cn(
                                        'flex-1 py-3 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm',
                                        isApprove
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-rose-600 hover:bg-rose-700'
                                    )}
                                >
                                    {actionLoading && <RotateCw className="h-4 w-4 animate-spin" />}
                                    {isApprove ? 'Confirm Approval' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </div>
    );
};

export default WithdrawalRequests;
