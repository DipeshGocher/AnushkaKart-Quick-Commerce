import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Save } from 'lucide-react';
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
        <div className="min-h-screen bg-[#f1f4f8] font-sans pb-10">
            {/* Header */}
            <div className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center gap-3 shadow-sm border-b border-slate-100">
                <Link to="/profile" className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                    <ArrowLeft size={22} className="text-[#0F172A]" />
                </Link>
                <h1 className="text-lg font-black text-[#0F172A]">Edit Profile</h1>
            </div>

            <div className="max-w-xl mx-auto p-5">

                {/* Profile Picture Display (Read-Only Default Avatar) */}
                <div className="flex flex-col items-center mb-8">
                    <div className="relative h-28 w-28 rounded-full bg-gradient-to-tr from-[#FF5722] via-[#FF6D00] to-[#0F172A] p-1 shadow-lg">
                        <div className="h-full w-full rounded-full bg-white flex items-center justify-center overflow-hidden relative">
                            {user?.avatar || user?.profileImage ? (
                                <img 
                                    src={user.avatar || user.profileImage} 
                                    alt={formData.name || 'User'} 
                                    className="w-full h-full object-cover rounded-full" 
                                />
                            ) : (
                                <User size={48} className="text-[#0F172A]" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#FF5722] focus-within:ring-4 focus-within:ring-[#FF5722]/10 transition-all">
                                <div className="w-9 h-9 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                                    <span className="text-sm">👤</span>
                                </div>
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
                                    className="bg-transparent w-full text-[#0F172A] font-bold outline-none placeholder:font-medium text-sm"
                                    placeholder="Enter your name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#FF5722] focus-within:ring-4 focus-within:ring-[#FF5722]/10 transition-all">
                                <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                    <span className="text-sm">📞</span>
                                </div>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-[#0F172A] font-bold outline-none placeholder:font-medium text-sm"
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                            <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#FF5722] focus-within:ring-4 focus-within:ring-[#FF5722]/10 transition-all">
                                <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                    <span className="text-sm">✉️</span>
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="bg-transparent w-full text-[#0F172A] font-bold outline-none placeholder:font-medium text-sm"
                                    placeholder="Enter email address"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bio</label>
                            <div className="flex gap-3 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200 focus-within:border-[#FF5722] focus-within:ring-4 focus-within:ring-[#FF5722]/10 transition-all">
                                <div className="w-9 h-9 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-sm">📝</span>
                                </div>
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
                        className="w-full py-4 bg-gradient-to-r from-[#FF5722] via-[#FF6D00] to-[#0F172A] text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 hover:from-[#FF6D00] hover:to-[#0F172A] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save size={20} />
                        )}
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default EditProfilePage;
