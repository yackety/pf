# Design Tokens — Lazie UI

Source: `docs/DESIGN.md` — "Relaxed Productivity" design system.

Both light and dark themes are supported. Colors are defined as **CSS custom properties** — toggling the `dark` class on `<html>` switches the entire palette automatically. Tailwind tokens reference `var(--color-*)` so every utility (`bg-primary`, `text-on-surface`, etc.) works in both themes with zero `dark:` prefix overhead on color utilities.

Use `dark:` prefix only for non-color utilities (e.g. `dark:shadow-card-dark`, `dark:ring-offset-surface`).

---

---

## Colors

### Primary (Vibrant Lilac)
Primary actions, buttons, focus rings, progress indicators.

| Token | Hex | Tailwind key |
|---|---|---|
| `primary` | `#653ad6` | `primary` |
| `primary-container` | `#7e57f0` | `primary-container` |
| `on-primary` | `#ffffff` | `on-primary` |
| `on-primary-container` | `#fffbff` | `on-primary-container` |
| `inverse-primary` | `#cdbdff` | `inverse-primary` |
| `primary-fixed` | `#e8deff` | `primary-fixed` |
| `primary-fixed-dim` | `#cdbdff` | `primary-fixed-dim` |
| `on-primary-fixed` | `#20005f` | `on-primary-fixed` |
| `on-primary-fixed-variant` | `#4f1bc0` | `on-primary-fixed-variant` |

### Secondary (Deep Navy)
Navigation backgrounds, structural elements, typography.

| Token | Hex | Tailwind key |
|---|---|---|
| `secondary` | `#5a5798` | `secondary` |
| `secondary-container` | `#bbb7ff` | `secondary-container` |
| `on-secondary` | `#ffffff` | `on-secondary` |
| `on-secondary-container` | `#494585` | `on-secondary-container` |
| `secondary-fixed` | `#e3dfff` | `secondary-fixed` |
| `secondary-fixed-dim` | `#c4c0ff` | `secondary-fixed-dim` |
| `on-secondary-fixed` | `#161051` | `on-secondary-fixed` |
| `on-secondary-fixed-variant` | `#423f7e` | `on-secondary-fixed-variant` |

### Tertiary (Soft Lavender)
Large surface areas, tinted neutral backgrounds.

| Token | Hex | Tailwind key |
|---|---|---|
| `tertiary` | `#5c5b66` | `tertiary` |
| `tertiary-container` | `#74737f` | `tertiary-container` |
| `on-tertiary` | `#ffffff` | `on-tertiary` |
| `on-tertiary-container` | `#fffbff` | `on-tertiary-container` |
| `tertiary-fixed` | `#e3e1ee` | `tertiary-fixed` |
| `tertiary-fixed-dim` | `#c7c5d2` | `tertiary-fixed-dim` |
| `on-tertiary-fixed` | `#1b1b24` | `on-tertiary-fixed` |
| `on-tertiary-fixed-variant` | `#464651` | `on-tertiary-fixed-variant` |

### Surface
Page and container backgrounds. Use tonal layering — never harsh borders.

| Token | Hex | Tailwind key | Usage |
|---|---|---|---|
| `surface` | `#fbf8ff` | `surface` | Page background |
| `surface-dim` | `#d8d9eb` | `surface-dim` | Scrim behind modals |
| `surface-bright` | `#fbf8ff` | `surface-bright` | Elevated surface |
| `surface-container-lowest` | `#ffffff` | `surface-container-lowest` | Pure white cards |
| `surface-container-low` | `#f3f2ff` | `surface-container-low` | Default card background |
| `surface-container` | `#ececff` | `surface-container` | Sidebar, panel backgrounds |
| `surface-container-high` | `#e6e7fa` | `surface-container-high` | Table header, hovered rows |
| `surface-container-highest` | `#e0e1f4` | `surface-container-highest` | Selected rows |
| `surface-variant` | `#e0e1f4` | `surface-variant` | Alternative surface |
| `surface-tint` | `#673dd8` | `surface-tint` | Tint overlay |

### On-Surface (text / icon colors)

| Token | Hex | Tailwind key | Usage |
|---|---|---|---|
| `on-surface` | `#181b28` | `on-surface` | Primary text |
| `on-surface-variant` | `#494454` | `on-surface-variant` | Secondary text, placeholders |
| `inverse-surface` | `#2d303e` | `inverse-surface` | Tooltips, snackbars |
| `inverse-on-surface` | `#f0efff` | `inverse-on-surface` | Text on inverse surface |

### Outline

| Token | Hex | Tailwind key | Usage |
|---|---|---|---|
| `outline` | `#7a7486` | `outline` | Borders, dividers, input borders |
| `outline-variant` | `#cac3d7` | `outline-variant` | Subtle / inactive borders |

### Functional

| Token | Hex | Tailwind key | Usage |
|---|---|---|---|
| `error` | `#ba1a1a` | `error` | Error text, borders |
| `on-error` | `#ffffff` | `on-error` | Text on error |
| `error-container` | `#ffdad6` | `error-container` | Error backgrounds |
| `on-error-container` | `#93000a` | `on-error-container` | Text in error container |
| `background` | `#fbf8ff` | `background` | Same as `surface` |
| `on-background` | `#181b28` | `on-background` | Same as `on-surface` |

---

## Typography

Load via Google Fonts CDN in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap" rel="stylesheet" />
```

| Role | Font | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| `headline-xl` | Plus Jakarta Sans | 48px / 3rem | 700 | 1.1 | -0.02em |
| `headline-lg` | Plus Jakarta Sans | 32px / 2rem | 700 | 1.2 | -0.01em |
| `headline-md` | Plus Jakarta Sans | 24px / 1.5rem | 600 | 1.3 | — |
| `body-lg` | Be Vietnam Pro | 18px / 1.125rem | 400 | 1.6 | — |
| `body-md` | Be Vietnam Pro | 16px / 1rem | 400 | 1.6 | — |
| `label-md` | Be Vietnam Pro | 14px / 0.875rem | 600 | 1.4 | — |
| `label-sm` | Be Vietnam Pro | 12px / 0.75rem | 500 | 1.4 | — |

Map in Tailwind config as `fontSize` with `[size, { lineHeight, fontWeight, letterSpacing }]`.

---

## Spacing (8px base unit)

| Token | Value | Usage |
|---|---|---|
| `stack-sm` | 8px (0.5rem) | Tight stacks, icon gaps |
| `stack-md` | 16px (1rem) | Standard vertical rhythm |
| `stack-lg` | 32px (2rem) | Section separation |
| `gutter` | 24px (1.5rem) | Column gutters |
| `container-max` | 1280px | `max-w-[1280px]` |
| `margin-mobile` | 16px (1rem) | Page edge on mobile |
| `margin-desktop` | 40px (2.5rem) | Page edge on desktop |

---

## Border Radius

All elements use heavily rounded corners. No sharp edges.

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | 0.5rem | Small chips, badges |
| `rounded` (default) | 1rem | General containers |
| `rounded-md` | 1.5rem | Medium cards |
| `rounded-lg` | 2rem | Large panels |
| `rounded-xl` | 3rem | Cards, modals, large containers |
| `rounded-full` | 9999px | Buttons, inputs, avatar circles |

---

## Shadows

Soft, diffused, low-opacity — never harsh black:

```css
/* Card shadow — tinted with deep navy at ~6% opacity */
box-shadow: 0 4px 24px 0 rgba(24, 27, 40, 0.06);

/* Elevated (hover/modal) — slightly stronger */
box-shadow: 0 8px 40px 0 rgba(24, 27, 40, 0.10);
```

In Tailwind config, define as `boxShadow` theme extensions:
```ts
boxShadow: {
  card: '0 4px 24px 0 rgba(24,27,40,0.06)',
  elevated: '0 8px 40px 0 rgba(24,27,40,0.10)',
}
```

---

## Interaction States

| State | Behaviour |
|---|---|
| Button hover | `scale-[1.02]` + slight color lightening (not drastic) |
| Button active | `scale-[0.98]` — sinks slightly |
| Input focus | 2px border in `primary` + soft outer glow (`ring-2 ring-primary/30`) |
| Row hover | `bg-surface-container-high` |
| Card hover | Transitions to `shadow-elevated` |
| All transitions | `transition-all duration-200 ease-out` |

---

## tailwind.config.ts skeleton

All colors reference CSS custom properties so a single class toggle on `<html>` switches the full theme.

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // All values are CSS vars — light/dark resolved by .dark class on <html>
        primary:                    'var(--color-primary)',
        'primary-container':        'var(--color-primary-container)',
        'on-primary':               'var(--color-on-primary)',
        'on-primary-container':     'var(--color-on-primary-container)',
        'inverse-primary':          'var(--color-inverse-primary)',
        secondary:                  'var(--color-secondary)',
        'secondary-container':      'var(--color-secondary-container)',
        'on-secondary':             'var(--color-on-secondary)',
        'on-secondary-container':   'var(--color-on-secondary-container)',
        tertiary:                   'var(--color-tertiary)',
        'tertiary-container':       'var(--color-tertiary-container)',
        'on-tertiary':              'var(--color-on-tertiary)',
        surface:                    'var(--color-surface)',
        'surface-dim':              'var(--color-surface-dim)',
        'surface-bright':           'var(--color-surface-bright)',
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        'surface-container-low':    'var(--color-surface-container-low)',
        'surface-container':        'var(--color-surface-container)',
        'surface-container-high':   'var(--color-surface-container-high)',
        'surface-container-highest':'var(--color-surface-container-highest)',
        'on-surface':               'var(--color-on-surface)',
        'on-surface-variant':       'var(--color-on-surface-variant)',
        'inverse-surface':          'var(--color-inverse-surface)',
        'inverse-on-surface':       'var(--color-inverse-on-surface)',
        outline:                    'var(--color-outline)',
        'outline-variant':          'var(--color-outline-variant)',
        error:                      'var(--color-error)',
        'on-error':                 'var(--color-on-error)',
        'error-container':          'var(--color-error-container)',
        'on-error-container':       'var(--color-on-error-container)',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body:    ['Be Vietnam Pro', 'sans-serif'],
      },
      borderRadius: {
        sm:      '0.5rem',
        DEFAULT: '1rem',
        md:      '1.5rem',
        lg:      '2rem',
        xl:      '3rem',
      },
      boxShadow: {
        card:         '0 4px 24px 0 rgba(24,27,40,0.06)',
        elevated:     '0 8px 40px 0 rgba(24,27,40,0.10)',
        'card-dark':  '0 4px 24px 0 rgba(0,0,0,0.25)',
        'elevated-dark': '0 8px 40px 0 rgba(0,0,0,0.40)',
      },
      maxWidth: {
        container: '1280px',
      },
    },
  },
} satisfies Config;
```

---

## styles.css — CSS custom property definitions

Define all token values here. Toggling `dark` on `<html>` swaps the full palette.

```css
@import "tailwindcss";

/* ─── Light theme (default) ─────────────────────────────── */
:root {
  /* Primary */
  --color-primary:                  #653ad6;
  --color-primary-container:        #7e57f0;
  --color-on-primary:               #ffffff;
  --color-on-primary-container:     #fffbff;
  --color-inverse-primary:          #cdbdff;

  /* Secondary */
  --color-secondary:                #5a5798;
  --color-secondary-container:      #bbb7ff;
  --color-on-secondary:             #ffffff;
  --color-on-secondary-container:   #494585;

  /* Tertiary */
  --color-tertiary:                 #5c5b66;
  --color-tertiary-container:       #74737f;
  --color-on-tertiary:              #ffffff;

  /* Surface */
  --color-surface:                  #fbf8ff;
  --color-surface-dim:              #d8d9eb;
  --color-surface-bright:           #fbf8ff;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low:    #f3f2ff;
  --color-surface-container:        #ececff;
  --color-surface-container-high:   #e6e7fa;
  --color-surface-container-highest:#e0e1f4;

  /* On-surface */
  --color-on-surface:               #181b28;
  --color-on-surface-variant:       #494454;
  --color-inverse-surface:          #2d303e;
  --color-inverse-on-surface:       #f0efff;

  /* Outline */
  --color-outline:                  #7a7486;
  --color-outline-variant:          #cac3d7;

  /* Error */
  --color-error:                    #ba1a1a;
  --color-on-error:                 #ffffff;
  --color-error-container:          #ffdad6;
  --color-on-error-container:       #93000a;
}

/* ─── Dark theme ─────────────────────────────────────────── */
.dark {
  /* Primary — lighter lilac for contrast on dark surfaces */
  --color-primary:                  #cdbdff;
  --color-primary-container:        #4d24b8;
  --color-on-primary:               #36009f;
  --color-on-primary-container:     #e8deff;
  --color-inverse-primary:          #653ad6;

  /* Secondary */
  --color-secondary:                #c4c0ff;
  --color-secondary-container:      #423f7e;
  --color-on-secondary:             #2b2770;
  --color-on-secondary-container:   #e3dfff;

  /* Tertiary */
  --color-tertiary:                 #c7c5d2;
  --color-tertiary-container:       #464651;
  --color-on-tertiary:              #303038;

  /* Surface — deep navy-tinted darks, never pure black */
  --color-surface:                  #111318;
  --color-surface-dim:              #111318;
  --color-surface-bright:           #37393e;
  --color-surface-container-lowest: #0c0e13;
  --color-surface-container-low:    #191c22;
  --color-surface-container:        #1d2027;
  --color-surface-container-high:   #282b31;
  --color-surface-container-highest:#33363c;

  /* On-surface */
  --color-on-surface:               #e2e2ea;
  --color-on-surface-variant:       #c5c0d4;
  --color-inverse-surface:          #e4e1ec;
  --color-inverse-on-surface:       #2d303e;

  /* Outline */
  --color-outline:                  #8f8a9e;
  --color-outline-variant:          #494454;

  /* Error */
  --color-error:                    #ffb4ab;
  --color-on-error:                 #690005;
  --color-error-container:          #93000a;
  --color-on-error-container:       #ffdad6;
}
```

---

## Dark theme palette reference

Derived from Material Design 3 dark tone mapping of the "Relaxed Productivity" palette.

### Primary
| Token | Light | Dark |
|---|---|---|
| `primary` | `#653ad6` | `#cdbdff` |
| `primary-container` | `#7e57f0` | `#4d24b8` |
| `on-primary` | `#ffffff` | `#36009f` |
| `on-primary-container` | `#fffbff` | `#e8deff` |

### Secondary
| Token | Light | Dark |
|---|---|---|
| `secondary` | `#5a5798` | `#c4c0ff` |
| `secondary-container` | `#bbb7ff` | `#423f7e` |
| `on-secondary` | `#ffffff` | `#2b2770` |
| `on-secondary-container` | `#494585` | `#e3dfff` |

### Surface
| Token | Light | Dark |
|---|---|---|
| `surface` | `#fbf8ff` | `#111318` |
| `surface-container-lowest` | `#ffffff` | `#0c0e13` |
| `surface-container-low` | `#f3f2ff` | `#191c22` |
| `surface-container` | `#ececff` | `#1d2027` |
| `surface-container-high` | `#e6e7fa` | `#282b31` |
| `surface-container-highest` | `#e0e1f4` | `#33363c` |
| `on-surface` | `#181b28` | `#e2e2ea` |
| `on-surface-variant` | `#494454` | `#c5c0d4` |

### Outline
| Token | Light | Dark |
|---|---|---|
| `outline` | `#7a7486` | `#8f8a9e` |
| `outline-variant` | `#cac3d7` | `#494454` |

### Error
| Token | Light | Dark |
|---|---|---|
| `error` | `#ba1a1a` | `#ffb4ab` |
| `error-container` | `#ffdad6` | `#93000a` |
| `on-error-container` | `#93000a` | `#ffdad6` |

---

## Shadow variants

Use `dark:` prefix to switch shadow intensity in dark mode:

```html
<div class="shadow-card dark:shadow-card-dark hover:shadow-elevated dark:hover:shadow-elevated-dark">
```
