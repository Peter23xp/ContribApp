// ═══════════════════════════════════════════════════════════
// MFUKO SOVEREIGN — Design System v2.0
// Project: DRC Group Contributions App — ContribApp RDC
// Warm parchment surfaces · Gold accent · Forest teal primary
// ═══════════════════════════════════════════════════════════

export const Colors = {
  // ── Primary — Forest Teal ──────────────────────────────────
  primary: '#00342D',
  primaryContainer: '#004D43',
  primaryFixed: '#A0F2E1',
  primaryFixedDim: '#84D5C5',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#6EBFAF',

  // ── Secondary — Forest Green ───────────────────────────────
  secondary: '#1B6D24',
  secondaryContainer: '#A0F399',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#217128',

  // ── Tertiary — Deep Navy ───────────────────────────────────
  tertiary: '#002D5E',
  tertiaryContainer: '#004387',
  onTertiary: '#FFFFFF',
  onTertiaryContainer: '#84B2FF',

  // ── Surface — Warm Parchment (replaces cold ice blue) ──────
  surface: '#F9F5EE',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F4EFE6',
  surfaceContainer: '#EBE5DA',
  surfaceContainerHigh: '#E0D9CC',
  surfaceContainerHighest: '#D5CEBD',
  surfaceDim: '#C5BBAA',
  surfaceBright: '#FAF7F3',
  surfaceVariant: '#DDD7C9',

  // ── Text (unchanged — full readability on warm surfaces) ───
  onSurface: '#071E27',
  onSurfaceVariant: '#3F4945',
  onBackground: '#071E27',
  background: '#F9F5EE',

  // ── Outline — warm tone ────────────────────────────────────
  outline: '#707975',
  outlineVariant: '#C8BBA8',

  // ── Error ─────────────────────────────────────────────────
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onError: '#FFFFFF',
  onErrorContainer: '#93000A',

  // ── Aliases ───────────────────────────────────────────────
  accent: '#1B6D24',
  warning: '#B85C00',
  danger: '#BA1A1A',
  info: '#002D5E',

  // ── Status ────────────────────────────────────────────────
  statusPaid: '#1B6D24',
  statusPending: '#B85C00',
  statusLate: '#BA1A1A',
  statusPartial: '#002D5E',

  // ── Mobile Money operators ─────────────────────────────────
  airtel: '#FF0000',
  orange: '#FF8C00',
  mpesa: '#00A651',
  mtn: '#FFCC00',

  // ── Text aliases ──────────────────────────────────────────
  textPrimary: '#071E27',
  textSecondary: '#3F4945',
  textMuted: '#707975',

  // ── Component tokens ──────────────────────────────────────
  card: '#FFFFFF',
  border: '#C8BBA8',
  offline: '#FFF3CD',

  // ── Gold — primary accent (elevated from ignored token) ────
  gold: '#C9A84C',
  goldMuted: 'rgba(201,168,76,0.12)',
  goldLight: '#F0D89A',
  goldDark: '#9B7C2E',
};

// ── Typographie (Manrope — unchanged) ─────────────────────
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
    shadowColor: '#3D2410',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#00342D',
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};
