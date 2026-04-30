---
name: Relaxed Productivity
colors:
  surface: '#fbf8ff'
  surface-dim: '#d8d9eb'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f2ff'
  surface-container: '#ececff'
  surface-container-high: '#e6e7fa'
  surface-container-highest: '#e0e1f4'
  on-surface: '#181b28'
  on-surface-variant: '#494454'
  inverse-surface: '#2d303e'
  inverse-on-surface: '#f0efff'
  outline: '#7a7486'
  outline-variant: '#cac3d7'
  surface-tint: '#673dd8'
  primary: '#653ad6'
  on-primary: '#ffffff'
  primary-container: '#7e57f0'
  on-primary-container: '#fffbff'
  inverse-primary: '#cdbdff'
  secondary: '#5a5798'
  on-secondary: '#ffffff'
  secondary-container: '#bbb7ff'
  on-secondary-container: '#494585'
  tertiary: '#5c5b66'
  on-tertiary: '#ffffff'
  tertiary-container: '#74737f'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e8deff'
  primary-fixed-dim: '#cdbdff'
  on-primary-fixed: '#20005f'
  on-primary-fixed-variant: '#4f1bc0'
  secondary-fixed: '#e3dfff'
  secondary-fixed-dim: '#c4c0ff'
  on-secondary-fixed: '#161051'
  on-secondary-fixed-variant: '#423f7e'
  tertiary-fixed: '#e3e1ee'
  tertiary-fixed-dim: '#c7c5d2'
  on-tertiary-fixed: '#1b1b24'
  on-tertiary-fixed-variant: '#464651'
  background: '#fbf8ff'
  on-background: '#181b28'
  surface-variant: '#e0e1f4'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

This design system is built on the philosophy of "relaxed productivity"—the idea that high output doesn't require high stress. Taking direct cues from the "lazie" wordmark, the visual language is soft, rounded, and approachable, effectively stripping away the clinical coldness often found in productivity tools.

The style is **Modern / Tactile**, utilizing soft-touch surfaces, generous whitespace, and organic shapes. It prioritizes clarity and ease of use, evoking an emotional response of calm focus. By combining a professional deep navy with a playful lilac, the system balances reliability with a youthful, energetic spirit.

## Colors

The palette is anchored by a high-contrast pairing of **Deep Navy** and **Vibrant Lilac**.

- **Primary (Vibrant Lilac):** Used for primary actions, progress indicators, and playful accents. It represents the "spark" of creativity.
- **Secondary (Deep Navy):** Used for typography, navigation backgrounds, and structural elements to provide a sense of grounded stability.
- **Tertiary (Soft Lavender):** A tinted neutral used for large surface areas and background containers to keep the UI feeling "airy."
- **Functional Neutrals:** A range of cool greys derived from the navy hue to ensure cohesive hierarchy in secondary text and borders.

## Typography

The typography selection reinforces the "friendly sans-serif" requirement. **Plus Jakarta Sans** is used for headlines to provide a modern, geometric, and optimistic personality. Its open counters and soft terminals mirror the "lazie" logo's geometry.

For body text and labels, **Be Vietnam Pro** offers exceptional readability with a contemporary, warm tone. The scale prioritizes generous line heights to maintain a "relaxed" reading pace, preventing information density from feeling overwhelming.

## Layout & Spacing

This design system employs a **Fluid Grid** with an 8px base unit. The layout is intentionally spacious, using "breathing room" to signal a stress-free environment.

Components are organized using a 12-column system on desktop, but the internal content often centers within a 10-column span to increase the feeling of focus. Gutters are kept wide (24px) to ensure elements never feel cramped. Vertical rhythm is strictly enforced using the `stack` variables to maintain a consistent flow from top to bottom.

## Elevation & Depth

To achieve the "relaxed" aesthetic, this design system avoids harsh shadows and stark black borders. Instead, it utilizes **Tonal Layers** and **Ambient Shadows**.

- **Surfaces:** Use subtle shifts in background color (e.g., Lilac #F4F1FF against a white background) to define areas.
- **Shadows:** Highly diffused, low-opacity shadows (Blur: 20px-40px, Opacity: 4-8%) tinted with the Deep Navy color. This creates a soft, cloud-like lift for cards and menus.
- **Interactions:** When an element is pressed or hovered, it physically "sinks" or "lifts" slightly, using a smooth 200ms easing to reinforce the tactile nature of the interface.

## Shapes

The shape language is the most direct translation of the logo. All UI elements use **Pill-shaped** or heavily rounded corners.

Standard components (buttons, inputs) utilize a fully rounded "pill" radius. Larger containers (cards, modals) use a `rounded-xl` (3rem) radius to maintain the soft, friendly appearance even at a large scale. This consistent curvature eliminates "sharpness" from the UI, contributing to the approachable feel.

## Components

- **Buttons:** Primary buttons are pill-shaped, using the Vibrant Lilac background with white text. Hover states involve a slight scale-up (1.02x) rather than a drastic color change.
- **Input Fields:** Generous padding (16px) and a subtle lilac border. Focus states use a thicker (2px) border in Vibrant Lilac with a soft outer glow.
- **Cards:** White or light-lavender backgrounds with 3rem rounded corners. They should have a very soft, tinted shadow to separate them from the base background.
- **Chips & Tags:** Small, pill-shaped elements using a 10% opacity version of the primary lilac for the background and the secondary navy for the text.
- **Progress Indicators:** Thick, rounded bars that avoid sharp ends, mimicking the weight of the "l" and "i" in the logo.
- **Selection Controls:** Checkboxes and Radio buttons are oversized and circular to stay consistent with the "o" and "e" in the logo mark.