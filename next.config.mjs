/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Telegram embeds the webapp in an iframe-like context; allow images from Supabase if used later.
  images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] },
};

export default nextConfig;
