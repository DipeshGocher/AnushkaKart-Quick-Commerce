import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { UserRole } from '@core/constants/roles';
import { Mail, Lock, Shield, ArrowRight } from 'lucide-react';
import SignInCard2 from '@/components/ui/sign-in-card-2';

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
        <SignInCard2
            title="Welcome Back"
            subtitle="Enter your details to continue"
            logoUrl="/logo.png"
            appName="Anushka Store"
        >
            <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                    <div className="relative group">
                        <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email address"
                            className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        />
                    </div>
                </div>

                <div>
                    <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        />
                    </div>
                </div>

                <div>
                    <div className="relative group">
                        <Shield className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors pointer-events-none z-10" />
                        <select
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-white/10 rounded-xl text-white text-sm font-medium focus:outline-none focus:bg-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all appearance-none cursor-pointer"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            <option value={UserRole.CUSTOMER} className="bg-slate-900 text-white">Customer Portal</option>
                            <option value={UserRole.SELLER} className="bg-slate-900 text-white">Seller Portal</option>
                            <option value={UserRole.ADMIN} className="bg-slate-900 text-white">Admin Portal</option>
                            <option value={UserRole.DELIVERY} className="bg-slate-900 text-white">Delivery Partner Portal</option>
                        </select>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        className="w-full relative bg-gradient-to-r from-blue-600 via-blue-700 to-orange-500 hover:from-blue-700 hover:to-orange-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500/30 active:scale-[0.99] flex items-center justify-center gap-2 group"
                    >
                        <span>Continue</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <div className="mt-6 text-center space-y-2">
                    <p className="text-xs text-slate-400 font-medium">
                        Don't have an account?{' '}
                        <span className="cursor-pointer font-bold text-orange-400 hover:text-orange-300 transition-colors" onClick={() => navigate('/signup')}>
                            Sign up
                        </span>
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                        Are you a seller?{' '}
                        <span className="cursor-pointer font-bold text-blue-400 hover:text-blue-300 transition-colors" onClick={() => navigate('/seller/auth')}>
                            Join as Partner
                        </span>
                    </p>
                </div>
            </form>
        </SignInCard2>
    );
};

export default Login;
