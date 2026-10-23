import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Landmark, 
  AlertTriangle, 
  CheckCircle2, 
  Smartphone,
  ShieldCheck,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import Input from "@/shared/components/ui/Input";
import { useAuth } from "@core/context/AuthContext";
import { deliveryApi } from "../../services/deliveryApi";

const BankAccount = () => {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser } = useAuth();

  const currentBankDetails = {
    accountHolder: user?.bankDetails?.accountHolder || user?.accountHolder || user?.name || "",
    accountNumber: user?.bankDetails?.accountNumber || user?.accountNumber || "",
    ifsc: user?.bankDetails?.ifsc || user?.ifsc || "",
    bankName: user?.bankDetails?.bankName || user?.bankName || "",
    upiId: user?.bankDetails?.upiId || user?.upiId || "",
  };

  const hasBankDetails = Boolean(
    currentBankDetails.accountNumber || currentBankDetails.upiId
  );

  const [formData, setFormData] = useState({
    accountHolder: currentBankDetails.accountHolder,
    accountNumber: currentBankDetails.accountNumber,
    confirmAccountNumber: currentBankDetails.accountNumber,
    ifsc: currentBankDetails.ifsc,
    bankName: currentBankDetails.bankName,
    upiId: currentBankDetails.upiId,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      const holder = user?.bankDetails?.accountHolder || user?.accountHolder || user?.name || "";
      const accNo = user?.bankDetails?.accountNumber || user?.accountNumber || "";
      const ifscCode = user?.bankDetails?.ifsc || user?.ifsc || "";
      const bName = user?.bankDetails?.bankName || user?.bankName || "";
      const upi = user?.bankDetails?.upiId || user?.upiId || "";

      setFormData({
        accountHolder: holder,
        accountNumber: accNo,
        confirmAccountNumber: accNo,
        ifsc: ifscCode,
        bankName: bName,
        upiId: upi,
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const newErrors = {};

    const accNo = String(formData.accountNumber || "").trim();
    const confAccNo = String(formData.confirmAccountNumber || "").trim();
    const ifscCode = String(formData.ifsc || "").trim().toUpperCase();
    const upi = String(formData.upiId || "").trim();

    if (!accNo && !upi) {
      toast.error("Please enter either Bank Account details or a UPI ID");
      return;
    }

    if (accNo) {
      if (accNo.length < 8 || accNo.length > 20) {
        newErrors.accountNumber = "Account number must be between 8 and 20 digits";
      }
      if (accNo !== confAccNo) {
        newErrors.confirmAccountNumber = "Account numbers do not match";
      }
      if (!ifscCode) {
        newErrors.ifsc = "IFSC code is required with account number";
      } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        newErrors.ifsc = "Invalid IFSC format (e.g. SBIN0001234)";
      }
    }

    if (upi && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi)) {
      newErrors.upiId = "Invalid UPI ID format (e.g. name@okhdfcbank / 9876543210@paytm)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const payload = {
        bankDetails: {
          accountHolder: formData.accountHolder.trim() || user?.name || "Rider",
          accountNumber: accNo,
          ifsc: ifscCode,
          bankName: formData.bankName.trim(),
          upiId: upi,
        },
      };

      const res = await deliveryApi.updateProfile(payload);
      if (res.data?.success) {
        toast.success("Bank & UPI details saved successfully!");
        if (updateUser) {
          updateUser(res.data.result || payload);
        }
        if (refreshUser) {
          refreshUser();
        }
      } else {
        toast.error(res.data?.message || "Failed to update bank details");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save bank details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] pb-24 font-['Outfit',_sans-serif]">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4 max-w-lg mx-auto">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-2"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Bank Account & UPI</h1>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Bank Card Visual */}
        {hasBankDetails ? (
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <Landmark size={26} className="text-white/80" />
                <span className="font-bold text-sm tracking-wide text-white/95">
                  {currentBankDetails.bankName || "Linked Payout Account"}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <CheckCircle2 size={12} className="mr-1" /> Active
              </span>
            </div>

            {currentBankDetails.accountNumber ? (
              <div className="space-y-1 relative z-10 mb-4">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Account Number</p>
                <p className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-white">
                  •••• •••• •••• {String(currentBankDetails.accountNumber).slice(-4)}
                </p>
              </div>
            ) : null}

            {currentBankDetails.upiId ? (
              <div className="mb-4 relative z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-emerald-300">
                  <Smartphone size={13} /> UPI: {currentBankDetails.upiId}
                </span>
              </div>
            ) : null}

            <div className="flex justify-between items-end relative z-10 pt-3 border-t border-white/10">
              <div>
                <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-0.5">Account Holder</p>
                <p className="font-bold text-base text-white">{currentBankDetails.accountHolder || "N/A"}</p>
              </div>
              {currentBankDetails.ifsc ? (
                <div className="text-right">
                  <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-0.5">IFSC Code</p>
                  <p className="font-mono text-sm font-bold text-white tracking-wider">{currentBankDetails.ifsc}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-500">
              <Landmark size={24} />
            </div>
            <h4 className="font-bold text-slate-800 text-base mb-1">No Bank Account or UPI Linked</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Please enter your Bank Account or UPI details below so Admin can transfer your withdrawal payouts.
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-amber-50/80 border border-amber-200/60 p-4 rounded-xl flex items-start">
          <AlertTriangle size={20} className="text-amber-600 mr-3 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-amber-900 font-bold text-sm mb-1">Payout Information</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              When you request a withdrawal from your Wallet, Admin reviews the request and transfers your money directly to your saved Bank Account or UPI ID. Please verify your details before submitting.
            </p>
          </div>
        </div>

        {/* Change Request Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="border-b border-gray-100 pb-3 mb-2 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Payout Details</h3>
              <p className="text-xs text-gray-500">Enter bank account and/or UPI for manual admin payouts</p>
            </div>
            <ShieldCheck size={20} className="text-emerald-500" />
          </div>

          <Input 
            label="Account Holder Name" 
            placeholder="Enter account holder name" 
            value={formData.accountHolder}
            onChange={(e) => setFormData(prev => ({ ...prev, accountHolder: e.target.value }))}
            error={errors.accountHolder}
          />

          <Input 
            label="Bank Name (Optional)" 
            placeholder="e.g. State Bank of India, HDFC Bank" 
            value={formData.bankName}
            onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
            error={errors.bankName}
          />

          <Input 
            label="Account Number" 
            placeholder="Enter 8-20 digit account number" 
            value={formData.accountNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
            error={errors.accountNumber}
          />

          <Input 
            label="Confirm Account Number" 
            placeholder="Re-enter account number" 
            value={formData.confirmAccountNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmAccountNumber: e.target.value }))}
            error={errors.confirmAccountNumber}
          />

          <Input 
            label="IFSC Code" 
            placeholder="e.g. SBIN0001234" 
            value={formData.ifsc}
            onChange={(e) => setFormData(prev => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
            error={errors.ifsc}
          />

          <div className="pt-2 border-t border-gray-100">
            <Input 
              label="UPI ID (Recommended for Faster Transfer)" 
              placeholder="e.g. 9876543210@paytm / name@oksbi" 
              value={formData.upiId}
              onChange={(e) => setFormData(prev => ({ ...prev, upiId: e.target.value }))}
              error={errors.upiId}
              helperText="Admin can transfer directly to your PhonePe, Google Pay or Paytm UPI"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-4 rounded-xl font-bold text-sm text-white bg-[#6666FF] hover:bg-[#5555EE] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Save size={16} />
                Save Bank & UPI Details
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BankAccount;
