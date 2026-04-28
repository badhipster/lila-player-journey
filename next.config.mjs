/** @type {import('next').NextConfig} */
const nextConfig = {
  // Konva ships an `index-node.js` entry that requires the native `canvas` npm
  // module. We never run Konva on the server (the consuming component is
  // wrapped in next/dynamic({ ssr: false }) and is a "use client" file), so
  // tell webpack to ignore that requirement during the server build.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { canvas: "commonjs canvas" },
      ];
    }
    return config;
  },
};

export default nextConfig;
