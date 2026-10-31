import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  ShieldCheck,
  Clock,
  FileText,
  AlertCircle,
  MapPin,
  Calendar,
  Eye,
  ExternalLink,
  X,
  ChevronRight,
  Headphones,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/shared/components/ui/Card";
import Button from "@/shared/components/ui/Button";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { deliveryApi } from "../../services/deliveryApi";
import { toast } from "sonner";

const VehicleInfo = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { settings } = useSettings();
  const appName = settings?.appName || "Anushka Connect";

  const [profile, setProfile] = useState(authUser || null);
  const [showDlModal, setShowDlModal] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Sync with authUser and fetch fresh profile from backend
  useEffect(() => {
    if (authUser) {
      setProfile((prev) => ({ ...prev, ...authUser }));
    }

    let isMounted = true;
    const fetchFreshProfile = async () => {
      try {
        const res = await deliveryApi.getProfile();
        const data = res.data?.result || res.data?.delivery || res.data;
        if (isMounted && data && typeof data === "object") {
          setProfile(data);
        }
      } catch (err) {
        // Fallback to authUser gracefully
      }
    };

    fetchFreshProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser]);

  // Vehicle Type Formatter
  const getVehicleTypeLabel = (type) => {
    const norm = String(type || "bike").toLowerCase().trim();
    if (norm === "scooter") return "Two-Wheeler (Scooter)";
    if (norm === "cycle") return "Bicycle / Electric Cycle";
    return "Two-Wheeler (Motorcycle / Bike)";
  };

  // Fleet ID
  const fleetId = profile?._id || profile?.id
    ? `RD-${String(profile?._id || profile?.id).slice(-6).toUpperCase()}`
    : "RD-DELIVERY";

  // Join Date
  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Active Fleet";

  // Operating Hub / Area
  const operationalArea =
    profile?.currentArea ||
    profile?.address ||
    "Assigned Operational Hub";

  // Driving License URL & Number
  const dlNumber = profile?.drivingLicenseNumber || "Not Available";
  const dlUrl =
    profile?.documents?.drivingLicense ||
    profile?.drivingLicense ||
    profile?.documents?.dl ||
    null;

  const isVerified = Boolean(profile?.isVerified);

  const handleOpenDlPreview = () => {
    if (!dlUrl) {
      toast.info("Driving license file was not uploaded during signup. Please visit Partner Support to update.");
      return;
    }
    setImgError(false);
    setShowDlModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-36">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900 font-bold">Vehicle Information</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Top Vehicle Details Card */}
        <Card className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-none shadow-xl rounded-2xl relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#6666FF]/15 rounded-full blur-2xl pointer-events-none" />

          <div className="flex justify-between items-start mb-5 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-white/10 px-2 py-0.5 rounded-full">
                  Registered Vehicle
                </span>
                <span className="flex items-center text-[10px] text-emerald-400 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block mr-1 animate-pulse" />
                  Fleet Active
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-wide text-white">
                {profile?.vehicleNumber || "Registration Pending"}
              </h2>
              <p className="text-xs font-medium text-slate-300 mt-0.5">
                {getVehicleTypeLabel(profile?.vehicleType)}
              </p>
            </div>

            {/* Dynamic Two-Wheeler Icon (No Truck!) */}
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md ring-1 ring-white/15 shadow-inner">
              <Bike size={28} className="text-white" />
            </div>
          </div>

          {/* Sub-grid with Real Backend Info (Replacing dummy Color & Fuel Type) */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 relative z-10">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                Operational Hub / Area
              </p>
              <div className="flex items-center text-xs font-semibold text-white">
                <MapPin size={12} className="text-[#8888FF] mr-1.5 shrink-0" />
                <span className="truncate" title={operationalArea}>
                  {operationalArea}
                </span>
              </div>
            </div>

            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                Fleet Partner ID
              </p>
              <div className="flex items-center text-xs font-semibold text-white">
                <span className="text-indigo-300 font-mono font-bold mr-1.5">
                  {fleetId}
                </span>
              </div>
              <div className="flex items-center text-[10px] text-slate-400 mt-0.5">
                <Calendar size={10} className="mr-1 shrink-0 text-slate-500" />
                <span>Since {joinDate}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Vehicle Documents & Compliance Section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="ds-h4 text-gray-900 font-bold">Vehicle Documents</h3>
            <span className="text-xs text-slate-500">Required for On-Road Duty</span>
          </div>

          <div className="space-y-3">
            {/* Driving License Card */}
            <div className="p-4 border border-slate-200/80 shadow-sm rounded-2xl bg-white hover:border-[#6666FF]/30 transition-all">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-[#6666FF] shrink-0 mt-0.5">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Driving License (DL)</h4>
                    <p className="text-xs font-mono font-semibold text-gray-700 mt-0.5">
                      {dlNumber}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      {dlUrl ? (
                        <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium">
                          <CheckCircle2 size={12} className="mr-1 text-emerald-500" />
                          Photo on Record
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] text-slate-400">
                          No file uploaded
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Real Verification Status Badge */}
                <div className="shrink-0">
                  {isVerified ? (
                    <span className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <ShieldCheck size={12} className="mr-1 text-emerald-600" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <Clock size={12} className="mr-1 text-amber-600" />
                      Under Review
                    </span>
                  )}
                </div>
              </div>

              {/* Action: View Uploaded DL */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  Official Road Verification
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenDlPreview}
                  className="h-8 px-3 text-xs font-semibold border-indigo-200 text-[#6666FF] hover:bg-indigo-50/70 active:scale-95 transition-all"
                >
                  <Eye size={13} className="mr-1.5" />
                  View Uploaded DL
                </Button>
              </div>
            </div>

            {/* Other Documents Navigation Tile */}
            <div
              onClick={() => navigate("/delivery/profile/documents")}
              className="p-3.5 border border-slate-200/80 shadow-sm rounded-2xl bg-white hover:bg-slate-50 cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <h5 className="text-xs font-bold text-gray-900 truncate">
                    Identity Documents (Aadhar & PAN)
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    View linked identity verification proofs
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* Support & Modification Note */}
        <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/90 border border-indigo-100 p-4 rounded-2xl">
          <div className="flex items-start">
            <AlertCircle size={20} className="text-[#6666FF] mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold text-slate-900 mb-1">
                Need to change vehicle or license details?
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                For security and road safety compliance, your vehicle registration and license cannot be edited directly from the app. Please visit your nearest {appName} Partner Center with original documents or contact Support.
              </p>
              <button
                onClick={() => navigate("/delivery/profile/help-support")}
                className="mt-3 inline-flex items-center text-xs font-bold text-[#6666FF] hover:text-indigo-800 bg-white px-3.5 py-2 rounded-xl shadow-sm border border-indigo-200/80 transition-all active:scale-95"
              >
                <Headphones size={13} className="mr-1.5 text-[#6666FF]" />
                Contact Partner Support
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Driving License Image Preview Modal (Z-[600] sits on top of floating BottomNav) */}
      <AnimatePresence>
        {showDlModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setShowDlModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-[#6666FF] rounded-xl">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Driving License Preview</h3>
                    <p className="text-[11px] font-mono text-slate-500">{dlNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDlModal(false)}
                  className="p-2 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body / Image Viewer */}
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 min-h-[240px]">
                {imgError || !dlUrl ? (
                  <div className="text-center p-6">
                    <AlertCircle size={36} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Preview Not Available</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Unable to display image. You can try opening it in a new window.
                    </p>
                  </div>
                ) : (
                  <img
                    src={dlUrl}
                    alt="Driving License"
                    onError={() => setImgError(true)}
                    className="max-h-[50vh] w-auto max-w-full rounded-xl object-contain shadow-sm border border-slate-200/60 bg-white"
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2">
                {dlUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-9 border-slate-200"
                    onClick={() => window.open(dlUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink size={13} className="mr-1.5" />
                    Open in Browser
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 text-xs h-9 bg-[#6666FF] hover:bg-[#5555EE] text-white"
                  onClick={() => setShowDlModal(false)}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VehicleInfo;
