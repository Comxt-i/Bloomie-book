export const BOOK_CATEGORIES = [
  'นิยายและวรรณกรรม',
  'การ์ตูนและมังงะ',
  'ความรู้และพัฒนาตนเอง',
  'การเรียนและสอบ',
  'ธุรกิจและการเงิน',
  'เด็กและเยาวชน',
  'อื่น ๆ',
]

export function bookCategory(book) {
  if (book.category) return book.category
  if (['คณิตศาสตร์', 'ภาษาอังกฤษ', 'ชีววิทยา', 'เคมี', 'ฟิสิกส์', 'TGAT'].includes(book.subject)) return 'การเรียนและสอบ'
  return BOOK_CATEGORIES.includes(book.subject) ? book.subject : 'อื่น ๆ'
}
