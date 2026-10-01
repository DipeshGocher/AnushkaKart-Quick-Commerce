import React from 'react';
import {
  getFontAwesomeIconMarkup,
  resolveFontAwesomeCategoryIcon,
} from '../constants/fontAwesomeCategoryIcons';
import { Image } from 'lucide-react';

const CategoryIcon = ({ iconId, imageUrl, alt = 'Category', className = 'w-6 h-6', fallbackClassName = 'w-5 h-5' }) => {
  const iconMarkup = getFontAwesomeIconMarkup(iconId);
  if (iconMarkup) {
    return <span aria-hidden="true" className={className + " text-black [&_svg]:h-full [&_svg]:w-full"} dangerouslySetInnerHTML={{ __html: iconMarkup }} />;
  }

  const FontAwesomeIcon = resolveFontAwesomeCategoryIcon(iconId, alt);
  if (FontAwesomeIcon) {
    return <FontAwesomeIcon aria-hidden="true" className={className + " text-black"} />;
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={`${className} object-cover`}
      />
    );
  }

  return <Image className={`${fallbackClassName} text-gray-400`} />;
};

export default CategoryIcon;
