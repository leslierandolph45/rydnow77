/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/api/rydnow/:path*',
        destination: 'https://rydnow-backend.onrender.com/api/:path*',
      },
    ];
  },
};

export default nextConfig;
