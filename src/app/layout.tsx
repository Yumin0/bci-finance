import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import SidebarNav from "@/app/_components/SidebarNav";
import { getSidebarConfigForUser } from "@/app/actions/sidebar-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BCI 財務系統",
  description: "BCI 內部財務管理系統",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession()
  const sidebarConfig = session ? await getSidebarConfigForUser(session.userId) : []

  return (
    <html
      lang="zh-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 52, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <Link href="/" style={{ fontWeight: 'bold', fontSize: 16, textDecoration: 'none', color: '#111' }}>
            BCI 財務系統
          </Link>
          {session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 14, color: '#374151' }}>{session.name}</span>
              <form action={logout}>
                <button type="submit" style={{ fontSize: 13, color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
                  登出
                </button>
              </form>
            </div>
          )}
        </header>
        <div style={{ display: 'flex', marginTop: 52, minHeight: 'calc(100vh - 52px)' }}>
          <nav style={{ position: 'fixed', top: 52, left: 0, bottom: 0, width: 220, background: '#f9fafb', borderRight: '1px solid #e5e7eb', padding: '24px 0', overflowY: 'auto' }}>
            <SidebarNav config={sidebarConfig} />
          </nav>
          <main style={{ marginLeft: 220, flex: 1, padding: 32 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
