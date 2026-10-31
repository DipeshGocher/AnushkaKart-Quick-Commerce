import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Users,
    UserCheck,
    Activity,
    Search,
    Phone,
    Truck,
    User,
    ShieldCheck,
    XCircle,
    Trash2,
    Eye,
    Package,
    Calendar,
    FileText,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';

const ActiveDeliveryBoys = () => {
    const [riders, setRiders] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewingRider, setViewingRider] = useState(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Fetch Riders from Backend
    const fetchRiders = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await adminApi.getDeliveryPartners(params);
            const payload = response.data?.result || {};
            const data = Array.isArray(payload.items) ? payload.items : (response.data?.results || response.data?.result || []);

            const mappedRiders = data.map((r) => {
                const isActive = r.isActive !== false;
                let status = 'offline';
                if (!isActive) {
                    status = 'deactivated';
                } else if (r.isOnline) {
                    status = 'available';
                }

                return {
                    id: r._id,
                    name: r.name || 'Unnamed Driver',
                    phone: r.phone || 'N/A',
                    email: r.email || 'N/A',
                    isActive,
                    status,
                    vehicle: r.vehicleType || 'Bike',
                    vehicleNum: r.vehicleNumber || 'N/A',
                    drivingLicenseNumber: r.drivingLicenseNumber || 'N/A',
                    totalDeliveries: Number(r.totalDeliveries || 0),
                    todayDeliveries: Number(r.todayDeliveries || 0),
                    activeOrdersCount: Number(r.activeOrdersCount || 0),
                    avatar: r.profileImage || null,
                    joinDate: r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : 'N/A',
                };
            });

            setRiders(mappedRiders);
            setTotal(typeof payload.total === 'number' ? payload.total : mappedRiders.length);
            setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
        } catch (error) {
            console.error('Fetch Riders Error:', error);
            toast.error('Failed to fetch delivery partners');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchRiders(1);
        }, 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize, searchTerm, statusFilter]);

    // Client-side quick filter
    const filteredRiders = useMemo(() => {
        return riders.filter((r) => {
            const matchesSearch =
                r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.phone.includes(searchTerm) ||
                r.vehicleNum.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [riders, searchTerm, statusFilter]);

    // Toggle Active / Deactivate Status (Real Backend API)
    const handleToggleStatus = async (rider) => {
        const newActiveState = !rider.isActive;
        const actionLabel = newActiveState ? 'reactivate' : 'deactivate';

        const confirmMsg = newActiveState
            ? `Are you sure you want to reactivate ${rider.name}? They will be able to log in again.`
            : `Are you sure you want to deactivate ${rider.name}? They will be logged out immediately and blocked from login.`;

        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsActionLoading(true);
        try {
            await adminApi.updateDeliveryPartnerStatus(rider.id, { isActive: newActiveState });
            toast.success(`Driver ${newActiveState ? 'activated' : 'deactivated'} successfully`);

            const updated = {
                ...rider,
                isActive: newActiveState,
                status: newActiveState ? 'offline' : 'deactivated',
            };

            setRiders((prev) => prev.map((r) => (r.id === rider.id ? updated : r)));
            if (viewingRider?.id === rider.id) {
                setViewingRider(updated);
            }
        } catch (error) {
            console.error('Update status error:', error);
            toast.error(error?.response?.data?.message || `Failed to ${actionLabel} driver`);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Permanently Delete Delivery Partner from Database
    const handleDelete = async (rider) => {
        const confirmMsg = `Are you sure you want to permanently delete ${rider.name} from the database? All records will be removed and they cannot log in again.`;
        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            await adminApi.deleteDeliveryPartner(rider.id);
            toast.success(`${rider.name} deleted successfully from database`);
            setRiders((prev) => prev.filter((r) => r.id !== rider.id));
            setTotal((prev) => Math.max(0, prev - 1));
            if (viewingRider?.id === rider.id) {
                setViewingRider(null);
            }
        } catch (error) {
            console.error('Delete rider error:', error);
            toast.error(error?.response?.data?.message || 'Failed to delete delivery partner');
        }
    };

    const stats = [
        { label: 'Total Fleet', value: total || riders.length, color: 'indigo', icon: Users, description: 'Total registered riders' },
        { label: 'Available (Online)', value: riders.filter((r) => r.status === 'available').length, color: 'emerald', icon: UserCheck, description: 'Ready for deliveries' },
        { label: 'Offline', value: riders.filter((r) => r.status === 'offline').length, color: 'amber', icon: Activity, description: 'Currently offline' },
        { label: 'Deactivated', value: riders.filter((r) => r.status === 'deactivated').length, color: 'rose', icon: XCircle, description: 'Blocked from login' },
    ];

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Active Drivers
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h1>
                    <p className="ds-description mt-1">Manage active delivery partners, live status, and driver fleet.</p>
                </div>
                <Link
                    to="/admin/delivery-boys/pending"
                    className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xl hover:shadow-slate-200 active:scale-95 group"
                >
                    <span>WAITING FOR REVIEW</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="p-6 border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all group overflow-hidden relative">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="ds-label mb-2">{stat.label}</p>
                                <h3 className="ds-stat-medium">{stat.value}</h3>
                            </div>
                            <div className={cn(
                                "p-3 rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg",
                                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600 shadow-indigo-100" :
                                    stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100" :
                                        stat.color === 'amber' ? "bg-amber-50 text-amber-600 shadow-amber-100" :
                                            "bg-rose-50 text-rose-600 shadow-rose-100"
                            )}>
                                <stat.icon className="h-5 w-5" strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-700" />
                    </Card>
                ))}
            </div>

            {/* Filters & Search Section */}
            <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/50 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name, phone or vehicle number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-100/50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-100/50 p-1 rounded-2xl flex items-center">
                            {['all', 'available', 'offline', 'deactivated'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        statusFilter === status
                                            ? "bg-white text-slate-900 shadow-sm"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Riders Grid View */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative min-h-[300px]">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-3xl">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching fleet...</p>
                        </div>
                    </div>
                )}
                <AnimatePresence mode="popLayout">
                    {!isLoading && filteredRiders.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                            <User className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-500">No delivery partners found matching your filters.</p>
                        </div>
                    ) : (
                        filteredRiders.map((rider) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={rider.id}
                            >
                                <Card className="group border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all overflow-hidden bg-white">
                                    <div className="p-6 space-y-5">
                                        {/* Rider Top Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="relative">
                                                    <img
                                                        src={
                                                            rider.avatar &&
                                                            !rider.avatar.includes('emoji') &&
                                                            !rider.avatar.includes('avatar')
                                                                ? rider.avatar
                                                                : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                                                        }
                                                        alt={rider.name}
                                                        className="h-14 w-14 rounded-lg bg-gray-100 ring-2 ring-white shadow-sm object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                    <div
                                                        className={cn(
                                                            'absolute -bottom-1 -right-1 h-4.5 w-4.5 rounded-full border-3 border-white shadow-sm',
                                                            rider.status === 'available'
                                                                ? 'bg-emerald-500'
                                                                : rider.status === 'deactivated'
                                                                ? 'bg-rose-500'
                                                                : 'bg-slate-300'
                                                        )}
                                                    />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">
                                                        {rider.name}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                                                        <Phone className="h-3 w-3" />
                                                        <span className="text-[10px] font-bold">{rider.phone}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge
                                                variant={
                                                    rider.status === 'available'
                                                        ? 'success'
                                                        : rider.status === 'deactivated'
                                                        ? 'danger'
                                                        : 'neutral'
                                                }
                                                className="uppercase font-black text-[9px] px-2.5 py-1"
                                            >
                                                {rider.status}
                                            </Badge>
                                        </div>

                                        {/* Metrics Row (Real Deliveries) */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                                                    Today&apos;s Orders
                                                </p>
                                                <div className="flex items-center gap-1.5">
                                                    <Package className="h-3.5 w-3.5 text-primary" />
                                                    <span className="text-xs font-black text-slate-900">
                                                        {rider.todayDeliveries} Deliv.
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-2xl">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">
                                                    Total Success
                                                </p>
                                                <div className="flex items-center gap-1.5">
                                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                                    <span className="text-xs font-black text-slate-900">
                                                        {rider.totalDeliveries} Deliv.
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Vehicle & Join Date Info */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <span className="text-[10px] font-semibold truncate">
                                                    {rider.vehicle} • <span className="text-slate-900 font-bold">{rider.vehicleNum}</span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-500">
                                                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                <span className="text-[10px] font-semibold truncate">
                                                    Partner Since: <span className="text-slate-700 font-bold">{rider.joinDate}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="pt-2 flex items-center gap-2">
                                            <button
                                                onClick={() => setViewingRider(rider)}
                                                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                VIEW PROFILE
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rider)}
                                                title="Delete rider permanently"
                                                className="p-2.5 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all active:scale-95"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex justify-center">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => fetchRiders(p)}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                    loading={isLoading}
                />
            </div>

            {/* Clean View Profile Modal */}
            <AnimatePresence>
                {viewingRider && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setViewingRider(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-8">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex gap-5 items-center">
                                        <img
                                            src={
                                                viewingRider.avatar &&
                                                !viewingRider.avatar.includes('emoji') &&
                                                !viewingRider.avatar.includes('avatar')
                                                    ? viewingRider.avatar
                                                    : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                                            }
                                            alt={viewingRider.name}
                                            className="h-20 w-20 rounded-2xl bg-gray-100 ring-4 ring-slate-50 shadow-lg object-cover"
                                        />
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900">{viewingRider.name}</h2>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <Badge
                                                    variant={
                                                        viewingRider.status === 'available'
                                                            ? 'success'
                                                            : viewingRider.status === 'deactivated'
                                                            ? 'danger'
                                                            : 'neutral'
                                                    }
                                                    className="uppercase font-black text-[9px] px-2.5 py-0.5"
                                                >
                                                    {viewingRider.status}
                                                </Badge>
                                                <span className="text-xs font-bold text-slate-400">
                                                    ID: RD-{viewingRider.id.slice(-6).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setViewingRider(null)}
                                        className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                                    >
                                        <XCircle className="h-5 w-5 text-slate-400" />
                                    </button>
                                </div>

                                {/* Real Details Grid */}
                                <div className="grid grid-cols-2 gap-5 mb-8 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Contact Number
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.phone}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Email Address
                                        </p>
                                        <p className="text-sm font-bold text-slate-900 truncate">{viewingRider.email}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Fleet Partner Since
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.joinDate}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Vehicle Type
                                        </p>
                                        <p className="text-sm font-bold text-slate-900 uppercase">{viewingRider.vehicle}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Vehicle Reg. Number
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.vehicleNum}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Driving License No.
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">{viewingRider.drivingLicenseNumber}</p>
                                    </div>
                                </div>

                                {/* Performance Grid (Real Backend Counts) */}
                                <div className="grid grid-cols-2 gap-4 p-5 bg-white rounded-2xl border border-slate-200/80 mb-8">
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                                            Today&apos;s Deliveries
                                        </p>
                                        <span className="text-2xl font-black text-primary">
                                            {viewingRider.todayDeliveries}
                                        </span>
                                    </div>
                                    <div className="text-center border-l border-slate-200">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">
                                            Total Deliveries
                                        </p>
                                        <span className="text-2xl font-black text-slate-900">
                                            {viewingRider.totalDeliveries}
                                        </span>
                                    </div>
                                </div>

                                {/* Real Action Buttons */}
                                <div className="flex gap-3">
                                    {viewingRider.isActive ? (
                                        <button
                                            disabled={isActionLoading}
                                            onClick={() => handleToggleStatus(viewingRider)}
                                            className="flex-1 py-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            DEACTIVATE DRIVER
                                        </button>
                                    ) : (
                                        <button
                                            disabled={isActionLoading}
                                            onClick={() => handleToggleStatus(viewingRider)}
                                            className="flex-1 py-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            REACTIVATE DRIVER
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(viewingRider)}
                                        className="px-5 py-4 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                        title="Delete permanently"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ActiveDeliveryBoys;
