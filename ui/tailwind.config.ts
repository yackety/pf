import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary:                     'var(--color-primary)',
        'primary-container':         'var(--color-primary-container)',
        'on-primary':                'var(--color-on-primary)',
        'on-primary-container':      'var(--color-on-primary-container)',
        'inverse-primary':           'var(--color-inverse-primary)',
        'primary-fixed':             'var(--color-primary-fixed)',
        'primary-fixed-dim':         'var(--color-primary-fixed-dim)',
        'on-primary-fixed':          'var(--color-on-primary-fixed)',
        'on-primary-fixed-variant':  'var(--color-on-primary-fixed-variant)',

        secondary:                   'var(--color-secondary)',
        'secondary-container':       'var(--color-secondary-container)',
        'on-secondary':              'var(--color-on-secondary)',
        'on-secondary-container':    'var(--color-on-secondary-container)',
        'secondary-fixed':           'var(--color-secondary-fixed)',
        'secondary-fixed-dim':       'var(--color-secondary-fixed-dim)',
        'on-secondary-fixed':        'var(--color-on-secondary-fixed)',
        'on-secondary-fixed-variant':'var(--color-on-secondary-fixed-variant)',

        tertiary:                    'var(--color-tertiary)',
        'tertiary-container':        'var(--color-tertiary-container)',
        'on-tertiary':               'var(--color-on-tertiary)',
        'on-tertiary-container':     'var(--color-on-tertiary-container)',
        'tertiary-fixed':            'var(--color-tertiary-fixed)',
        'tertiary-fixed-dim':        'var(--color-tertiary-fixed-dim)',
        'on-tertiary-fixed':         'var(--color-on-tertiary-fixed)',
        'on-tertiary-fixed-variant': 'var(--color-on-tertiary-fixed-variant)',

        surface:                     'var(--color-surface)',
        'surface-dim':               'var(--color-surface-dim)',
        'surface-bright':            'var(--color-surface-bright)',
        'surface-container-lowest':  'var(--color-surface-container-lowest)',
        'surface-container-low':     'var(--color-surface-container-low)',
        'surface-container':         'var(--color-surface-container)',
        'surface-container-high':    'var(--color-surface-container-high)',
        'surface-container-highest': 'var(--color-surface-container-highest)',
        'surface-variant':           'var(--color-surface-variant)',
        'surface-tint':              'var(--color-surface-tint)',

        'on-surface':                'var(--color-on-surface)',
        'on-surface-variant':        'var(--color-on-surface-variant)',
        'inverse-surface':           'var(--color-inverse-surface)',
        'inverse-on-surface':        'var(--color-inverse-on-surface)',

        outline:                     'var(--color-outline)',
        'outline-variant':           'var(--color-outline-variant)',

        error:                       'var(--color-error)',
        'on-error':                  'var(--color-on-error)',
        'error-container':           'var(--color-error-container)',
        'on-error-container':        'var(--color-on-error-container)',

        background:                  'var(--color-background)',
        'on-background':             'var(--color-on-background)',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body:    ['Be Vietnam Pro', 'sans-serif'],
      },
      fontSize: {
        'headline-xl': ['3rem',    { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        'headline-lg': ['2rem',    { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.01em' }],
        'headline-md': ['1.5rem',  { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg':     ['1.125rem',{ lineHeight: '1.6', fontWeight: '400' }],
        'body-md':     ['1rem',    { lineHeight: '1.6', fontWeight: '400' }],
        'label-md':    ['0.875rem',{ lineHeight: '1.4', fontWeight: '600' }],
        'label-sm':    ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        sm:      '0.5rem',
        DEFAULT: '1rem',
        md:      '1.5rem',
        lg:      '2rem',
        xl:      '3rem',
        full:    '9999px',
      },
      boxShadow: {
        card:              '0 4px 24px 0 rgba(24,27,40,0.06)',
        elevated:          '0 8px 40px 0 rgba(24,27,40,0.10)',
        'card-dark':       '0 4px 24px 0 rgba(0,0,0,0.25)',
        'elevated-dark':   '0 8px 40px 0 rgba(0,0,0,0.40)',
      },
      maxWidth: {
        container: '1280px',
      },
    },
  },
} satisfies Config;
