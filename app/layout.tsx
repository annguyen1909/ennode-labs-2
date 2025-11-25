import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Montserrat } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ennode Labs",
  description: "Ennode Labs made by An Nguyen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className= {`${montserrat.variable} ${geistMono.variable} antialiased`}>
        <NavBar />
        <div className="">{children}</div>
      </body>
    </html>
  );
}
