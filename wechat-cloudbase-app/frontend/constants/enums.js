const MATERIAL_STATUS = ['未开始', '进行中', '已完成']

const STATUS_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '练过', value: 'played' },
  { label: '未练过', value: 'unplayed' },
  { label: '收藏', value: 'saved' }
]

const VOICE_TARGETS = [
  { label: '记录到：灵感', value: 'inspiration' },
  { label: '当前练习', value: 'practice_feedback' },
  { label: '当前排练', value: 'rehearsal' }
]

module.exports = {
  MATERIAL_STATUS,
  STATUS_FILTERS,
  VOICE_TARGETS
}
