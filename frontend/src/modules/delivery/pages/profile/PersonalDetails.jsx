import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Droplet, Loader2 } from "lucide-react";
import Button from "@/shared/components/ui/Button";
import Input from "@/shared/components/ui/Input";
import { toast } from "sonner";
import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";

const formatSafeDob = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toISOString().split("T")[0];
  } catch {
    return String(val || "");
  }
};

const PersonalDetails = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    fullName: user?.name || "",
    phone: user?.phone || user?.mobile || "",
    email: user?.email || "",
    address: user?.address || "",
    dob: formatSafeDob(user?.dob),
    bloodGroup: user?.bloodGroup || "",
  });

  // Update if user loads later
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.name || "",
        phone: user.phone || user.mobile || "",
        email: user.email || "",
        address: user.address || "",
        dob: formatSafeDob(user.dob),
        bloodGroup: user.bloodGroup || "",
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updateData = {
        name: formData.fullName,
        email: formData.email,
        address: formData.address,
        dob: formData.dob,
        bloodGroup: formData.bloodGroup,
      };

      const res = await deliveryApi.updateProfile(updateData);
      if (res?.data?.result) {
        if (typeof updateUser === "function") {
          updateUser(res.data.result);
        }
      } else if (typeof updateUser === "function") {
        updateUser(updateData);
      }
      setIsEditing(false);
      toast.success("Personal details updated successfully!");
    } catch (err) {
      console.error("Failed to update personal details:", err);
      toast.error(err?.response?.data?.message || "Failed to update personal details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center p-4">
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2 cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="ds-h3 text-gray-900 font-bold">Personal Details</h1>
          <div className="ml-auto">
            {isEditing ? (
              <Button 
                size="sm" 
                onClick={handleSave} 
                disabled={isSaving}
                className="h-8 px-4 bg-[#6666FF] hover:bg-[#5555EE] text-white font-medium"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Save
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditing(true)} 
                className="text-[#6666FF] hover:bg-[#6666FF]/10 font-semibold"
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Profile Photo */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full p-1 bg-white shadow-md border border-[#6666FF]/20">
              <img
                src={user?.profileImage || user?.avatar || "/placeholder-avatar.png"}
                alt="Profile"
                className="w-full h-full rounded-full object-cover bg-gray-100"
                onError={(e) => {
                  e.target.src = "/placeholder-avatar.png";
                }}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-500 font-medium">
            Delivery Partner ID: {user?.deliveryBoyId || user?._id?.slice(-6) || "N/A"}
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <Input
            label="Full Name"
            value={formData.fullName}
            readOnly={!isEditing}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            icon={User}
            className={!isEditing ? "bg-gray-50 border-transparent text-gray-700" : ""}
          />
          
          <Input
            label="Phone Number"
            value={formData.phone}
            readOnly={true}
            icon={Phone}
            className="bg-gray-50 border-transparent text-gray-500"
            helperText="Contact support to change registered phone number"
          />

          <Input
            label="Email Address"
            value={formData.email}
            readOnly={!isEditing}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            icon={Mail}
            type="email"
            className={!isEditing ? "bg-gray-50 border-transparent text-gray-700" : ""}
          />

          <div className="relative">
            <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Current Address</label>
            <div className="relative">
              <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <MapPin size={18} />
              </div>
              <textarea
                value={formData.address}
                readOnly={!isEditing}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:ring-2 focus:ring-[#6666FF]/20 focus:border-[#6666FF] outline-none transition-all resize-none ${
                  !isEditing ? "bg-gray-50 border-transparent text-gray-600" : "bg-white border-gray-200"
                }`}
                rows={3}
                placeholder="Enter complete address"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              value={formData.dob}
              readOnly={!isEditing}
              type={isEditing ? "date" : "text"}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              icon={Calendar}
              className={!isEditing ? "bg-gray-50 border-transparent text-gray-700" : ""}
            />
            <Input
              label="Blood Group"
              value={formData.bloodGroup}
              readOnly={!isEditing}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
              icon={Droplet}
              placeholder="e.g. O+, B+"
              className={!isEditing ? "bg-gray-50 border-transparent text-gray-700" : ""}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalDetails;
