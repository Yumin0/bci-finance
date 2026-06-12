'use client'

import { useState } from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/dateUtils'

type AppUser = {
  id: number
  email: string
  name: string
  google_id: string | null
  created_at: string
  updated_at: string | null
}

export default function AccountTableView({ users }: { users: AppUser[] }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? users.filter(u =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
      )
    : users

  return (
    <Card>
      <CardHeader>
        <CardTitle>帳號列表</CardTitle>
        <CardAction className="flex items-center gap-2">
          <Input
            placeholder="搜尋帳號、姓名…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-64 bg-background"
          />
          <Link
            href="/system-settings/account-management/new"
            className={buttonVariants({ variant: 'default' })}
          >
            ＋ 新增帳號
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>編號</TableHead>
              <TableHead>帳號</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>登入方式</TableHead>
              <TableHead>建立日期</TableHead>
              <TableHead>更新日期</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => {
              const index = users.indexOf(user)
              return (
                <TableRow key={user.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    {user.google_id ? (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: '#e8f0fe', color: '#1a73e8', fontWeight: 500 }}>Google</span>
                    ) : (
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontWeight: 500 }}>Email</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(user.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(user.updated_at)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/system-settings/account-management/${user.id}/edit`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      編輯
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  {query ? '找不到符合的帳號' : '尚無帳號資料'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
