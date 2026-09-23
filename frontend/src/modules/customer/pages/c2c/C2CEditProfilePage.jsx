import React from 'react';
import C2CProfilePage from './C2CProfilePage';

// Re-export C2CProfilePage for /marketplace/profile/edit so both routes share the exact same clean, unified profile experience
const C2CEditProfilePage = () => {
  return <C2CProfilePage />;
};

export default C2CEditProfilePage;
