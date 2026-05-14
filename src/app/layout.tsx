import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
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
            <p style={{ padding: '0 24px 8px', fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>資金分配申請</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[
                { href: '/funds-allocation/my-funds', label: '我的申請紀錄' },
                { href: '/funds-allocation/step1', label: '課級單據管理' },
                { href: '/funds-allocation/step2', label: '處級單據管理' },
                { href: '/funds-allocation/step3', label: '諮詢議會' },
                { href: '/funds-allocation/step4', label: '主管議會' },
                { href: '/funds-allocation/step5', label: '財務長' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} style={{ display: 'block', padding: '10px 24px', textDecoration: 'none', color: '#374151', fontSize: 14 }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <p style={{ padding: '16px 24px 8px', fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>付款憑單</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[
                { href: '/funds-payment/my-payment', label: '我的付款憑單' },
                { href: '/funds-payment/step1', label: '課級單據管理' },
                { href: '/funds-payment/step2', label: '處級單據管理' },
                { href: '/funds-payment/step3', label: '第三處支出課' },
                { href: '/funds-payment/step4', label: '第三處 處長' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} style={{ display: 'block', padding: '10px 24px', textDecoration: 'none', color: '#374151', fontSize: 14 }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <p style={{ padding: '16px 24px 8px', fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em' }}>系統設定</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[
                { href: '/system-settings/expense-fields', label: '支出欄位設定' },
                { href: '/system-settings/org-structure', label: '組織架構設定' },
                { href: '/system-settings/position-settings', label: '職位設定' },
                { href: '/system-settings/account-management', label: '帳號管理' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} style={{ display: 'block', padding: '10px 24px', textDecoration: 'none', color: '#374151', fontSize: 14 }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main style={{ marginLeft: 220, flex: 1, padding: 32 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
