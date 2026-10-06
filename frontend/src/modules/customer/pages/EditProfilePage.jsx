import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserRound, Phone, Mail, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@core/context/AuthContext';
import { customerApi } from '../services/customerApi';

const EditProfilePage = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        bio: user?.bio || ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                phone: user.phone || '',
                email: user.email || '',
                bio: user.bio || ''
            });
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await customerApi.updateProfile(formData);
            const updatedUser = response.data.result;

            // Update local auth state
            updateUser(updatedUser);

            toast.success('Profile updated successfully!');
            navigate('/profile');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="customer-edit-profile-page min-h-screen bg-[#f1f4f8] font-sans pb-16 flex flex-col">
            {/* Header */}
            <div className="customer-edit-profile-header bg-white sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm border-b border-slate-100">
                <Link to="/profile" className="customer-edit-profile-back p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowLeft size={22} className="text-[#0F172A]" />
                </Link>
                <h1 className="text-lg font-black text-[#0F172A]">Profile Settings</h1>
            </div>

            <div className="customer-edit-profile-content max-w-xl mx-auto p-5 flex-1 flex flex-col justify-center w-full">

                {/* Edit Form */}
                <form onSubmit={handleSubmit} className="customer-edit-profile-form space-y-5">
                    <div className="customer-edit-profile-card bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                        <div className="customer-edit-profile-field">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                            <div className="customer-edit-profile-control flex items-center gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#6666FF] focus-within:ring-4 focus-within:ring-[#6666FF]/15 transition-all">
                                <UserRound className="customer-edit-profile-icon text-[#6666FF]" size={16} />
                                <input
                                    type="text"
                                    name="name"
                                    maxLength={50}
                                    pattern="[a-zA-Z\s]*"
                                    value={formData.name}
                                    onChange={(e) => {
                                        e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                        handleChange(e);
                                    }}
                                    className="bg-transparent w-full text-[#0F172A] font-medium outline-none placeholder:font-normal text-sm"
                                    placeholder="Enter your name"
                                />
                            </div>
                        </div>

                        <div className="customer-edit-profile-field">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                            <div className="customer-edit-profile-control flex items-center gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#6666FF] focus-within:ring-4 focus-within:ring-[#6666FF]/15 transition-all">
                                <Phone className="customer-edit-profile-icon text-[#6666FF]" size={16} />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-[#0F172A] font-medium outline-none placeholder:font-normal text-sm"
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </div>

                        <div className="customer-edit-profile-field">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                            <div className="customer-edit-profile-control flex items-center gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#6666FF] focus-within:ring-4 focus-within:ring-[#6666FF]/15 transition-all">
                                <Mail className="customer-edit-profile-icon text-[#6666FF]" size={16} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-[#0F172A] font-medium outline-none placeholder:font-normal text-sm"
                                    placeholder="Enter email address"
                                />
                            </div>
                        </div>

                        <div className="customer-edit-profile-field">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bio</label>
                            <div className="customer-edit-profile-control customer-edit-profile-bio-control flex gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#6666FF] focus-within:ring-4 focus-within:ring-[#6666FF]/15 transition-all">
                                <FileText className="customer-edit-profile-icon mt-0.5 text-[#6666FF]" size={16} />
                                <textarea
                                    name="bio"
                                    value={formData.bio}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full bg-transparent outline-none text-[#0F172A] font-medium text-sm resize-none"
                                    placeholder="Tell us about yourself..."
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="customer-edit-profile-save w-full py-4 bg-gradient-to-r from-[#7777FF] via-[#6666FF] to-[#5555EE] text-white font-bold rounded-2xl shadow-lg shadow-[#6666FF]/25 hover:from-[#6666FF] hover:to-[#4F4FDD] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                        {isLoading ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>

                    <Link to="/profile" className="customer-edit-profile-cancel w-full block text-center py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer">
                        Cancel
                    </Link>
                </form>

            </div>
        </div>
    );
};

export default EditProfilePage;
