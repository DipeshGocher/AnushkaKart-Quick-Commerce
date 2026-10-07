import React from 'react';
import {
  getFontAwesomeIconMarkup,
  resolveFontAwesomeCategoryIcon,
} from '../constants/fontAwesomeCategoryIcons';
import { Image } from 'lucide-react';

const CategoryIcon = ({ iconId, imageUrl, alt = 'Category', className = 'w-6 h-6', fallbackClassName = 'w-5 h-5', style }) => {
  const iconMarkup = getFontAwesomeIconMarkup(iconId);
  if (iconMarkup) {
    return <span aria-hidden="true" style={style} className={`${className} [&_svg]:h-full [&_svg]:w-full`} dangerouslySetInnerHTML={{ __html: iconMarkup }} />;
  }

  const FontAwesomeIcon = resolveFontAwesomeCategoryIcon(iconId, alt);
  if (FontAwesomeIcon) {
    return <FontAwesomeIcon aria-hidden="true" style={style} className={className} />;
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        style={style}
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.style.display = 'none';
        }}
        className={`${className} object-contain`}
      />
    );
  }

  return <Image style={style} className={`${fallbackClassName} text-gray-400`} />;
};

export default CategoryIcon;
