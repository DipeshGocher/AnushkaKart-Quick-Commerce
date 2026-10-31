import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  Eye,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  X,
  Bike,
  Info,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/shared/components/ui/Button";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { deliveryApi } from "../../services/deliveryApi";
import { toast } from "sonner";

const Documents = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { settings } = useSettings();
  const appName = settings?.appName || "Anushka Connect";

  const [profile, setProfile] = useState(authUser || null);
  const [loading, setLoading] = useState(false);
  const [activeUploadDoc, setActiveUploadDoc] = useState(null); // { docType, title }
  const [isUploading, setIsUploading] = useState(false);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState(null); // { title, url, number }
  const [imgError, setImgError] = useState(false);

  // File input ref
  const fileInputRef = useRef(null);

  // Fetch latest profile from backend
  const fetchProfile = async () => {
    try {
      const res = await deliveryApi.getProfile();
      const data = res.data?.result || res.data?.delivery || res.data;
      if (data && typeof data === "object") {
        setProfile(data);
      }
    } catch (error) {
      console.warn("Failed to fetch fresh profile, using cached:", error);
    }
  };

  useEffect(() => {
    if (authUser) {
      setProfile((prev) => ({ ...prev, ...authUser }));
    }
    fetchProfile();
  }, [authUser]);

  // Handle Trigger Upload
  const handleTriggerUpload = (docType, title) => {
    setActiveUploadDoc({ docType, title });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Handle File Selected & Upload to Backend
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadDoc) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Validate type
    const validMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "application/pdf",
    ];
    if (!validMimes.includes(file.type)) {
      toast.error("Please select a valid image (JPG, PNG, WEBP) or PDF file");
      return;
    }

    const { docType, title } = activeUploadDoc;
    const toastId = toast.loading(`Uploading ${title}...`);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("file", file);

      const res = await deliveryApi.uploadDocument(formData);
      const newUrl = res.data?.result?.url || res.data?.url;

      toast.success(`${title} uploaded successfully!`, { id: toastId });

      // Update local state immediately
      setProfile((prev) => {
        const next = { ...prev };
        if (!next.documents) next.documents = {};
        next.documents[docType] = newUrl;
        return next;
      });

      // Background re-fetch to ensure sync
      fetchProfile();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.message || `Failed to upload ${title}`, {
        id: toastId,
      });
    } finally {
      setIsUploading(false);
      setActiveUploadDoc(null);
    }
  };

  // Documents Definition based on Real Schema
  const isCycleRider = profile?.vehicleType === "cycle";
  const isVerified = Boolean(profile?.isVerified);

  const documentItems = [
    {
      id: "aadhar",
      docType: "aadhar",
      title: "Aadhar Card",
      subtitle: "Government Identity Proof",
      number: "12-Digit UIDAI Identity",
      url: profile?.documents?.aadhar || null,
      required: true,
    },
    {
      id: "pan",
      docType: "pan",
      title: "PAN Card",
      subtitle: "Tax Identification Proof",
      number: "10-Character Income Tax PAN",
      url: profile?.documents?.pan || null,
      required: true,
    },
    {
      id: "drivingLicense",
      docType: "drivingLicense",
      title: "Driving License (DL)",
      subtitle: isCycleRider
        ? "Exempted (Bicycle Delivery Fleet)"
        : "Two-Wheeler Road Compliance",
      number: profile?.drivingLicenseNumber || (isCycleRider ? "Not Applicable" : "DL Number on Record"),
      url: profile?.documents?.drivingLicense || profile?.drivingLicense || null,
      required: !isCycleRider,
      isCycle: isCycleRider,
    },
  ];

  const handleOpenPreview = (doc) => {
    if (!doc.url) {
      toast.info(`No file uploaded for ${doc.title}. Please upload a document.`);
      return;
    }
    setImgError(false);
    setPreviewDoc(doc);
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-36">
      {/* Hidden file input for document uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

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
          <div className="flex-1">
            <h1 className="ds-h3 text-gray-900 font-bold">My Documents</h1>
            <p className="text-[11px] text-slate-500">
              Official Verification & Platform Compliance
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Verification Status Overview Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
            isVerified
              ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
              : "bg-amber-50/70 border-amber-200/80 text-amber-900"
          }`}
        >
          {isVerified ? (
            <ShieldCheck size={24} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Clock size={24} className="text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isVerified
                ? "Account Verified & Approved"
                : "Documents Under Verification"}
            </h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {isVerified
                ? `All your submitted KYC documents have been reviewed and approved by the ${appName} fleet team.`
                : "Your submitted documents are currently being vetted by the fleet compliance team. You can re-upload if any document is unclear."}
            </p>
          </div>
        </div>

        {/* Real Documents List */}
        <div className="space-y-3">
          {documentItems.map((doc) => {
            const hasFile = Boolean(doc.url);

            return (
              <div
                key={doc.id}
                className="p-4 border border-slate-200/80 shadow-sm rounded-2xl bg-white hover:border-[#6666FF]/30 transition-all"
              >
                {/* Top Info Row */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-[#6666FF] shrink-0 mt-0.5">
                      {doc.isCycle ? <Bike size={22} /> : <FileText size={22} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-gray-900 text-sm truncate">
                          {doc.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{doc.subtitle}</p>
                      <p className="text-[11px] font-mono font-semibold text-slate-700 mt-1">
                        {doc.number}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {doc.isCycle ? (
                      <span className="inline-flex items-center text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                        Exempted
                      </span>
                    ) : isVerified ? (
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

                {/* File Status Indicator */}
                <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-50/70 border border-slate-100 mb-3">
                  <span className="text-[11px] text-slate-500 font-medium">
                    File Status:
                  </span>
                  {hasFile ? (
                    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-600">
                      <CheckCircle2 size={13} className="mr-1 text-emerald-500" />
                      Document on File
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-semibold text-rose-500">
                      <AlertCircle size={13} className="mr-1 text-rose-500" />
                      {doc.isCycle ? "Not required for cycle" : "No file uploaded"}
                    </span>
                  )}
                </div>

                {/* Actions: View & Update/Upload */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {hasFile ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPreview(doc)}
                        className="flex-1 h-9 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                      >
                        <Eye size={13} className="mr-1.5 text-slate-500" />
                        View File
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUploading}
                        onClick={() => handleTriggerUpload(doc.docType, doc.title)}
                        className="flex-1 h-9 text-xs font-semibold border-indigo-200 text-[#6666FF] hover:bg-indigo-50/70 active:scale-95 transition-all"
                      >
                        {isUploading && activeUploadDoc?.docType === doc.docType ? (
                          <>
                            <Loader2 size={13} className="mr-1.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <UploadCloud size={13} className="mr-1.5 text-[#6666FF]" />
                            Update
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      disabled={isUploading}
                      onClick={() => handleTriggerUpload(doc.docType, doc.title)}
                      className="w-full h-9 text-xs font-semibold bg-[#6666FF] hover:bg-[#5555EE] text-white active:scale-95 transition-all"
                    >
                      {isUploading && activeUploadDoc?.docType === doc.docType ? (
                        <>
                          <Loader2 size={13} className="mr-1.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <UploadCloud size={14} className="mr-1.5 text-white" />
                          Upload {doc.title}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Guidelines Card */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
          <Info size={20} className="text-[#6666FF] shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 space-y-1">
            <h5 className="font-bold text-slate-900">Document Upload Guidelines:</h5>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
              <li>Ensure all 4 corners of the original document are clearly visible.</li>
              <li>Avoid camera glare or blurry photos so details remain legible.</li>
              <li>Supported file formats: JPG, PNG, WEBP, or PDF (up to 10MB).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lightbox / Document Preview Modal (Z-[600] sits on top of floating BottomNav) */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setPreviewDoc(null)}
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
                    <h3 className="text-sm font-bold text-slate-900">
                      {previewDoc.title}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      {previewDoc.number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body / Image Viewer */}
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 min-h-[260px]">
                {imgError || !previewDoc.url ? (
                  <div className="text-center p-6">
                    <AlertCircle size={36} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-700">
                      Preview Not Available
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Unable to render inline preview. Please try opening in browser.
                    </p>
                  </div>
                ) : previewDoc.url.toLowerCase().endsWith(".pdf") ? (
                  <div className="text-center p-6">
                    <FileText size={48} className="mx-auto text-[#6666FF] mb-3" />
                    <p className="text-xs font-bold text-slate-800">
                      PDF Document Ready
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 mb-4">
                      Click below to view or download the complete PDF file.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => window.open(previewDoc.url, "_blank", "noopener,noreferrer")}
                      className="bg-[#6666FF] text-white text-xs h-8 px-4"
                    >
                      <ExternalLink size={13} className="mr-1.5" />
                      Open PDF Document
                    </Button>
                  </div>
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    onError={() => setImgError(true)}
                    className="max-h-[50vh] w-auto max-w-full rounded-xl object-contain shadow-sm border border-slate-200/60 bg-white"
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2">
                {previewDoc.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-9 border-slate-200"
                    onClick={() => window.open(previewDoc.url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink size={13} className="mr-1.5" />
                    Open in Browser
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 text-xs h-9 bg-[#6666FF] hover:bg-[#5555EE] text-white"
                  onClick={() => setPreviewDoc(null)}
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

export default Documents;
