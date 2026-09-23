import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { C2C_CATEGORIES, addPendingC2CAd } from '../../data/c2cMockData';
import { getSellDraft, saveSellDraft, clearSellDraft } from './sell/sellDraftStore';
import { useAuth } from '@core/context/AuthContext';
import SellCategoryStep from './sell/SellCategoryStep';
import SellSubCategoryStep from './sell/SellSubCategoryStep';
import SellDetailsStep from './sell/SellDetailsStep';
import SellPhotosStep from './sell/SellPhotosStep';
import SellPriceStep from './sell/SellPriceStep';
import SellReviewProfileStep from './sell/SellReviewProfileStep';
import { toast } from 'sonner';

const C2CSellPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Load existing draft or set initial defaults
  const [draft, setDraft] = useState(() => {
    const existing = getSellDraft();
    if (existing) {
      return {
        ...existing,
        brand: existing.brand || '',
        photos: existing.photos || [],
      };
    }
    return {
      category: C2C_CATEGORIES[0], // default Mobiles
      subCategory: C2C_CATEGORIES[0]?.subCategories?.[0] || null,
      brand: '', // Unselected by default with "Select a Brand" placeholder
      title: '',
      description: '',
      photos: [], // Unselected by default
      price: '',
    };
  });

  // Get current step from URL (?step=1..6), defaults to 1
  const stepParam = parseInt(searchParams.get('step') || '1', 10);
  const currentStep = isNaN(stepParam) || stepParam < 1 || stepParam > 6 ? 1 : stepParam;

  const goToStep = (stepNumber) => {
    setSearchParams({ step: String(stepNumber) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 1: Category Selected
  const handleSelectCategory = (category) => {
    const updated = {
      ...draft,
      category,
      subCategory: category.subCategories?.[0] || null,
    };
    setDraft(updated);
    saveSellDraft(updated);
    goToStep(2);
  };

  // Step 2: SubCategory Selected
  const handleSelectSubCategory = (subCategory) => {
    const updated = {
      ...draft,
      subCategory,
    };
    setDraft(updated);
    saveSellDraft(updated);
    goToStep(3);
  };

  // Step 3: Details Submitted
  const handleDetailsNext = ({ brand, title, description }) => {
    const updated = {
      ...draft,
      brand,
      title,
      description,
    };
    setDraft(updated);
    saveSellDraft(updated);
    goToStep(4);
  };

  // Step 4: Photos Selected
  const handlePhotosNext = (photos) => {
    const updated = {
      ...draft,
      photos,
    };
    setDraft(updated);
    saveSellDraft(updated);
    goToStep(5);
  };

  // Step 5: Price Set -> Advance to Step 6 (Review your details)
  const handlePriceNext = (price) => {
    const updated = {
      ...draft,
      price,
    };
    setDraft(updated);
    saveSellDraft(updated);
    goToStep(6);
  };

  // Step 6: Submit for Admin Approval
  const handleFinalSubmitForApproval = (sellerInfo) => {
    const catObj = draft.category || C2C_CATEGORIES[0];
    const newAd = {
      title: draft.title || `${draft.brand || ''} ${catObj.name}`.trim(),
      price: Number(draft.price) || 0,
      category: catObj.id,
      categoryName: catObj.name,
      subCategory: draft.subCategory?.name || '',
      brand: draft.brand || 'Other',
      condition: 'Like New',
      location: sellerInfo.location || 'Indore, Madhya Pradesh',
      city: sellerInfo.city || 'Indore',
      state: sellerInfo.state || 'Madhya Pradesh',
      images: draft.photos && draft.photos.length > 0 ? draft.photos : ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&auto=format&fit=crop&q=80'],
      photos: draft.photos || [],
      description: draft.description || 'Genuine pre-owned item in working condition.',
      seller: {
        id: 'seller-user',
        name: sellerInfo.name || user?.name || 'Customer',
        avatar: sellerInfo.avatar || user?.avatar || user?.profileImage || '',
        memberSince: 'Sep 2024',
        verified: true,
        phone: sellerInfo.phone || (user?.phone ? '+91 ' + user.phone.replace('+91', '').trim() : '+91 9999999999'),
        rating: 5.0,
        totalAds: 1,
      },
    };

    addPendingC2CAd(newAd);
    clearSellDraft();
    toast.success('Product submitted for admin approval!');
  };

  // Header Back Button Handlers
  const handleBackFromStep1 = () => {
    navigate('/marketplace');
  };

  const handleBack = (previousStep) => {
    goToStep(previousStep);
  };

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {currentStep === 1 && (
        <SellCategoryStep
          onSelectCategory={handleSelectCategory}
          onBack={handleBackFromStep1}
        />
      )}

      {currentStep === 2 && (
        <SellSubCategoryStep
          category={draft.category}
          onSelectSubCategory={handleSelectSubCategory}
          onBack={() => handleBack(1)}
        />
      )}

      {currentStep === 3 && (
        <SellDetailsStep
          category={draft.category}
          subCategory={draft.subCategory}
          initialData={{
            brand: draft.brand,
            title: draft.title,
            description: draft.description,
          }}
          onNext={handleDetailsNext}
          onBack={() => handleBack(2)}
        />
      )}

      {currentStep === 4 && (
        <SellPhotosStep
          initialSelectedPhotos={draft.photos}
          onNext={handlePhotosNext}
          onBack={() => handleBack(3)}
        />
      )}

      {currentStep === 5 && (
        <SellPriceStep
          initialPrice={draft.price}
          onNext={handlePriceNext}
          onBack={() => handleBack(4)}
        />
      )}

      {currentStep === 6 && (
        <SellReviewProfileStep
          draft={draft}
          onSubmitForApproval={handleFinalSubmitForApproval}
          onBack={() => handleBack(5)}
          onGoHome={() => navigate('/marketplace')}
          onGoMyAds={() => navigate('/marketplace/my-ads')}
        />
      )}
    </div>
  );
};

export default C2CSellPage;
