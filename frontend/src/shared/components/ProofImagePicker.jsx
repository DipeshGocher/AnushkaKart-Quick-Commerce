import React, { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

/**
 * Upload up to `max` proof photos and report their URLs via `onChange`.
 * Uploads go to /media/upload. There is deliberately NO base64 fallback:
 * the backend only accepts real image URLs for QC / dispute evidence.
 */
const ProofImagePicker = ({ images, onChange, max = 5, onError, label = "Photos" }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, max - images.length));
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    try {
      const { default: axiosInstance } = await import("@core/api/axios");
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await axiosInstance.post("/media/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const url = res.data?.result?.url || res.data?.data?.url || res.data?.url;
          if (url) urls.push(url);
          else onError?.("Image upload failed. Please try again.");
        } catch (err) {
          onError?.(err?.response?.data?.message || "Image upload failed. Please try again.");
        }
      }
    } finally {
      if (urls.length) onChange([...images, ...urls].slice(0, max));
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
        {label} <span className="normal-case font-medium text-slate-400">({images.length}/{max})</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div key={url + i} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200">
            <img src={url} alt={`proof ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {images.length < max && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center hover:border-slate-400 disabled:opacity-60"
            aria-label="Add photo"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSelect} />
    </div>
  );
};

export default ProofImagePicker;
