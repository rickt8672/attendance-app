export const metadata = {
  title: '會員出席調查',
  description: '活動出席統計系統',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
}
