import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * KitDetailPage
 * Unified bridge component: redirects any kit/basket URL to the single unified ProductDetailSheet.
 */
const KitDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/?product=${encodeURIComponent(id)}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [id, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default KitDetailPage;
