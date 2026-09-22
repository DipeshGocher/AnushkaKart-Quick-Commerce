import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, CheckCircle2, XCircle, 
  Trash2, Eye, ShieldCheck, Sparkles, AlertTriangle, ExternalLink, MapPin
} from 'lucide-react';
import { getC2CAds, deleteC2CAd } from '../../../customer/data/c2cMockData';
import { toast } from 'sonner';

const C2CAdsManagement = () => {
  const [ads, setAds] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    setAds(getC2CAds());
  }, []);

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

  const filtered = ads.filter((a) => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
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
            Monitor and moderate pre-owned items posted directly by customers.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-center">
            <span className="text-xs font-bold text-gray-400 block">Total Ads</span>
            <span className="text-sm font-black text-white">{ads.length}</span>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-1.5 text-center">
            <span className="text-xs font-bold text-blue-400 block">Active</span>
            <span className="text-sm font-black text-blue-300">
              {ads.filter(a => a.status !== 'Sold').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3">
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
            <option value="electronics">Electronics</option>
            <option value="vehicles">Vehicles</option>
            <option value="furniture">Furniture</option>
            <option value="fashion">Fashion</option>
          </select>
        </div>
      </div>

      {/* Ads Table / Cards */}
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
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filtered.map((ad) => (
                <tr key={ad.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={ad.images?.[0]}
                        alt={ad.title}
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                      <div className="max-w-xs">
                        <p className="font-bold text-white line-clamp-1">{ad.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span className="capitalize">{ad.category}</span>
                          <span>•</span>
                          <span>{ad.condition}</span>
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
                      <span>{ad.location || ad.city}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      ad.status === 'Sold'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {ad.status === 'Sold' ? 'Sold' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Marketplace Banner Customization Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-[#0F4C81]" />
          <h3 className="text-sm font-black text-white">Marketplace Promotion Banner Customization</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Update the main banner image displayed at the top of the C2C section (/marketplace).
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Enter Banner Image URL (e.g. https://images.unsplash.com/...)"
            defaultValue={localStorage.getItem('c2c_banner_image') || ''}
            id="c2c-banner-input"
            className="flex-1 h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-hidden focus:border-[#0F4C81] w-full"
          />
          <button
            type="button"
            onClick={() => {
              const val = document.getElementById('c2c-banner-input')?.value;
              if (val) {
                localStorage.setItem('c2c_banner_image', val.trim());
                toast.success('Marketplace banner updated successfully!');
              }
            }}
            className="h-10 px-5 rounded-xl bg-[#0F4C81] hover:bg-[#0A365C] text-white font-bold text-xs shadow-md transition-colors w-full sm:w-auto shrink-0"
          >
            Save Banner Image
          </button>
        </div>
      </div>
    </div>
  );
};

export default C2CAdsManagement;
