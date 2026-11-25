// Situs statis untuk GitHub Pages. NEXT_PUBLIC_BASE_PATH diisi otomatis oleh workflow: /<nama-repo>
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export default {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
