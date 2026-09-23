import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Camera, Image as ImageIcon, Check, X, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { DEFAULT_GALLERY_PHOTOS } from './sellDraftStore';
import { toast } from 'sonner';

const MAX_PHOTOS = 10;

const SellPhotosStep = ({
  initialSelectedPhotos = [],
  onNext,
  onBack,
}) => {
  // Gallery pool consists of default gallery mock photos plus user uploaded/clicked photos
  const [galleryPhotos, setGalleryPhotos] = useState(() => {
    const combined = [...initialSelectedPhotos, ...DEFAULT_GALLERY_PHOTOS];
    return Array.from(new Set(combined));
  });

  // ALL IMAGES REMAIN UNSELECTED BY DEFAULT
  const [selectedPhotos, setSelectedPhotos] = useState(initialSelectedPhotos || []);

  const [isPreviewOpen, setIsPreviewOpen] = useState(true);

  // Live Camera Viewfinder State
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment'); // 'environment' (rear) or 'user' (front)
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Stop camera tracks cleanly
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Launch live device camera for instant picture
  const handleOpenLiveCamera = async (mode = 'environment') => {
    if (selectedPhotos.length >= MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }

    try {
      stopCameraStream();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback to camera input
        cameraInputRef.current?.click();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraFacingMode(mode);
      setIsLiveCameraOpen(true);

      // Attach stream to video element when rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => console.log('Video play error', err));
        }
      }, 100);
    } catch (err) {
      console.warn('Could not launch live camera viewfinder, using native camera picker fallback:', err);
      // Fallback directly to native camera input
      cameraInputRef.current?.click();
    }
  };

  // Toggle front/back camera in live camera modal
  const handleSwitchCamera = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    handleOpenLiveCamera(nextMode);
  };

  // Capture instant photo from video stream
  const handleCaptureInstantPhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      // If front camera, flip horizontally for natural mirror feel
      if (cameraFacingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Stop camera and close
      stopCameraStream();
      setIsLiveCameraOpen(false);

      // Add to gallery and automatically tick
      setGalleryPhotos((prev) => [dataUrl, ...prev]);
      if (selectedPhotos.length < MAX_PHOTOS) {
        setSelectedPhotos((prev) => [dataUrl, ...prev]);
        toast.success('Instant photo captured and selected!');
      } else {
        toast.info('Instant photo captured (max 10 selected)');
      }
    } catch (err) {
      console.error('Error capturing instant photo:', err);
      toast.error('Failed to capture photo');
      stopCameraStream();
      setIsLiveCameraOpen(false);
    }
  };

  const handleCloseLiveCamera = () => {
    stopCameraStream();
    setIsLiveCameraOpen(false);
  };

  // Toggle selection of a photo
  const handleTogglePhoto = (photoUrl) => {
    if (selectedPhotos.includes(photoUrl)) {
      setSelectedPhotos(selectedPhotos.filter((p) => p !== photoUrl));
    } else {
      if (selectedPhotos.length >= MAX_PHOTOS) {
        toast.error(`You can add max ${MAX_PHOTOS} photos`);
        return;
      }
      setSelectedPhotos([...selectedPhotos, photoUrl]);
    }
  };

  // Remove photo from selected list
  const handleRemoveSelected = (photoUrl, e) => {
    e?.stopPropagation();
    setSelectedPhotos(selectedPhotos.filter((p) => p !== photoUrl));
  };

  // Native camera input fallback capture
  const handleNativeCameraFallback = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newUrl = URL.createObjectURL(file);
    setGalleryPhotos((prev) => [newUrl, ...prev]);

    if (selectedPhotos.length < MAX_PHOTOS) {
      setSelectedPhotos((prev) => [newUrl, ...prev]);
      toast.success('Photo captured and selected!');
    }
    e.target.value = '';
  };

  // Device gallery upload
  const handleGalleryUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newUrls = files.map((f) => URL.createObjectURL(f));
    setGalleryPhotos((prev) => [...newUrls, ...prev]);

    const availableSlots = MAX_PHOTOS - selectedPhotos.length;
    if (availableSlots > 0) {
      const toSelect = newUrls.slice(0, availableSlots);
      setSelectedPhotos((prev) => [...toSelect, ...prev]);
      toast.success(`${newUrls.length} photo(s) added from gallery!`);
    } else {
      toast.info(`${newUrls.length} photo(s) added to gallery (max 10 selected)`);
    }
    e.target.value = '';
  };

  const handleNext = () => {
    if (selectedPhotos.length === 0) {
      toast.error('Please select at least 1 photo');
      return;
    }
    onNext(selectedPhotos);
  };

  return (
    <div className="w-full min-h-screen bg-white flex flex-col font-sans relative">
      {/* Hidden Native File Inputs */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleNativeCameraFallback}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        multiple
        ref={galleryInputRef}
        onChange={handleGalleryUpload}
        className="hidden"
      />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 h-14 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-1 -ml-1 text-slate-800 hover:text-slate-900 active:scale-95 transition-transform"
        >
          <ChevronLeft size={28} strokeWidth={2.4} />
        </button>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight flex-1 text-center pr-7">
          Upload your photos
        </h1>
      </header>

      {/* Photo Grid (3 Columns Full-Width OLX Style) */}
      <div className="w-full flex-1 p-1 pb-44 overflow-y-auto">
        <div className="grid grid-cols-3 gap-1">
          {/* Tile 1: Camera Action Button (Triggers Live Camera Viewfinder to click instant picture) */}
          <button
            type="button"
            onClick={() => handleOpenLiveCamera('environment')}
            className="aspect-square bg-[#0F4C81] hover:bg-[#0A365C] active:scale-95 text-white flex flex-col items-center justify-center transition-all rounded-xs shadow-inner group focus:outline-none"
          >
            <Camera size={34} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-semibold mt-1 tracking-wider uppercase opacity-90">
              Camera
            </span>
          </button>

          {/* Tile 2: Gallery Action Button */}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="aspect-square bg-[#0F4C81] hover:bg-[#0A365C] active:scale-95 text-white flex flex-col items-center justify-center transition-all rounded-xs shadow-inner group focus:outline-none"
          >
            <ImageIcon size={34} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-semibold mt-1 tracking-wider uppercase opacity-90">
              Gallery
            </span>
          </button>

          {/* Gallery Photos (UNSELECTED BY DEFAULT) */}
          {galleryPhotos.map((url, idx) => {
            const isSelected = selectedPhotos.includes(url);

            return (
              <div
                key={idx}
                onClick={() => handleTogglePhoto(url)}
                className={`relative aspect-square cursor-pointer overflow-hidden rounded-xs transition-all group bg-slate-100 ${
                  isSelected ? 'ring-2 ring-[#0F4C81] ring-offset-1' : 'hover:opacity-90'
                }`}
              >
                <img
                  src={url}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover select-none"
                  loading="lazy"
                />

                {/* Selection Tick Overlay */}
                <div className="absolute top-1.5 right-1.5 z-10">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md ${
                      isSelected
                        ? 'bg-[#0F4C81] text-white font-bold text-xs ring-1 ring-white'
                        : 'bg-black/35 border-2 border-white text-transparent group-hover:bg-black/50'
                    }`}
                  >
                    {isSelected ? <Check size={14} strokeWidth={3} /> : null}
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute inset-0 bg-[#0F4C81]/15 pointer-events-none" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Photos Bottom Drawer & Next Button (Full Width) */}
      <div className="fixed bottom-0 left-0 right-0 w-full bg-white/98 backdrop-blur-md border-t border-slate-200 shadow-2xl z-40">
        {/* Toggle Indicator Button */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowUpCircle
              size={22}
              className={`transform transition-transform duration-200 text-[#0F4C81] ${
                isPreviewOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-base font-bold text-slate-900">
              Selected photos
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#0F4C81]">
              {selectedPhotos.length}/{MAX_PHOTOS}
            </span>
          </div>

          {/* Horizontal Preview Strip */}
          {isPreviewOpen && selectedPhotos.length > 0 && (
            <div className="flex items-center gap-2.5 overflow-x-auto py-1 mb-3 scrollbar-none">
              {selectedPhotos.map((url, i) => (
                <div key={i} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shadow-xs">
                  <img src={url} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSelected(url, e)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Next Button */}
          <button
            type="button"
            onClick={handleNext}
            className="w-full bg-[#0F4C81] hover:bg-[#0A365C] active:scale-[0.98] text-white font-bold py-3.5 rounded-lg text-base shadow-sm transition-all text-center tracking-wide"
          >
            Next
          </button>
        </div>
      </div>

      {/* LIVE CAMERA VIEWFINDER MODAL FOR CLICKING INSTANT PICTURE */}
      {isLiveCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between">
          {/* Camera Top Bar */}
          <div className="p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
            <button
              type="button"
              onClick={handleCloseLiveCamera}
              className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md active:scale-95"
            >
              <X size={24} />
            </button>
            <span className="text-sm font-semibold text-white tracking-wider uppercase">
              Click Instant Photo
            </span>
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md active:scale-95"
              title="Flip camera"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          {/* Video Stream Viewfinder */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Camera Bottom Shutter Bar */}
          <div className="p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center z-10 pb-8">
            <button
              type="button"
              onClick={handleCaptureInstantPhoto}
              className="w-20 h-20 rounded-full border-4 border-white p-1 flex items-center justify-center active:scale-90 transition-transform bg-transparent"
              aria-label="Take picture"
            >
              <div className="w-full h-full rounded-full bg-white active:bg-blue-200 transition-colors shadow-lg" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellPhotosStep;
