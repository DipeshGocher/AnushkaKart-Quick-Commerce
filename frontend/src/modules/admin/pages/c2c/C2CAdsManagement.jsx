import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, CheckCircle2, XCircle, 
  Trash2, Eye, ShieldCheck, Sparkles, AlertTriangle, ExternalLink, MapPin, Check
} from 'lucide-react';
import { getC2CAds, deleteC2CAd, approveC2CAd } from '../../../customer/data/c2cMockData';
import { toast } from 'sonner';

const C2CAdsManagement = () => {
  const [ads, setAds] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'active' | 'sold'

  const loadAds = () => {
    setAds(getC2CAds(true)); // Include pending ads
  };

  useEffect(() => {
    loadAds();
    window.addEventListener('c2c_ads_updated', loadAds);
    return () => window.removeEventListener('c2c_ads_updated', loadAds);
  }, []);

  const handleApprove = (id, title) => {
    const updated = approveC2CAd(id);
    setAds(updated);
    toast.success(`"${title}" approved successfully! Notification sent to customer.`);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this customer ad from the marketplace?')) {
      const updated = deleteC2CAd(id);
      setAds(updated);
      toast.success('Ad removed from marketplace');
    }
  };

  const handleToggleElite = (id) => {
    const updated = ads.map(a => a.id === id ? { ...a, isElite: !a.isElite } : a);
    localStorage.setItem('c2c_marketplace_ads', JSON.stringify(updated));
    setAds(updated);
    toast.success('Ad badge updated');
  };

  const pendingCount = ads.filter(a => a.status === 'Pending Approval' || a.isApproved === false).length;

  const filtered = ads.filter((a) => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (filterStatus === 'pending') {
      if (a.status !== 'Pending Approval' && a.isApproved !== false) return false;
    } else if (filterStatus === 'active') {
      if (a.status === 'Pending Approval' || a.isApproved === false || a.status === 'Sold') return false;
    } else if (filterStatus === 'sold') {
      if (a.status !== 'Sold') return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.title?.toLowerCase().includes(q) || a.seller?.name?.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 mb-1">
            <Sparkles size={12} /> C2C Marketplace (OLX Module)
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Customer Ads & Moderation
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Review product approval requests, moderate listings, and manage pre-owned items.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-3 py-1.5 text-center cursor-pointer hover:bg-amber-500/30 transition-colors"
            >
              <span className="text-xs font-bold text-amber-300 block">Pending Review</span>
              <span className="text-sm font-black text-amber-200">{pendingCount}</span>
            </button>
          )}
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-center">
            <span className="text-xs font-bold text-gray-400 block">Total Ads</span>
            <span className="text-sm font-black text-white">{ads.length}</span>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5 text-center">
            <span className="text-xs font-bold text-blue-400 block">Live & Active</span>
            <span className="text-sm font-black text-blue-300">
              {ads.filter(a => a.status === 'Active' || (!a.status && a.isApproved !== false)).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 space-y-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Listings', count: ads.length },
            { id: 'pending', label: 'Pending Approval', count: pendingCount, highlight: pendingCount > 0 },
            { id: 'active', label: 'Active', count: ads.filter(a => a.status === 'Active' || (!a.status && a.isApproved !== false)).length },
            { id: 'sold', label: 'Sold', count: ads.filter(a => a.status === 'Sold').length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filterStatus === tab.id
                  ? 'bg-[#0F4C81] text-white shadow-sm'
                  : tab.highlight
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search and Category Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ads by title, seller name, or city..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-white placeholder:text-gray-500 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[#0e121b] border border-white/10 text-xs font-semibold text-gray-300 focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="mobiles">Mobiles</option>
              <option value="laptops">Laptops</option>
              <option value="smartwatches">SmartWatches</option>
              <option value="earphones">Earphones</option>
              <option value="cameras">Cameras</option>
              <option value="tv">TV</option>
              <option value="gaming">Gaming</option>
              <option value="appliances">Appliances</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ads Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item & Title</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Customer Seller</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Approval & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filtered.map((ad) => {
                const isPending = ad.status === 'Pending Approval' || ad.isApproved === false;

                return (
                  <tr key={ad.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={ad.images?.[0] || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=200&auto=format&fit=crop&q=80'}
                          alt={ad.title}
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                        />
                        <div className="max-w-xs">
                          <p className="font-bold text-white line-clamp-1">{ad.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            <span className="capitalize">{ad.categoryName || ad.category}</span>
                            <span>•</span>
                            <span>{ad.brand || 'Unbranded'}</span>
                            {ad.isElite && (
                              <span className="bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                Featured
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-black text-white">
                      ₹{ad.price?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-200">{ad.seller?.name || 'Customer'}</span>
                        {ad.seller?.verified && (
                          <ShieldCheck size={13} className="text-blue-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500">{ad.seller?.phone || 'Private'}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-gray-500" />
                        <span>{ad.location || ad.city || 'Indore'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {isPending ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold text-[10px] animate-pulse">
                          Pending Approval
                        </span>
                      ) : ad.status === 'Sold' ? (
                        <span className="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          Sold
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          Active & Live
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Approve Button for Pending Ads */}
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleApprove(ad.id, ad.title)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] rounded-lg shadow-sm transition-all"
                            title="Approve this product so it goes live for customers"
                          >
                            <Check size={13} strokeWidth={3} />
                            <span>Approve</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleElite(ad.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            ad.isElite
                              ? 'bg-amber-400/20 text-amber-300'
                              : 'hover:bg-white/10 text-gray-400'
                          }`}
                          title={ad.isElite ? 'Remove featured' : 'Make featured'}
                        >
                          <Sparkles size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ad.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Delete Ad"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No ads found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default C2CAdsManagement;
