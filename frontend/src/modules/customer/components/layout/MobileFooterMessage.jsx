import React from 'react';
import { useSettings } from '@core/context/SettingsContext';

const MobileFooterMessage = () => {
    const { settings } = useSettings();
    const appName = settings?.appName || 'Anushka Store';

    return (
        <div className="md:hidden w-full flex flex-col items-center mt-6 pt-0 pb-24 px-6 bg-transparent">
            <div className="w-full flex flex-col items-center">
                <div className="text-slate-300 font-black text-2xl tracking-tighter text-center">
                    {appName}
                </div>
            </div>
        </div>
    );
};

export default MobileFooterMessage;
