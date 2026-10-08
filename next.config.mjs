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
  async rewrites() {
    // QR codes on printed sheets use uppercase (dalaedu.com/R/G6-...) because it makes the code smaller.
    // Routes are case-sensitive, so send /R/... to the lowercase /r/... page.
    return [
      { source: "/R", destination: "/r" },
      { source: "/R/:path*", destination: "/r/:path*" },
    ];
  },
};

export default nextConfig;
