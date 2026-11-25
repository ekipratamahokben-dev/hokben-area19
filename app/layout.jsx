import "./globals.css";
import { Manrope } from "next/font/google";
import { AuthProvider } from "../lib/auth";
import Shell from "../components/Shell";

const font = Manrope({ subsets: ["latin"], display: "swap" });
export const metadata = { title: "Daily Report Area 19" };
export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={font.className}>
        <AuthProvider><Shell>{children}</Shell></AuthProvider>
      </body>
    </html>
  );
}
