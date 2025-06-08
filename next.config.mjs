/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/:path*',
          destination: '/',
        },
      ],
    }
  },
}

export default nextConfig