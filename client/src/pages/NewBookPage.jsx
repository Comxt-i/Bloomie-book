import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { BOOK_CATEGORIES } from '../categories'

const emptyForm = { title: '', category: '', condition: 'ดีมาก', description: '' }
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxImageBytes = 2 * 1024 * 1024

export default function NewBookPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const [form, setForm] = useState(emptyForm)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [invalidImage, setInvalidImage] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [savedBookId, setSavedBookId] = useState(null)
  const [loading, setLoading] = useState(editing)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    api('/books/mine').then(({ books }) => {
      if (!active) return
      const book = books.find((item) => item.id === id)
      if (!book) { setLoadError('ไม่พบหนังสือของคุณ'); return }
      if (book.status !== 'AVAILABLE') { setLoadError('หนังสืออยู่ระหว่างแลกอ่าน จึงยังแก้ไขไม่ได้'); return }
      setForm({ title: book.title, category: book.category, condition: book.condition, description: book.description || '' })
      setImageUrl(book.imageUrl || '')
    }).catch((err) => { if (active) setLoadError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function chooseImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!allowedImageTypes.includes(file.type) || file.size > maxImageBytes) {
      setError('กรุณาเลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB')
      setInvalidImage(true)
      setImageFile(null)
      setPreviewUrl('')
      setRemoveImage(false)
      event.target.value = ''
      return
    }
    setError('')
    setInvalidImage(false)
    setRemoveImage(false)
    setImageFile(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (invalidImage) { setError('กรุณาเลือกรูปใหม่หรือกดข้ามรูปปกก่อนบันทึก'); return }
    setSubmitting(true)
    setError('')
    let bookId = id || savedBookId
    let metadataSaved = false
    try {
      if (!bookId) {
        const { book } = await api('/books', { method: 'POST', body: JSON.stringify(form) })
        bookId = book.id
        setSavedBookId(book.id)
      } else {
        await api(`/books/${bookId}`, { method: 'PATCH', body: JSON.stringify(form) })
      }
      metadataSaved = true
      if (imageFile) {
        await api(`/books/${bookId}/image`, { method: 'PUT', headers: { 'content-type': imageFile.type }, body: imageFile })
      } else if (removeImage) {
        await api(`/books/${bookId}/image`, { method: 'DELETE' })
      }
      navigate('/books/mine', { replace: true })
    } catch (err) {
      setError(metadataSaved ? `บันทึกข้อมูลหนังสือแล้ว แต่รูปปกยังไม่สำเร็จ: ${err.message} กดบันทึกอีกครั้งได้` : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page-container"><div className="empty-state" role="status">กำลังโหลดหนังสือ...</div></div>
  if (loadError) return <div className="page-container"><div className="alert alert-error" role="alert">{loadError}</div><Link className="back-link" to="/books/mine">← กลับไปหนังสือของฉัน</Link></div>

  const visibleImage = previewUrl || (!removeImage && imageUrl)
  return (
    <section className="page-container narrow">
      <Link className="back-link" to={editing || savedBookId ? '/books/mine' : '/books'}>← {editing || savedBookId ? 'กลับไปหนังสือของฉัน' : 'กลับไปค้นหาหนังสือ'}</Link>
      <div className="page-heading"><div><span className="eyebrow">เล่มที่พร้อมให้เพื่อนยืมอ่าน</span><h1>{editing ? 'แก้ไขหนังสือ' : 'ลงหนังสือใหม่'}</h1><p>ข้อมูลที่ชัดเจนช่วยให้คนที่เหมาะเจอหนังสือของคุณเร็วขึ้น</p></div></div>
      <form className="form-card book-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <label>ชื่อหนังสือ<input placeholder="เช่น นิยายเล่มโปรด หรือหนังสือจัดการเวลา" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} /></label>
        <label>หมวดหนังสือ<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required><option value="">เลือกหมวดหนังสือ</option>{BOOK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label>สภาพหนังสือ<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option>เหมือนใหม่</option><option>ดีมาก</option><option>ดี</option><option>มีรอยเขียน</option></select></label>
        <label>รายละเอียด<textarea rows="4" maxLength={2000} placeholder="บอกเกี่ยวกับรอยเขียน หน้าที่ขาด หรือจุดเด่นของหนังสือ" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>รูปปก <small>ไม่บังคับ · เลือก JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB</small><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /></label>
        {visibleImage && <img className="book-image-preview" src={visibleImage} alt="ตัวอย่างรูปปก" />}
        {imageFile && <button type="button" className="text-button" onClick={() => { setImageFile(null); setPreviewUrl(''); if (fileInput.current) fileInput.current.value = '' }}>ยกเลิกรูปที่เลือก</button>}
        {invalidImage && <button type="button" className="text-button" onClick={() => { setInvalidImage(false); setError('') }}>ข้ามรูปปก</button>}
        {editing && imageUrl && !removeImage && !imageFile && <button type="button" className="text-button" onClick={() => { setRemoveImage(true); setPreviewUrl('') }}>ลบรูปปกปัจจุบัน</button>}
        {editing && imageUrl && removeImage && !imageFile && <button type="button" className="text-button" onClick={() => setRemoveImage(false)}>ยกเลิกการลบรูปปก</button>}
        <button className="button button-full" disabled={submitting}>{submitting ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'ลงหนังสือสำหรับแลกอ่าน'}</button>
      </form>
    </section>
  )
}
