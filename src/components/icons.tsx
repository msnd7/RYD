type P = { className?: string }
const S = (d: string) => (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={p.className ?? 'w-[18px] h-[18px]'}>
    {d.split('|').map((x, i) => <path key={i} d={x} />)}
  </svg>
)

export const IconGrid = S('M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z')
export const IconCheck = S('M9 11l3 3 7-7|M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9')
export const IconPin = S('M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z|M12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z')
export const IconUsers = S('M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20|M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M22 20v-1.5a4 4 0 0 0-3-3.87|M16 3.6a4 4 0 0 1 0 7.75')
export const IconLayers = S('M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5|M3 17.5l9 5 9-5')
export const IconBook = S('M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z|M4 17.5A2.5 2.5 0 0 1 6.5 15H20')
export const IconDoc = S('M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z|M14 2v5h5|M9 13h6|M9 17h6')
export const IconChart = S('M4 20V10|M10 20V4|M16 20v-6|M22 20H2')
export const IconMega = S('M3 10v4h3l5 4V6L6 10H3z|M16 8.5a4.5 4.5 0 0 1 0 7|M19 5.5a8 8 0 0 1 0 13')
export const IconWallet = S('M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2|M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5|M17 13h.01')
export const IconGear = S('M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.7-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 10a2 2 0 1 1 0 4 1.6 1.6 0 0 0-1.6 1z')
export const IconBell = S('M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0')
export const IconOut = S('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9')
export const IconHome = S('M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10')
export const IconMosque = S('M4 21v-8a8 8 0 0 1 16 0v8z|M12 5c0-1.5 1.5-2 1.5-3.2|M2 21h20|M8 21v-4a4 4 0 0 1 8 0v4')
export const IconPlus = S('M12 5v14|M5 12h14')
export const IconBack = S('M9 18l6-6-6-6')
export const IconClock = S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2')
export const IconTrophy = S('M8 21h8|M12 17v4|M7 4h10v5a5 5 0 0 1-10 0z|M17 5h3v2a3 3 0 0 1-3 3|M7 5H4v2a3 3 0 0 0 3 3')
export const IconPulse = S('M3 12h4l3-8 4 16 3-8h4')
export const IconScreen = S('M3 4h18v12H3z|M8 20h8|M12 16v4')
export const IconSearch = S('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-3.5-3.5')
export const IconStar = S('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z')
export const IconCrown = S('M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z')
export const IconMedal = S('M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z|M8.5 9.6L5 3h5l2 4|M15.5 9.6L19 3h-5l-1.3 2.6')
export const IconDownload = S('M12 4v11|M7 10l5 5 5-5|M4 20h16')
