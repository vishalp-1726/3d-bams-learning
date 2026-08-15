/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The floating "N" dev-tools badge. It only ever renders in `next dev` and
  // never in a production build, but it sits over the viewer and gets in the way
  // while working on the 3D canvas.
  devIndicators: false,
  // GLB/Draco assets are served as static files. When they move to Cloudflare R2,
  // set NEXT_PUBLIC_MODEL_BASE_URL and nothing else needs to change.
  async headers() {
    return [
      {
        // Models are content-addressed by region name and change rarely.
        source: "/models/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/draco/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
