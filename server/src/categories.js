// Broad shelves for browsing. Existing school subjects remain in `subject`
// so their original detail is not lost when an older database is upgraded.
export const BOOK_CATEGORIES = [
  'นิยายและวรรณกรรม',
  'การ์ตูนและมังงะ',
  'ความรู้และพัฒนาตนเอง',
  'การเรียนและสอบ',
  'ธุรกิจและการเงิน',
  'เด็กและเยาวชน',
  'อื่น ๆ',
]

export const LEGACY_STUDY_SUBJECTS = [
  'คณิตศาสตร์', 'ภาษาอังกฤษ', 'ชีววิทยา', 'เคมี', 'ฟิสิกส์', 'TGAT',
]

export function categoryOf(value) {
  if (BOOK_CATEGORIES.includes(value)) return value
  if (LEGACY_STUDY_SUBJECTS.includes(value)) return 'การเรียนและสอบ'
  return 'อื่น ๆ'
}

export function preferredCategories(interests = []) {
  return [...new Set(interests.map(categoryOf))]
}
