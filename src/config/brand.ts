/**
 * Centralised brand assets. Replace these to rebrand the app (e.g. with licensed Sky artwork).
 * The default wordmark is a text placeholder rendered by <BrandLogo/>; set `logoUrl` to use an image instead.
 * This is an independent demo and is not affiliated with, endorsed by, or an official product of Sky UK Ltd.
 */
export const brand = {
  name: 'Sky',
  productName: 'Sky Stream Demo',
  wordmark: 'sky',
  kidsWordmark: 'kids',
  /** Optional licensed logo image (SVG/PNG). When unset, a text wordmark is rendered. */
  logoUrl: undefined as string | undefined,
  kidsLogoUrl: undefined as string | undefined,
  /** Gradient used by the placeholder wordmark. */
  wordmarkGradient: 'linear-gradient(100deg, #ff9a3d 0%, #ff2e63 38%, #8c2cff 66%, #2b6bff 100%)',
  originalsLabel: 'original',
  disclaimer:
    'Independent demonstration app. Not affiliated with, endorsed by, or an official product of Sky UK Ltd. Brand assets are placeholders.',
};
