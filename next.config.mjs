/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * Static export for Cloudflare Pages.
   *
   * The whole site is already static — every route is prerendered via
   * generateStaticParams, and there is no server code, no API route and no
   * dynamic rendering. Exporting to plain files means Cloudflare serves it from
   * its edge with unlimited bandwidth, which is what this project needs: 74 MB of
   * 3D models is far more traffic than the 100 GB/month tiers comfortably allow.
   */
  output: "export",

  // No next/image is used, but the export target requires this to be explicit.
  images: { unoptimized: true },

  /*
   * Cache headers live in public/_headers, not here.
   *
   * `headers()` is a server feature and does nothing under `output: "export"` —
   * Next warns and drops it. Cloudflare reads public/_headers instead, which ends
   * up in the exported output verbatim. The models are immutable and must be
   * cached hard, or every visit re-downloads several megabytes.
   */

  // The floating "N" dev-tools badge. It only ever renders in `next dev` and
  // never in a production build, but it sits over the viewer and gets in the way
  // while working on the 3D canvas.
  devIndicators: false,
};

export default nextConfig;
