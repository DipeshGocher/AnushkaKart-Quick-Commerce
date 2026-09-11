import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { UserRole } from '@core/constants/roles';
import { Mail, Lock, Shield } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(UserRole.CUSTOMER);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        // Simulate login for frontend demo
        const userData = {
            id: '1',
            name: `Demo ${role}`,
            email,
            role,
            token: 'demo-token',
        };
        login(userData);
        navigate(`/${role}`, { replace: true });
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50/50 px-4 py-8 font-['Outfit']">
            <div className="bg-white text-slate-900 border border-slate-200/80 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto relative overflow-hidden">
                {/* Background Accents */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100/40 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-100/30 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />

                <div className="relative z-10">
                    <div className="flex flex-col items-center justify-center mb-4">
                        <img 
                            src="/logo.png" 
                            alt="AnushkaStore Logo" 
                            className="h-20 sm:h-24 w-auto object-contain" 
                        />
                    </div>
                    
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
                            Welcome Back
                        </h2>
                        <p className="text-slate-500 text-xs font-medium">
                            Enter your details to continue
                        </p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email address"
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="relative group">
                                <Shield className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#E60067] transition-colors pointer-events-none" />
                                <select
                                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E60067]/20 focus:border-[#E60067] transition-all appearance-none cursor-pointer"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                >
                                    <option value={UserRole.CUSTOMER}>Customer Portal</option>
                                    <option value={UserRole.SELLER}>Seller Portal</option>
                                    <option value={UserRole.ADMIN}>Admin Portal</option>
                                    <option value={UserRole.DELIVERY}>Delivery Partner Portal</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="w-full relative bg-gradient-to-r from-[#E60067] to-[#FF3366] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg hover:from-[#C00052] hover:to-[#E60067] focus:outline-none focus:ring-2 focus:ring-[#E60067]/20 active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                                Continue
                            </button>
                        </div>

                        <div className="mt-6 text-center space-y-2">
                            <p className="text-xs text-slate-500 font-medium">
                                Don't have an account?{' '}
                                <span className="cursor-pointer font-bold text-[#E60067] hover:text-[#C00052] transition-colors" onClick={() => navigate('/signup')}>
                                    Sign up
                                </span>
                            </p>
                            <p className="text-xs text-slate-500 font-medium">
                                Are you a seller?{' '}
                                <span className="cursor-pointer font-bold text-[#E60067] hover:text-[#C00052] transition-colors" onClick={() => navigate('/seller/auth')}>
                                    Join as Partner
                                </span>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
