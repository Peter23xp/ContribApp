// ═══════════════════════════════════════════════════════════
// THE SOVEREIGN LEDGER — Design System from Stitch
// Project: DRC Group Contributions App
// ═══════════════════════════════════════════════════════════

export const Colors = {
  primary: '#00342D',
  primaryContainer: '#004D43',
  primaryFixed: '#A0F2E1',
  primaryFixedDim: '#84D5C5',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#6EBFAF',

  secondary: '#1B6D24',
  secondaryContainer: '#A0F399',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#217128',

  tertiary: '#002D5E',
  tertiaryContainer: '#004387',
  onTertiary: '#FFFFFF',
  onTertiaryContainer: '#84B2FF',

  surface: '#F3FAFF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#E6F6FF',
  surfaceContainer: '#DBF1FE',
  surfaceContainerHigh: '#D5ECF8',
  surfaceContainerHighest: '#CFE6F2',
  surfaceDim: '#C7DDE9',
  surfaceBright: '#F3FAFF',
  surfaceVariant: '#CFE6F2',

  onSurface: '#071E27',
  onSurfaceVariant: '#3F4945',
  onBackground: '#071E27',
  background: '#F3FAFF',

  outline: '#707975',
  outlineVariant: '#BFC9C4',

  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onError: '#FFFFFF',
  onErrorContainer: '#93000A',

  // Aliases
  accent: '#1B6D24',
  warning: '#B85C00',
  danger: '#BA1A1A',
  info: '#002D5E',

  statusPaid: '#1B6D24',
  statusPending: '#B85C00',
  statusLate: '#BA1A1A',
  statusPartial: '#002D5E',

  airtel: '#FF0000',
  orange: '#FF8C00',
  mpesa: '#00A651',
  mtn: '#FFCC00',

  textPrimary: '#071E27',
  textSecondary: '#3F4945',
  textMuted: '#707975',

  card: '#FFFFFF',
  border: '#BFC9C4',
  offline: '#FFF3CD',
};

// ── Typographie (correspond au design Stitch) ──────────────
export const Fonts = {
  display: 'Manrope_800ExtraBold',
  headline: 'Manrope_700Bold',
  title: 'Manrope_600SemiBold',
  body: 'Manrope_400Regular',
  label: 'Manrope_400Regular',
};

// ── Rayons ────────────────────────────────────────────────
export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 999,
};

// ── Ombres ambiantes ─────────────────────────────────────
export const Shadow = {
  card: {
    shadowColor: '#071E27',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#071E27',
    shadowOpacity: 0.1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};
