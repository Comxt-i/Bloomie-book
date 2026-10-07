export default function MapPin({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 22s8-6.5 8-12a8 8 0 1 0-16 0c0 5.5 8 12 8 12Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
}
