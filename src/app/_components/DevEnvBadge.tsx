const envConfig = {
  local: { label: '開發環境', color: '#3B82F6', signBg: '#EFF6FF' },
  development: { label: '測試環境', color: '#F59E0B', signBg: '#FFFBEB' },
} as const

export function DevEnvBadge() {
  const env = process.env.NEXT_PUBLIC_APP_ENV
  const config = envConfig[env as keyof typeof envConfig]
  if (!config) return null

  return (
    <div className="print:hidden" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, pointerEvents: 'none', userSelect: 'none' }}>
      <style>{`
        @keyframes devBadgeBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes devBadgeWave {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-42deg); }
          70% { transform: rotate(8deg); }
        }
        .dev-badge-bob { animation: devBadgeBob 1.8s ease-in-out infinite; }
        .dev-badge-wave-arm {
          transform-box: fill-box;
          transform-origin: 0% 100%;
          animation: devBadgeWave 1.8s ease-in-out infinite;
        }
      `}</style>
      <svg width="110" height="74" viewBox="0 0 132 88" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="devHaori" x="0" y="0" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="3.5" height="3.5" fill="#1A1A1A"/>
            <rect x="3.5" y="3.5" width="3.5" height="3.5" fill="#1A1A1A"/>
            <rect x="3.5" y="0" width="3.5" height="3.5" fill="#3AAA80"/>
            <rect x="0" y="3.5" width="3.5" height="3.5" fill="#3AAA80"/>
          </pattern>
        </defs>

        <g className="dev-badge-bob">

          {/* 看板 */}
          <rect x="2" y="14" width="66" height="24" rx="6"
            fill={config.signBg} stroke={config.color} strokeWidth="2"/>
          <text x="35" y="30" textAnchor="middle" fontSize="11" fontWeight="bold"
            fill={config.color} fontFamily="system-ui, sans-serif">
            {config.label}
          </text>
          <line x1="35" y1="38" x2="73" y2="50" stroke="#A0856A" strokeWidth="2" strokeLinecap="round"/>

          {/* === 炭治郎 === */}

          {/*
            頭髮：單一 path 描出帶尖刺的輪廓
            左->左側->左尖->回->中左尖->中尖->右尖->右側->右
            最後 L 直線收底（被頭圓蓋住）
          */}
          <path d="
            M 79 29
            C 75 22 77 13 82 9
            L 80 5
            C 84 3 87 6 87 11
            C 88 5 93 2 96 6
            L 95 2
            C 98 0 102 2 101 7
            C 103 3 108 4 110 9
            L 112 5
            C 115 7 116 13 113 18
            C 117 14 119 21 116 27
            L 79 29 Z
          " fill="#3D2008"/>

          {/* 左手袖子（在頭之前畫） */}
          <line x1="83" y1="56" x2="73" y2="50" stroke="#1A1A1A" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="72" cy="49" r="4.5" fill="#FFCF8A"/>

          {/* 頭 */}
          <circle cx="97" cy="31" r="19" fill="#FFCF8A" stroke="#D4A853" strokeWidth="1.5"/>

          {/* 額頭傷疤 */}
          <ellipse cx="90" cy="22" rx="5" ry="3.5" fill="#8B0000" opacity="0.82"/>

          {/* 左眼（紅色） */}
          <circle cx="90" cy="31" r="5.2" fill="white"/>
          <circle cx="90" cy="32" r="3.4" fill="#CC2222"/>
          <circle cx="91.5" cy="30" r="1.4" fill="white"/>

          {/* 右眼（紅色） */}
          <circle cx="105" cy="31" r="5.2" fill="white"/>
          <circle cx="105" cy="32" r="3.4" fill="#CC2222"/>
          <circle cx="106.5" cy="30" r="1.4" fill="white"/>

          {/* 腮紅 */}
          <circle cx="81" cy="37" r="3.5" fill="#FF9FAE" opacity="0.7"/>
          <circle cx="113" cy="37" r="3.5" fill="#FF9FAE" opacity="0.7"/>

          {/* 笑容（開口） */}
          <path d="M 89 40 Q 97 48 105 40"
            stroke="#C8964A" strokeWidth="1.8" fill="#FFD0C0" strokeLinecap="round"/>

          {/* 羽織（市松模樣） */}
          <path d="M 83 50 Q 78 62 76 75 L 118 75 Q 116 62 111 50 Z" fill="url(#devHaori)"/>

          {/* 深色領子 */}
          <rect x="91" y="50" width="12" height="16" rx="2" fill="#3A1010"/>

          {/* 白色腰帶 */}
          <rect x="82" y="60" width="30" height="5" rx="2" fill="white" opacity="0.95"/>

          {/* 右手袖子揮動 */}
          <g className="dev-badge-wave-arm">
            <line x1="111" y1="56" x2="123" y2="46" stroke="#1A1A1A" strokeWidth="8" strokeLinecap="round"/>
            <circle cx="124" cy="45" r="4.5" fill="#FFCF8A"/>
          </g>

          {/* 褲腿 */}
          <rect x="84" y="75" width="11" height="7" rx="2" fill="#3A1010"/>
          <rect x="101" y="75" width="11" height="7" rx="2" fill="#3A1010"/>

          {/* 白色腿部綁帶 */}
          <rect x="84" y="77" width="11" height="5" rx="1" fill="white" opacity="0.9"/>
          <rect x="101" y="77" width="11" height="5" rx="1" fill="white" opacity="0.9"/>

          {/* 草鞋 */}
          <ellipse cx="89" cy="83" rx="7.5" ry="3.2" fill="#7A3E1A"/>
          <ellipse cx="107" cy="83" rx="7.5" ry="3.2" fill="#7A3E1A"/>

        </g>
      </svg>
    </div>
  )
}
