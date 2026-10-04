/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "miqyas-blond\\.vercel\\.app" }],
        destination: "https://www.dalaedu.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
