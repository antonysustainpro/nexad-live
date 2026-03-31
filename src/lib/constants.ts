// NexusAD Ai Design System Constants

export const DOMAINS = [
  { id: "financial", nameEn: "Financial", nameAr: "المالية", icon: "DollarSign" },
  { id: "legal", nameEn: "Legal", nameAr: "القانونية", icon: "Scale" },
  { id: "uae", nameEn: "UAE Government", nameAr: "حكومة الإمارات", icon: "Landmark" },
  { id: "health", nameEn: "Health", nameAr: "الصحة", icon: "Heart" },
  { id: "technical", nameEn: "Technical", nameAr: "التقنية", icon: "Code" },
  { id: "creative", nameEn: "Creative", nameAr: "الإبداع", icon: "Palette" },
  { id: "business", nameEn: "Business", nameAr: "الأعمال", icon: "Briefcase" },
  { id: "real-estate", nameEn: "Real Estate", nameAr: "العقارات", icon: "Building" },
] as const

export const EMOTIONS = {
  stressed: { color: "#E85D4A", label: "Stressed", labelAr: "متوتر" },
  excited: { color: "#F5A623", label: "Excited", labelAr: "متحمس" },
  confused: { color: "#8B7EC8", label: "Confused", labelAr: "محتار" },
  sad: { color: "#5B8DEF", label: "Sad", labelAr: "حزين" },
  angry: { color: "#D94141", label: "Angry", labelAr: "غاضب" },
  joyful: { color: "#4CAF50", label: "Joyful", labelAr: "سعيد" },
  neutral: { color: "#8E8E93", label: "Neutral", labelAr: "محايد" },
} as const

export const PERSONALITIES = [
  { id: "professional", labelEn: "Professional", labelAr: "مهني" },
  { id: "friendly", labelEn: "Friendly", labelAr: "ودود" },
  { id: "direct", labelEn: "Direct", labelAr: "مباشر" },
  { id: "adaptive", labelEn: "Adaptive", labelAr: "متكيف" },
] as const

export const SOVEREIGNTY_FACTORS = [
  { id: "encryption", label: "Encryption", maxScore: 100 },
  { id: "shards", label: "Shards", maxScore: 100 },
  { id: "local_processing", label: "Local Processing", maxScore: 100 },
  { id: "key_health", label: "Key Health", maxScore: 100 },
  { id: "access", label: "Access", maxScore: 100 },
] as const

export const SHARD_NODES = [
  { id: "uae-1", name: "UAE Node 1", nameAr: "عقدة الإمارات ١", position: { x: 50, y: 30 } },
  { id: "uae-2", name: "UAE Node 2", nameAr: "عقدة الإمارات ٢", position: { x: 20, y: 70 } },
  { id: "uae-3", name: "UAE Node 3", nameAr: "عقدة الإمارات ٣", position: { x: 80, y: 70 } },
] as const

export const NAV_ITEMS = [
  { path: "/", labelEn: "Dashboard", labelAr: "لوحة التحكم", icon: "Home" },
  { path: "/chat", labelEn: "Chat", labelAr: "المحادثة", icon: "MessageCircle" },
  { path: "/voice", labelEn: "Voice", labelAr: "الصوت", icon: "Mic" },
  { path: "/vault", labelEn: "Vault", labelAr: "الخزنة", icon: "Lock", isGold: true },
  { path: "/domains", labelEn: "Domains", labelAr: "المجالات", icon: "Compass" },
  { path: "/privacy", labelEn: "Privacy", labelAr: "الخصوصية", icon: "Shield" },
  { path: "/sovereignty", labelEn: "Sovereignty", labelAr: "السيادة", icon: "Crown" },
  { path: "/persona", labelEn: "Persona", labelAr: "الشخصية", icon: "User" },
  { path: "/settings", labelEn: "Settings", labelAr: "الإعدادات", icon: "Settings" },
] as const

export const MOBILE_TAB_ITEMS = [
  { path: "/", labelEn: "Dashboard", labelAr: "الرئيسية", icon: "Home" },
  { path: "/chat", labelEn: "Chat", labelAr: "المحادثة", icon: "MessageCircle" },
  { path: "/voice", labelEn: "Voice", labelAr: "الصوت", icon: "Mic" },
  { path: "/vault", labelEn: "Vault", labelAr: "الخزنة", icon: "Lock", isGold: true },
  { path: "/more", labelEn: "More", labelAr: "المزيد", icon: "MoreHorizontal" },
] as const

export const FILE_TYPES = {
  pdf: { icon: "FileText", color: "#E85D4A" },
  doc: { icon: "FileText", color: "#5B8DEF" },
  docx: { icon: "FileText", color: "#5B8DEF" },
  txt: { icon: "FileText", color: "#8E8E93" },
  jpg: { icon: "Image", color: "#4CAF50" },
  jpeg: { icon: "Image", color: "#4CAF50" },
  png: { icon: "Image", color: "#4CAF50" },
  default: { icon: "File", color: "#8E8E93" },
} as const

// 72 BPM = 833ms pulse cycle
export const SOVEREIGNTY_PULSE_MS = 833

export const GREETINGS = {
  morning: { en: "Good morning", ar: "صباح الخير" },
  afternoon: { en: "Good afternoon", ar: "مساء الخير" },
  evening: { en: "Good evening", ar: "مساء الخير" },
  ramadan: { en: "Ramadan Kareem", ar: "رمضان كريم" },
} as const
