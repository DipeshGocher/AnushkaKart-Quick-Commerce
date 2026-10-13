import React, { useState, useMemo, useEffect } from 'react';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import {
    CircleDollarSign,
    Search,
    Truck,
    Clock,
    CheckCircle2,
    AlertTriangle,
    History,
    Download,
    Eye,
    Wallet,
    Bell,
    ArrowDownLeft,
    FileText,
    Percent,
    RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const CashCollection = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('live_balances'); // live_balances or history
    const [selectedRider, setSelectedRider] = useState(null);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [settlementData, setSettlementData] = useState({ rider: null, amount: 0 });
    const [isProcessing, setIsProcessing] = useState(false);

    const [ridersCashData, setRidersCashData] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [riderDetails, setRiderDetails] = useState([]);
    const [riderIntel, setRiderIntel] = useState(null);
    const [globalStats, setGlobalStats] = useState(null);
    const [ridersPage, setRidersPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [ridersTotal, setRidersTotal] = useState(0);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const fetchData = async (cashPage = 1, histPage = 1) => {
        try {
            setLoading(true);
            const commonParams = { page: 1, limit: pageSize };
            if (searchTerm.trim()) commonParams.search = searchTerm.trim();

            const [cashRes, historyRes] = await Promise.all([
                adminApi.getDeliveryCashBalances({ ...commonParams, page: cashPage }),
                adminApi.getCashSettlementHistory({ ...commonParams, page: histPage })
            ]);

            if (cashRes.data.success) {
                const payload = cashRes.data.result || {};
                const riders = Array.isArray(payload.items) ? payload.items : (payload.riders || []);
                setRidersCashData(riders);
                setRidersTotal(typeof payload.total === 'number' ? payload.total : riders.length);
                setRidersPage(typeof payload.page === 'number' ? payload.page : cashPage);
                if (payload.stats) {
                    setGlobalStats(payload.stats);
                }
            }
            if (historyRes.data.success) {
                const payload = historyRes.data.result || {};
                const history = Array.isArray(payload.items) ? payload.items : (historyRes.data.results || historyRes.data.result || []);
                setHistoryData(Array.isArray(history) ? history : []);
                setHistoryTotal(typeof payload.total === 'number' ? payload.total : history.length);
                setHistoryPage(typeof payload.page === 'number' ? payload.page : histPage);
            }
        } catch (error) {
            console.error("Failed to fetch cash collection data:", error);
            toast.error("Failed to sync with backend");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1, 1);
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm]);

    const fetchRidersPage = (p) => {
        setRidersPage(p);
        fetchData(p, historyPage);
    };
    const fetchHistoryPage = (p) => {
        setHistoryPage(p);
        fetchData(ridersPage, p);
    };

    // Fetch deep dive details when a rider is selected
    useEffect(() => {
        const fetchRiderDetails = async () => {
            if (!selectedRider) {
                setRiderIntel(null);
                setRiderDetails([]);
                return;
            }
            try {
                setDetailsLoading(true);
                const res = await adminApi.getRiderCashDetails(selectedRider.id);
                if (res.data.success) {
                    const data = res.data.results ?? res.data.result;
                    if (Array.isArray(data)) {
                        setRiderDetails(data);
                        setRiderIntel(null);
                    } else if (data && typeof data === 'object') {
                        setRiderDetails(Array.isArray(data.items) ? data.items : []);
                        setRiderIntel(data);
                    } else {
                        setRiderDetails([]);
                        setRiderIntel(null);
                    }
                } else {
                    setRiderDetails([]);
                    setRiderIntel(null);
                }
            } catch (error) {
                console.error("Failed to fetch rider details:", error);
            } finally {
                setDetailsLoading(false);
            }
        };
        fetchRiderDetails();
    }, [selectedRider]);

    const stats = {
        totalSettled: globalStats?.totalSettled ?? (historyData || []).reduce((acc, h) => acc + (h.amount || 0), 0),
        totalInHand: globalStats?.totalInHand ?? (ridersCashData || []).reduce((acc, r) => acc + (r.currentCash || 0), 0),
        inTransitCodAmount: globalStats?.inTransitCodAmount ?? 0,
        inTransitCodCount: globalStats?.inTransitCodCount ?? 0,
        totalRiders: globalStats?.totalRiders ?? (ridersTotal || ridersCashData.length || 0),
    };

    const filteredRiders = (ridersCashData || []).filter(r =>
        (r.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredHistory = (historyData || []).filter(h =>
        (h.rider || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSettlement = (rider) => {
        setSettlementData({ rider, amount: rider.currentCash });
        setIsSettleModalOpen(true);
    };

    const confirmSettlement = async () => {
        try {
            setIsProcessing(true);
            const response = await adminApi.settleRiderCash({
                riderId: settlementData.rider.id,
                amount: Number(settlementData.amount),
                method: 'Cash submission'
            });

            if (response.data.success) {
                toast.success(`Settlement of ₹${settlementData.amount} for ${settlementData.rider.name} processed successfully.`);
                fetchData(ridersPage, historyPage);
                setIsSettleModalOpen(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Settlement failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExport = () => {
        try {
            if (activeTab === 'history') {
                if (!historyData.length) {
                    toast.info("No settlement logs to export");
                    return;
                }
                const csvRows = [
                    ["Settlement ID", "Rider Name", "Amount Settled", "Method", "Date"],
                    ...historyData.map(h => [
                        `"${h.id || ''}"`,
                        `"${h.rider || ''}"`,
                        h.amount || 0,
                        `"${h.method || 'Cash'}"`,
                        `"${new Date(h.date).toLocaleDateString('en-IN')}"`
                    ])
                ];
                const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `Settlement_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Settlement logs exported successfully");
            } else {
                if (!ridersCashData.length) {
                    toast.info("No rider data to export");
                    return;
                }
                const csvRows = [
                    ["Rider ID", "Rider Name", "Cash in Hand", "In-Transit COD Orders", "Total Settled", "Last Settle Date"],
                    ...ridersCashData.map(r => [
                        `"${r.id || ''}"`,
                        `"${r.name || ''}"`,
                        r.currentCash || 0,
                        r.pendingOrders || 0,
                        r.totalSettled || 0,
                        `"${r.lastSettlement !== 'Never' ? new Date(r.lastSettlement).toLocaleDateString('en-IN') : 'No History'}"`
                    ])
                ];
                const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `Rider_Cash_Balances_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success("Rider cash balances exported successfully");
            }
        } catch (e) {
            toast.error("Export failed");
        }
    };

    const handleBulkSettle = () => {
        const ridersWithCash = ridersCashData.filter(r => (r.currentCash || 0) > 0);
        if (ridersWithCash.length === 0) {
            toast.info("All delivery partners currently have ₹0 pending cash. Nothing to settle.");
            return;
        }
        setSettlementData({ rider: ridersWithCash[0], amount: ridersWithCash[0].currentCash });
        setIsSettleModalOpen(true);
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 pt-6 relative z-10">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Cash Collection Hub
                        <div className="p-1.5 bg-brand-100 rounded-lg">
                            <CircleDollarSign className="h-5 w-5 text-brand-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage physical cash collected by delivery partners and track settlements.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                        <Download className="h-4 w-4" />
                        EXPORT LEDGER
                    </button>
                    <button 
                        onClick={handleBulkSettle}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 shadow-slate-200"
                    >
                        <CheckCircle2 className="h-4 w-4 text-slate-100" />
                        BULK SETTLE ALL
                    </button>
                </div>
            </div>

            {/* Insight Stats Grid - Clear & Intuitive */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { 
                        label: 'Cash Received by Admin', 
                        value: `₹${(stats.totalSettled || 0).toLocaleString('en-IN')}`, 
                        icon: CheckCircle2, 
                        bg: 'bg-emerald-50', 
                        iconColor: 'text-emerald-600', 
                        sub: 'Deposited by riders to company' 
                    },
                    { 
                        label: 'Current Cash with Riders', 
                        value: `₹${(stats.totalInHand || 0).toLocaleString('en-IN')}`, 
                        icon: Wallet, 
                        bg: 'bg-amber-50', 
                        iconColor: 'text-amber-600', 
                        sub: (stats.totalInHand > 0 ? 'Pending to collect from riders' : 'All clear (Zero pending cash)') 
                    },
                    { 
                        label: 'In-Transit COD Deliveries', 
                        value: `₹${(stats.inTransitCodAmount || 0).toLocaleString('en-IN')}`, 
                        icon: Truck, 
                        bg: 'bg-blue-50', 
                        iconColor: 'text-blue-600', 
                        sub: `${stats.inTransitCodCount || 0} active COD orders in market` 
                    },
                    { 
                        label: 'Active Delivery Fleet', 
                        value: `${stats.totalRiders || 0} Riders`, 
                        icon: Percent, 
                        bg: 'bg-purple-50', 
                        iconColor: 'text-purple-600', 
                        sub: 'Registered fulfillment partners' 
                    },
                ].map((stat, i) => (
                    <Card key={i} className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-brand-200 transition-all rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-3 rounded-2xl", stat.bg)}>
                                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
                            </div>
                        </div>
                        <p className="ds-label mb-1 uppercase tracking-tight font-black">{stat.label}</p>
                        <h3 className="ds-stat-medium ds-stat-large text-slate-900">{stat.value}</h3>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">{stat.sub}</p>
                    </Card>
                ))}
            </div>

            {/* Navigation & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('live_balances')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all",
                            activeTab === 'live_balances' ? "bg-white text-slate-900 shadow-xl" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <Truck className="h-4 w-4" />
                        LIVE RIDER BALANCES
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all",
                            activeTab === 'history' ? "bg-white text-slate-900 shadow-xl" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <History className="h-4 w-4" />
                        SETTLEMENT LOGS
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find Rider or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-500/10 w-64 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl mt-6">
                <div className="overflow-x-auto">
                    {activeTab === 'live_balances' ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8 py-5">Delivery Partner</th>
                                    <th className="ds-table-header-cell">Cash In Hand (Pending Collect)</th>
                                    <th className="ds-table-header-cell text-center">In-Transit COD Orders</th>
                                    <th className="ds-table-header-cell text-center">Lifetime Deposited</th>
                                    <th className="ds-table-header-cell">Last Settle Date</th>
                                    <th className="ds-table-header-cell text-right pr-8">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredRiders.map((rider) => (
                                    <tr key={rider.id} className="group hover:bg-slate-50/40 transition-all">
                                        <td className="px-6 py-6 pl-8">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img
                                                        src={rider.avatar && !rider.avatar.includes('emoji') && !rider.avatar.includes('avatar') && !rider.avatar.includes('dicebear') ? rider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                                        alt=""
                                                        className="h-12 w-12 rounded-lg ring-2 ring-white shadow-sm object-cover bg-slate-100"
                                                    />
                                                    <div className={cn(
                                                        "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white",
                                                        rider.currentCash > 0 ? "bg-amber-500" : "bg-emerald-500"
                                                    )} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{rider.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                                        {rider.id} • {rider.totalOrders || 0} Delivered
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            {rider.currentCash > 0 ? (
                                                <div>
                                                    <span className="text-lg font-black text-rose-600">₹{rider.currentCash.toLocaleString('en-IN')}</span>
                                                    <span className="text-[10px] font-bold text-rose-500 block uppercase tracking-tight">Pending Receive</span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200/70 px-3 py-1.5 rounded-xl">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                    ₹0 (All Cleared)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-50 ring-1 ring-slate-100 px-3 py-1.5 rounded-xl">
                                                {rider.pendingOrders || 0} Orders
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-center font-black text-slate-900 text-sm">
                                            ₹{(rider.totalSettled || 0).toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-6 py-6 font-semibold text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="text-xs">
                                                    {rider.lastSettlement !== 'Never'
                                                        ? new Date(rider.lastSettlement).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                        : 'No History'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right pr-8">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleSettlement(rider)}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 uppercase tracking-widest",
                                                        rider.currentCash > 0
                                                            ? "bg-slate-900 text-white hover:bg-slate-800"
                                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                    )}
                                                >
                                                    {rider.currentCash > 0 ? 'Receive Cash' : 'Record Receive'}
                                                </button>
                                                <button
                                                    onClick={() => setSelectedRider(rider)}
                                                    title="View Full Cash History"
                                                    className="p-2 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8 py-5">Settlement ID</th>
                                    <th className="ds-table-header-cell">Partner Name</th>
                                    <th className="ds-table-header-cell text-center">Amount Settled</th>
                                    <th className="ds-table-header-cell">Method</th>
                                    <th className="ds-table-header-cell text-right pr-8">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredHistory.map((log) => (
                                    <tr key={log.id} className="group hover:bg-slate-50/40 transition-all">
                                        <td className="px-6 py-5 pl-8 text-[10px] font-black text-slate-400 uppercase tracking-tighter">{log.id}</td>
                                        <td className="px-6 py-5 text-sm font-bold text-slate-900">{log.rider}</td>
                                        <td className="px-6 py-5 text-center text-sm font-black text-brand-600">₹{log.amount.toLocaleString()}</td>
                                        <td className="px-6 py-5">
                                            <Badge variant="secondary" className="text-[9px] font-black px-2 py-0.5 uppercase">
                                                {log.method}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5 text-right pr-8 text-xs font-bold text-slate-500">
                                            {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-6 py-3 border-t border-slate-100">
                    <Pagination
                        page={activeTab === 'live_balances' ? ridersPage : historyPage}
                        totalPages={Math.ceil((activeTab === 'live_balances' ? ridersTotal : historyTotal) / pageSize) || 1}
                        total={activeTab === 'live_balances' ? ridersTotal : historyTotal}
                        pageSize={pageSize}
                        onPageChange={activeTab === 'live_balances' ? fetchRidersPage : fetchHistoryPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setRidersPage(1);
                            setHistoryPage(1);
                        }}
                        loading={loading}
                    />
                </div>
            </Card>

            {/* Rider Deep Dive Modal */}
            <Modal
                isOpen={!!selectedRider}
                onClose={() => setSelectedRider(null)}
                title="Rider Collection Intelligence"
                size="md"
            >
                {selectedRider && (
                    <div className="ds-section-spacing">
                        <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100 mt-4">
                            <img
                                src={selectedRider.avatar && !selectedRider.avatar.includes('emoji') && !selectedRider.avatar.includes('avatar') && !selectedRider.avatar.includes('dicebear') ? selectedRider.avatar : "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                alt=""
                                className="h-20 w-20 rounded-xl shadow-xl ring-4 ring-white object-cover bg-gray-100"
                            />
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedRider.name}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={selectedRider.status === 'safe' ? 'success' : 'warning'}>
                                        {selectedRider.status.toUpperCase()}
                                    </Badge>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedRider.id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-6 bg-slate-900 text-white rounded-2xl relative overflow-hidden shadow-lg border border-slate-800">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Cash In Hand (Held by Rider)</p>
                                <h4 className="text-3xl font-black italic text-white tracking-tight">₹{(riderIntel?.summary?.currentCash ?? selectedRider.currentCash ?? 0).toLocaleString('en-IN')}</h4>
                                <div className="mt-4 space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                                        <span>Limit: ₹{(riderIntel?.summary?.limit ?? selectedRider.limit ?? 5000).toLocaleString('en-IN')}</span>
                                        <span>{Math.min(Math.round(((riderIntel?.summary?.currentCash ?? selectedRider.currentCash ?? 0) / (riderIntel?.summary?.limit ?? selectedRider.limit ?? 5000)) * 100), 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full transition-all duration-500",
                                                (riderIntel?.summary?.currentCash ?? selectedRider.currentCash ?? 0) >= (riderIntel?.summary?.limit ?? selectedRider.limit ?? 5000)
                                                    ? "bg-rose-500"
                                                    : (riderIntel?.summary?.currentCash ?? selectedRider.currentCash ?? 0) > 3000
                                                    ? "bg-amber-400"
                                                    : "bg-emerald-400"
                                            )} 
                                            style={{ width: `${Math.min(((riderIntel?.summary?.currentCash ?? selectedRider.currentCash ?? 0) / (riderIntel?.summary?.limit ?? selectedRider.limit ?? 5000)) * 100, 100)}%` }} 
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold pt-1">
                                        Safe quota left: <span className="text-emerald-400 font-black">₹{(riderIntel?.summary?.safeLimitRemaining ?? Math.max((selectedRider.limit || 5000) - (selectedRider.currentCash || 0), 0)).toLocaleString('en-IN')}</span>
                                    </p>
                                </div>
                                <CircleDollarSign className="absolute -bottom-4 -right-4 h-24 w-24 text-white/5 pointer-events-none" />
                            </div>

                            <div className="p-6 bg-slate-50 ring-1 ring-slate-100 rounded-2xl flex flex-col justify-between">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">In-Transit COD Deliveries</p>
                                    <h4 className="text-3xl font-black text-slate-900 tracking-tight">
                                        {(riderIntel?.summary?.pendingCodOrdersCount ?? selectedRider.pendingOrders ?? 0)}
                                        <span className="text-xs font-bold text-slate-400 ml-1.5 uppercase font-sans">Orders</span>
                                    </h4>
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-200/60">
                                    <p className="text-[11px] font-bold text-slate-600">
                                        Expected to collect: <span className="font-black text-slate-900">₹{(riderIntel?.summary?.pendingCodOrdersTotal ?? 0).toLocaleString('en-IN')}</span>
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                        {(riderIntel?.summary?.pendingCodOrdersCount ?? selectedRider.pendingOrders ?? 0) > 0 ? "Awaiting customer delivery" : "No pending COD assigned"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-brand-600" />
                                    Collection & Settlement History
                                </h4>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {riderDetails.length} {riderDetails.length === 1 ? 'Record' : 'Records'}
                                </span>
                            </div>
                            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                                {detailsLoading ? (
                                    <div className="py-8 text-center">
                                        <RotateCw className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fetching Ledger...</p>
                                    </div>
                                ) : (Array.isArray(riderDetails) ? riderDetails : []).length > 0 ? (
                                    (Array.isArray(riderDetails) ? riderDetails : []).map((item, i) => {
                                        const isSettlement = item.type === 'Cash Settlement';
                                        return (
                                            <div key={i} className="flex items-center justify-between p-3.5 bg-white ring-1 ring-slate-100 rounded-2xl hover:ring-slate-300 transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                                                        isSettlement ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                                                    )}>
                                                        {isSettlement ? <CheckCircle2 className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-black text-slate-900 font-mono">{item.id || item.reference}</p>
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                                                                isSettlement ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                                                            )}>
                                                                {isSettlement ? "Admin Settle" : "Cash Collected"}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                                                            {new Date(item.date || item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "text-sm font-black font-mono",
                                                    isSettlement ? "text-blue-600" : "text-emerald-600"
                                                )}>
                                                    {isSettlement ? `-₹${Math.abs(item.amount).toLocaleString('en-IN')}` : `+₹${Math.abs(item.amount).toLocaleString('en-IN')}`}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <CircleDollarSign className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-600">No Cash Transactions Found</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">This rider currently has no unremitted cash or past collection history.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button
                                onClick={() => { setSelectedRider(null); handleSettlement(selectedRider); }}
                                className="flex-1 py-4 bg-black  hover:bg-brand-700 text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-brand-100 transition-all active:scale-[0.98]"
                            >
                                Trigger Settlement
                            </button>
                            <button className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all active:scale-95">
                                <Bell className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Settlement Processor Modal */}
            <Modal
                isOpen={isSettleModalOpen}
                onClose={() => !isProcessing && setIsSettleModalOpen(false)}
                title="Financial Settlement Processor"
                size="sm"
            >
                {settlementData.rider && (
                    <div className="ds-section-spacing py-4">
                        <div className="text-center space-y-4">
                            <div className="h-20 w-20 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mx-auto shadow-inner border border-brand-100">
                                <CircleDollarSign className="h-10 w-10" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Record Cash Receive</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1 max-w-[240px] mx-auto">
                                    Finalizing cash submission for <span className="font-black text-slate-900">{settlementData.rider.name}</span>.
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl ring-1 ring-slate-100 mt-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Total Amount to Settle</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-xl font-black italic text-slate-900">₹</span>
                                <input
                                    type="number"
                                    value={settlementData.amount}
                                    onChange={(e) => setSettlementData({ ...settlementData, amount: e.target.value })}
                                    className="bg-transparent text-2xl font-black italic text-slate-900 w-40 outline-none text-center"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 mt-8">
                            <button
                                onClick={confirmSettlement}
                                disabled={isProcessing}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98]"
                            >
                                {isProcessing && <RotateCw className="h-4 w-4 animate-spin" />}
                                {isProcessing ? 'SYNCHRONIZING...' : 'CONFIRM & DEPOSIT'}
                            </button>
                            <button
                                onClick={() => setIsSettleModalOpen(false)}
                                disabled={isProcessing}
                                className="w-full py-4 bg-white ring-1 ring-slate-200 text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all active:scale-[0.98]"
                            >
                                ABORT SESSION
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CashCollection;
