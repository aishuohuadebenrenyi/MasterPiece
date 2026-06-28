function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function truncateText(value, maxLength) {
  const text = compactText(value)
  if (!text) return ''
  if (!maxLength || text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function formatDateLabel(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function buildMetaPills(meta = [], limit = 3) {
  return (Array.isArray(meta) ? meta : [])
    .map((item) => compactText(item))
    .filter(Boolean)
    .slice(0, limit)
}

function pickFirstText(values = []) {
  for (const value of values) {
    const text = compactText(value)
    if (text) return text
  }
  return ''
}

function createCardViewModel({
  layoutKind = 'summary',
  eyebrow = '',
  title = '',
  bodyText = '',
  metaPills = [],
  pending = false,
  badgeText = '',
  badgeTone = 'blue',
  primaryActionText = '',
  secondaryActionText = ''
} = {}) {
  return {
    layoutKind,
    eyebrow: compactText(eyebrow),
    title: truncateText(title, layoutKind === 'history' ? 32 : 28),
    bodyText: truncateText(bodyText, layoutKind === 'history' ? 54 : 42),
    metaPills: buildMetaPills(metaPills, layoutKind === 'history' ? 3 : 2),
    pending: !!pending,
    badgeText: compactText(badgeText),
    badgeTone: badgeTone || 'blue',
    primaryActionText: compactText(primaryActionText),
    secondaryActionText: compactText(secondaryActionText)
  }
}

function buildPracticeRecordCardViewModel(record = {}) {
  const summaryText = pickFirstText([
    record.note ? `复盘：${record.note}` : '',
    record.reminder ? `提醒：${record.reminder}` : '',
    record.desc
  ]) || '无反馈内容'
  const meta = []
  if (record.score) {
    meta.push(`${record.score} 分`)
  }
  if (record.duration > 0) {
    meta.push(`${Math.floor(record.duration / 60)} 分钟`)
  }
  if (Array.isArray(record.attachments) && record.attachments.length) {
    meta.push(`${record.attachments.length} 个附件`)
  }
  meta.push(...buildMetaPills(record.meta, 2))
  return createCardViewModel({
    layoutKind: 'history',
    eyebrow: record.dateLabel || formatDateLabel(record.createdAt),
    title: record.title || '未命名练习记录',
    bodyText: summaryText,
    metaPills: meta,
    pending: false,
    primaryActionText: '查看',
    secondaryActionText: '删除'
  })
}

function buildRehearsalRecordCardViewModel(record = {}) {
  return createCardViewModel({
    layoutKind: 'history',
    eyebrow: record.dateLabel || formatDateLabel(record.createdAt),
    title: record.displayTitle || record.title || '团队排练',
    bodyText: record.displayDesc || record.desc || '按时间回看团队练习、素材反馈和下次提醒。',
    metaPills: record.displayMeta || [],
    pending: false,
    primaryActionText: '查看',
    secondaryActionText: '删除'
  })
}

function buildSummaryRecordCardViewModel(item = {}) {
  return createCardViewModel({
    layoutKind: 'summary',
    title: item.title || '未命名记录',
    bodyText: item.desc || '暂无内容',
    metaPills: item.filteredMeta || item.meta || [],
    pending: false,
    badgeText: item.type || '',
    badgeTone: item.badgeTone || 'blue'
  })
}

module.exports = {
  createCardViewModel,
  buildPracticeRecordCardViewModel,
  buildRehearsalRecordCardViewModel,
  buildSummaryRecordCardViewModel,
  formatDateLabel
}
