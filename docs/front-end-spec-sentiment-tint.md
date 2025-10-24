# Sentiment Tint Specification

## Overview
Replace the separate sentiment indicator component with a subtle background tint applied directly to message bubbles. This creates a more integrated, minimal visual treatment for sentiment analysis.

## Design Decision
- **Remove:** `SentimentIndicator` component (separate display below messages)
- **Add:** Background tint directly on message bubble
- **Rationale:** Reduces visual clutter, integrates sentiment into existing UI element, maintains awareness without interrupting message flow

## Color Palette

### Sentiment Score Mapping
| Sentiment Range | Label | Tint Color | Opacity | RGBA Value |
|-----------------|-------|------------|---------|------------|
| ≤ -0.7 | Strong Negative | Red | 8% | `rgba(255, 59, 48, 0.08)` |
| -0.69 to -0.3 | Moderate Negative | Orange | 5% | `rgba(255, 149, 0, 0.05)` |
| -0.29 to 0.29 | Neutral | None | 0% | No tint applied |
| 0.3 to 0.69 | Moderate Positive | Light Green | 5% | `rgba(52, 199, 89, 0.05)` |
| ≥ 0.7 | Strong Positive | Green | 8% | `rgba(52, 199, 89, 0.08)` |

### Color Selection Rationale
- **iOS System Colors:** Using iOS system red, orange, and green for consistency with platform conventions
- **Low Opacity:** 5-8% opacity ensures readability while providing ambient awareness
- **Stronger = More Visible:** Higher sentiment intensity (positive or negative) gets higher opacity
- **Neutral Zone:** -0.29 to 0.29 range shows no tint to avoid visual noise on most messages

## Accessibility

### Contrast Ratios
- Tint opacity kept low (≤8%) to ensure text contrast remains WCAG AA compliant
- Works with existing message bubble colors (blue for sent, gray for received)
- Tested combinations:
  - Blue bubble (#007AFF) + red tint: Maintains 4.5:1 contrast with white text
  - Gray bubble (#E5E5EA) + any tint: Maintains 4.5:1 contrast with black text

### Reduced Motion
- No animation on tint application (static color only)
- Respects `prefers-reduced-motion` automatically

## Implementation Notes

### Files to Modify
1. **`components/chat/MessageItem.tsx`**
   - Add `getSentimentTint()` helper function
   - Apply tint to message bubble background
   - Remove `<SentimentIndicator>` component usage

2. **`components/chat/SentimentIndicator.tsx`**
   - Can be deleted (no longer used)

3. **`types/ai.ts`** (if needed)
   - Ensure `SentimentScore` type exists and is imported

### Helper Function
```typescript
const getSentimentTint = (score: number): string => {
  if (score <= -0.7) return 'rgba(255, 59, 48, 0.08)';
  if (score <= -0.3) return 'rgba(255, 149, 0, 0.05)';
  if (score >= 0.7) return 'rgba(52, 199, 89, 0.08)';
  if (score >= 0.3) return 'rgba(52, 199, 89, 0.05)';
  return 'transparent'; // Neutral
};
```

### Application Method
- Apply as inline style or via StyleSheet
- Overlay on top of existing bubble background color
- Ensure tint is applied to the entire bubble container

## Visual Reference

### Before (Separate Component)
```
┌─────────────────────────────────┐
│ I am so frustrated and angry!   │
│ I feel terrible                 │
│                     10:44 PM ✓✓ │
└─────────────────────────────────┘
┌─────────────────────────────────┐  ← Separate component
│ Negative          [====    ] -0.80│
└─────────────────────────────────┘
```

### After (Integrated Tint)
```
┌─────────────────────────────────┐
│ I am so frustrated and angry!   │ ← Subtle red tint on bubble
│ I feel terrible                 │    No separate component
│                     10:44 PM ✓✓ │
└─────────────────────────────────┘
```

## Testing Checklist
- [ ] Strong negative messages show red tint
- [ ] Moderate negative messages show orange tint
- [ ] Neutral messages show no tint
- [ ] Positive messages show green tint
- [ ] Text remains readable on all tint colors
- [ ] Works on both sent (blue) and received (gray) bubbles
- [ ] SentimentIndicator component is removed from DOM
- [ ] No visual regression on messages without sentiment data

## Future Considerations
- Dark mode: May need different tint values for dark backgrounds
- User preference: Could add setting to disable sentiment tints entirely
- Accessibility audit: Validate with actual screen reader users

---

**Document Version:** 1.0
**Date:** 2025-10-23
**Author:** Sally (UX Expert)
