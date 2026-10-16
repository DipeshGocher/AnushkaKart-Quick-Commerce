import React, { useState, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import {
  MapPin,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  Bike,
  Clock,
  Trash2,
  Edit2,
  AlertCircle,
  Globe,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";
import { useToast } from "@shared/components/ui/Toast";
import { adminShippingApi } from "../services/api/shippingApi";

const DeliveryPincodes = () => {
  const { showToast } = useToast();
  const [pincodes, setPincodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    pincode: "",
    areaName: "",
    city: "",
    state: "",
    deliveryTimeEstimate: "20-35 mins",
    isActive: true,
    notes: "",
    riderRadiusKm: 10,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPincodes = async () => {
    try {
      setLoading(true);
      const res = await adminShippingApi.getPincodes({
        search,
        status: statusFilter,
        limit: 100,
      });
      if (res.data?.success && res.data.result) {
        setPincodes(res.data.result.items || []);
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load pincodes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPincodes();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPincodes();
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      pincode: "",
      areaName: "",
      city: "Mauranipur",
      state: "Uttar Pradesh",
      deliveryTimeEstimate: "20-35 mins",
      isActive: true,
      notes: "",
      riderRadiusKm: 10,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      pincode: item.pincode,
      areaName: item.areaName || "",
      city: item.city || "",
      state: item.state || "",
      deliveryTimeEstimate: item.deliveryTimeEstimate || "20-35 mins",
      isActive: item.isActive !== false,
      notes: item.notes || "",
      riderRadiusKm: item.riderRadiusKm !== undefined ? item.riderRadiusKm : 10,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pincode || formData.pincode.trim().length < 4) {
      showToast("Please enter a valid pincode", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingItem) {
        const res = await adminShippingApi.updatePincode(editingItem._id, formData);
        const updatedDoc = res.data?.result || res.data?.results;
        setPincodes((prev) =>
          prev.map((p) =>
            p._id === editingItem._id
              ? {
                  ...p,
                  ...formData,
                  ...(updatedDoc && typeof updatedDoc === "object" ? updatedDoc : {}),
                  riderRadiusKm:
                    updatedDoc?.riderRadiusKm !== undefined
                      ? Number(updatedDoc.riderRadiusKm)
                      : Number(formData.riderRadiusKm),
                }
              : p
          )
        );
        showToast(`Pincode ${formData.pincode} updated successfully`, "success");
      } else {
        const res = await adminShippingApi.createPincode(formData);
        const newDoc = res.data?.result || res.data?.results;
        if (newDoc && typeof newDoc === "object") {
          setPincodes((prev) => [...prev, newDoc]);
        }
        showToast(`Pincode ${formData.pincode} added to Local Delivery Zone`, "success");
      }
      setIsModalOpen(false);
      fetchPincodes();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to save pincode", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const res = await adminShippingApi.togglePincode(item._id);
      if (res.data?.success) {
        setPincodes((prev) =>
          prev.map((p) => (p._id === item._id ? { ...p, isActive: !p.isActive } : p))
        );
        showToast(`Pincode ${item.pincode} status changed`, "success");
      }
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to toggle status", "error");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to remove pincode ${item.pincode}? Orders to this pincode will now be routed to Shiprocket.`)) {
      return;
    }

    try {
      await adminShippingApi.deletePincode(item._id);
      setPincodes((prev) => prev.filter((p) => p._id !== item._id));
      showToast(`Pincode ${item.pincode} deleted`, "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to delete pincode", "error");
    }
  };

  const activeCount = pincodes.filter((p) => p.isActive).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
            <MapPin size={18} />
            <span>Hybrid Fulfillment Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Delivery Pincodes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure local in-house delivery zones vs Pan-India Shiprocket courier fulfillment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPincodes}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-primary" : ""} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/95 shadow-sm shadow-primary/20 transition active:scale-95"
          >
            <Plus size={18} />
            <span>Add Local Pincode</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-emerald-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Local Hyperlocal Zones</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{activeCount} Pincodes</h3>
              <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <Bike size={13} /> In-House Delivery Boys
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Bike size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Out of Reach Delivery</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">Shiprocket</h3>
              <p className="text-xs text-blue-600 mt-1 font-medium flex items-center gap-1">
                <Truck size={13} /> Pan-India Couriers
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Commerce Speed</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">20-35 Mins</h3>
              <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                <Clock size={13} /> Local Delivery Partner App
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={24} />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Standard Courier ETA</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">3-4 Days</h3>
              <p className="text-xs text-purple-600 mt-1 font-medium flex items-center gap-1">
                <Globe size={13} /> Automatic Courier Routing
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Globe size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Explanatory Rule Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/60 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm">
        <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1 text-sm">
          <h4 className="font-bold text-slate-800">How Hybrid Delivery Routing Works:</h4>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            <span className="font-semibold text-emerald-700">1. Local Quick Commerce (In-House Boys):</span> When a customer's address matches an active pincode in the table below (such as Mauranipur <b>284204</b> or <b>284205</b>), the order is assigned to local delivery boys using your existing broadcast / manual workflow with instant 20-35 min delivery & OTP.
          </p>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            <span className="font-semibold text-blue-700">2. Out-of-Reach (Shiprocket Courier):</span> Any address with a pincode outside this local list is automatically classified as a <b>Shiprocket Courier Order</b>. The customer sees estimated delivery in 3-4 days at checkout, and Super Admin can generate AWBs, schedule pickups, print labels, and track shipments directly from the Orders dashboard.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search pincode, area, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500">Filter:</span>
            {["all", "active", "inactive"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Pincodes Table */}
      <Card className="overflow-hidden bg-white border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Pincode</th>
                <th className="py-3.5 px-4 font-bold">Area / Sector</th>
                <th className="py-3.5 px-4 font-bold">City & State</th>
                <th className="py-3.5 px-4 font-bold">Delivery Estimate</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Fulfillment Channel</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} />
                    Loading delivery zones...
                  </td>
                </tr>
              ) : pincodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <MapPin className="mx-auto mb-2 text-slate-300" size={32} />
                    <p className="font-semibold text-slate-700">No local delivery pincodes found</p>
                    <p className="text-xs text-slate-400 mt-1">Add pincodes where you have in-house delivery boys.</p>
                  </td>
                </tr>
              ) : (
                pincodes.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900 text-base font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                        {item.pincode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {item.areaName || <span className="text-slate-400 italic">Not specified</span>}
                      {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      <div className="font-semibold text-slate-700">{item.city || "—"}</div>
                      <div className="text-slate-400">{item.state || "—"}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-mono">
                        <Clock size={12} /> {item.deliveryTimeEstimate || "20-35 mins"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer ${
                          item.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"
                        }`}
                        title={item.isActive ? "Click to Deactivate (will route to Shiprocket)" : "Click to Activate (In-House local riders)"}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            item.isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                          }`}
                        />
                        {item.isActive ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle size={13} className="text-slate-400" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                          <Bike size={13} className="text-emerald-600" />
                          <span>Local Riders (≤ {item.riderRadiusKm !== undefined && item.riderRadiusKm !== null ? item.riderRadiusKm : 10} km)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Truck size={13} /> Routes to Shiprocket
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`p-1.5 rounded-lg border transition ${
                            item.isActive
                              ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/70 border-emerald-200"
                              : "text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300"
                          }`}
                          title={item.isActive ? "Click to Deactivate (Routes to Shiprocket)" : "Click to Activate (In-House Riders)"}
                        >
                          {item.isActive ? <Power size={15} /> : <PowerOff size={15} />}
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200"
                          title="Edit Pincode"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition border border-rose-200/60"
                          title="Delete Pincode"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[88vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white shrink-0">
              <h3 className="font-bold text-lg text-slate-900">
                {editingItem ? "Edit Local Pincode" : "Add Local Delivery Pincode"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Pincode <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 284204"
                    maxLength={6}
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, "") })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-xs text-slate-400 mt-1">Orders for this pincode will be delivered by in-house riders.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Area Name / Sector
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mauranipur Hub / Main Market"
                    value={formData.areaName}
                    onChange={(e) => setFormData({ ...formData, areaName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mauranipur"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Uttar Pradesh"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Delivery Time Estimate
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20-35 mins"
                    value={formData.deliveryTimeEstimate}
                    onChange={(e) => setFormData({ ...formData, deliveryTimeEstimate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-xs text-slate-400 mt-1">Displayed to customer at checkout for this pincode.</p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Delivery Boys Alert Radius (Max 30 km)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={formData.riderRadiusKm ?? 10}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          const val = isNaN(parsed) ? 1 : Math.min(Math.max(parsed, 1), 30);
                          setFormData({ ...formData, riderRadiusKm: val });
                        }}
                        className="w-14 px-2 py-0.5 text-center text-xs font-black text-primary bg-primary/10 border border-primary/20 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs font-bold text-slate-600">km</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={formData.riderRadiusKm ?? 10}
                    onChange={(e) => setFormData({ ...formData, riderRadiusKm: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                    <span>1 km</span>
                    <span>15 km</span>
                    <span>30 km (Max Limit)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Store orders in this pincode will alert local delivery riders within {formData.riderRadiusKm ?? 10} km radius.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any delivery instructions or territory notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/95 transition shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingItem ? "Update Pincode" : "Add Pincode"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryPincodes;
