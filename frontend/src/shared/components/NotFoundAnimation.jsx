import React from 'react';
import Lottie from 'lottie-react';
import emptyBoxAnimation from '@/assets/lottie/Empty box.json';

// Kept in its own file so the animation library only loads when a 404 page is actually shown.
const NotFoundAnimation = () => (
    <Lottie animationData={emptyBoxAnimation} loop autoplay className="w-full h-full object-contain" />
);

export default NotFoundAnimation;
