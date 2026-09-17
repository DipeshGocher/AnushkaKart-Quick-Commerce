import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import SignInCard2 from '@/components/ui/sign-in-card-2';

const AdminAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    
    const logoUrl = settings?.logoUrl || '/logo.png';

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await adminApi.login({ email: formData.email, password: formData.password });
            const { token, admin } = response.data.result;

            const authData = {
                ...admin,
                token,
                role: 'admin'
            };

            login(authData);

            toast.success('Welcome back, Administrator.');
            navigate('/admin', { replace: true });
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SignInCard2
            title="Welcome Back"
            subtitle="Enter your details to manage the platform"
            logoUrl={logoUrl}
            appName="Anushka Store"
        >
            <form className="space-y-4 relative z-10" onSubmit={handleSubmit}>
                <div>
                    <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                        <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Email address"
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                    </div>
                </div>

                <div>
                    <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" aria-hidden="true" />
                            ) : (
                                <Eye className="h-5 w-5" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full relative bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md shadow-orange-500/25 focus:outline-none focus:ring-2 focus:ring-orange-500/30 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <span>Sign In</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </SignInCard2>
    );
};

export default AdminAuth;
