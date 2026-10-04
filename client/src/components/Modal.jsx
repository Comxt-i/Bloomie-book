import { useEffect, useRef } from 'react'

export default function Modal({ titleId, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current.querySelector('button, input, select, textarea, a[href]')?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  function handleKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key !== 'Tab') return
    const focusable = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
    const first = focusable[0], last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKey}>
      <button className="modal-close" aria-label="ปิดหน้าต่าง" onClick={onClose}>×</button>{children}
    </section>
  </div>
}
