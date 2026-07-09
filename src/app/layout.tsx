import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/session";
import SidebarLayout from "@/app/_components/SidebarLayout";
import ThemeProvider from "@/app/_components/ThemeProvider";
import ThemeToggleButton from "@/app/_components/ThemeToggleButton";
import HeaderLogo from "@/app/_components/HeaderLogo";
import UserAvatar from "@/app/_components/UserAvatar";
import NotificationBell from "@/app/_components/NotificationBell";
import { getSidebarConfigForUser } from "@/app/actions/sidebar-config";
import { getUserAvatarUrl } from "@/app/actions/account";
import { getUnreadCount } from "@/app/actions/notifications";
import { DevEnvBadge } from "@/app/_components/DevEnvBadge";
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
  title: "BC 資金分配系統",
  description: "BC 內部資金分配管理系統",
};

// 頁面渲染前依 localStorage（或系統偏好）套用深色 class，避免刷新時閃爍
const themeInitScript = `(function() {
  var saved = localStorage.getItem('bci-theme');
  var dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
})()`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession()
  const sidebarConfig = session ? await getSidebarConfigForUser(session.userId) : []
  const avatarUrl = session ? await getUserAvatarUrl(session.userId) : null
  const unreadCount = session ? await getUnreadCount(session.userId) : 0

  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {session ? (
            <>
              <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 52, background: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px 0 24px' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 'bold', fontSize: 16, textDecoration: 'none', color: 'var(--text-title)' }}>
                  <HeaderLogo />
                  BC 資金分配系統
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ThemeToggleButton />
                  <NotificationBell userId={session.userId} initialUnreadCount={unreadCount} />
                  <UserAvatar userId={session.userId} name={session.name} initialAvatarUrl={avatarUrl} />
                </div>
              </header>
              <SidebarLayout config={sidebarConfig}>
                {children}
              </SidebarLayout>
            </>
          ) : (
            children
          )}
          <DevEnvBadge />
        </ThemeProvider>
      </body>
    </html>
  );
}
