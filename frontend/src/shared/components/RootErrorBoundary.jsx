import React from 'react';
import { useRouteError, useNavigate, isRouteErrorResponse } from 'react-router-dom';
import { ShoppingBag, RefreshCw, Home, AlertCircle } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';

const RootErrorBoundary = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    console.error('Route Error:', error);

    let errorMessage = "An unexpected error occurred.";
    let errorStatus = 500;

    if (isRouteErrorResponse(error)) {
        errorStatus = error.status;
        errorMessage = error.statusText || error.data?.message || errorMessage;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    const isDynamicImportError =
        typeof errorMessage === 'string' &&
        (errorMessage.includes('Failed to fetch dynamically imported module') ||
         errorMessage.includes('Importing a module script failed'));

    React.useEffect(() => {
        if (isDynamicImportError) {
            const storageKey = 'boundary_reload_' + window.location.pathname;
            const hasReloaded = sessionStorage.getItem(storageKey);
            if (!hasReloaded) {
                sessionStorage.setItem(storageKey, 'true');
                window.location.reload();
            }
        }
    }, [isDynamicImportError]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-outfit">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">Oops!</h1>
                <p className="text-gray-500 mb-6">
                    {isDynamicImportError
                        ? "A new version of this page was updated. Please refresh to load the latest version."
                        : errorMessage}
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => {
                            sessionStorage.clear();
                            window.location.reload();
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Refresh Page
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Home className="w-5 h-5" />
                        Back to Home
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                        Error ID: {errorStatus} - {new Date().toLocaleTimeString()}
                    </p>
                </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-primary-600 font-semibold">
                <ShoppingBag className="w-6 h-6" />
                <span className="text-xl tracking-tight">{appName}</span>
            </div>
        </div>
    );
};

export default RootErrorBoundary;
