import React from 'react';
import { cn } from '@/lib/utils';
import {
  optionValueStates,
  pickVariantAfterTap,
  resolveVariant,
} from '@shared/utils/variantMatrix';
import { applyCloudinaryTransform, IMAGE_PRESETS } from '@/core/utils/imageUtils';

/**
 * Size / Color style picker (Flipkart style). One row per option, titled "Select <Option>".
 *  - the chosen value is filled black (a colour with photos shows its photo with a thick black frame)
 *  - a chip is dashed grey when that value is not sold together with the other choices
 *  - a chip is struck through when that combination exists but is sold out
 *  - tapping any chip keeps the other choices when possible, otherwise jumps to the closest
 *    combination that is sold (in stock first), so the customer never lands on "unavailable".
 */
export default function VariantOptionPicker({ product, selectedVariant, onSelect, compact = false }) {
  const axes = product?.variantOptions || [];
  const selection = selectedVariant?.options || {};

  const tap = (axisName, value) => {
    const next = pickVariantAfterTap(product, selection, axisName, value);
    if (next) onSelect(next);
  };

  const photoOf = (axis, value) => {
    if (!axis.hasImages) return null;
    const v = (product?.variants || []).find(
      (x) => String(x.options?.[axis.name] || '').toLowerCase() === String(value).toLowerCase() && (x.images || [])[0],
    );
    return v ? v.images[0] : null;
  };

  const chosen = resolveVariant(product, selection);
  const soldOut = chosen && !(Number(chosen.stock) > 0);

  return (
    <div className={cn('space-y-4', compact ? 'pt-1 mb-1' : 'rounded-xl p-3')} data-testid="variant-option-picker">
      {axes.map((axis) => {
        const states = optionValueStates(product, axis.name, selection);
        return (
          <div key={axis.name} data-testid={`option-row-${axis.name}`}>
            <h4 className="text-[15px] font-bold text-gray-900 mb-2.5">Select {axis.name}</h4>
            <div className="flex gap-2.5 flex-wrap">
              {states.map((s) => {
                const photo = photoOf(axis, s.value);
                const state = s.selected ? 'selected' : !s.exists ? 'unavailable' : !s.inStock ? 'soldout' : 'available';
                if (photo) {
                  return (
                    <button
                      key={s.value}
                      type="button"
                      title={s.value}
                      aria-label={s.value}
                      data-testid={`option-chip-${axis.name}-${s.value}`}
                      data-state={state}
                      onClick={() => tap(axis.name, s.value)}
                      className={cn(
                        'h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white p-1 transition-all',
                        s.selected ? 'border-[3px] border-[#374151]' : 'border-2 border-[#4b5563]',
                        !s.exists && 'border-dashed border-gray-300 opacity-40',
                        s.exists && !s.inStock && !s.selected && 'opacity-50',
                      )}
                    >
                      <img src={applyCloudinaryTransform(photo, IMAGE_PRESETS.ICON)} alt={s.value} className="h-full w-full object-contain" />
                    </button>
                  );
                }
                return (
                  <button
                    key={s.value}
                    type="button"
                    data-testid={`option-chip-${axis.name}-${s.value}`}
                    data-state={state}
                    onClick={() => tap(axis.name, s.value)}
                    className={cn(
                      'min-w-[3.25rem] rounded-xl border-2 px-4 py-2.5 text-[14px] font-semibold transition-all',
                      s.selected
                        ? 'border-[#374151] bg-[#374151] text-white'
                        : !s.exists
                          ? 'border-dashed border-gray-300 bg-gray-50 text-gray-300'
                          : !s.inStock
                            ? 'border-[#4b5563] bg-white text-gray-400 line-through'
                            : 'border-[#4b5563] bg-white text-gray-800 hover:border-[#374151]',
                    )}
                  >
                    {s.value}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {soldOut && (
        <p className="text-[12px] font-bold text-red-500" data-testid="option-soldout-note">
          This combination is sold out. Pick another option.
        </p>
      )}
    </div>
  );
}
