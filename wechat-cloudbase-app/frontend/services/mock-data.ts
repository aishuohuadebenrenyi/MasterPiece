import type { Game, TodayItem } from '../types/domain'

export const games: Game[] = [
  {
    id: 'name-chain',
    title: '名字接龙变奏',
    desc: '低门槛开场，快速统一声音和注意力。',
    category: '热身',
    tags: ['热身', '破冰', '新手'],
    meta: ['6-12 人', '8 分钟', '低难度'],
    fit: ['新手友好', '开场', '中等能量'],
    verdict: '如果你现在需要一个低门槛起手游戏，它很合适。',
    avoid: '不适合大家已经很兴奋、需要马上进入叙事的阶段。',
    lead: '适合刚开场时快速让大家进入同一个声音和注意力节奏。',
    steps: ['围成一圈，每个人说出自己的名字并配一个动作。', '下一位重复前面内容，再加入自己的名字和动作。', '逐渐加快节奏，让大家进入共同注意力。'],
    tips: '示范动作要轻松、可模仿，先让大家敢做，再追求节奏。',
    variant: '变体：加入情绪、拍手节奏或不同声音状态。',
    issue: '翻车点：动作过复杂会拖慢节奏，第一轮保持简单。',
    relatedGameId: 'status-swap',
    stripeTone: 'orange',
    sortOrder: 10,
    saved: false,
    played: true,
    playedCount: 1
  },
  {
    id: 'status-swap',
    title: '一句话交换身份',
    desc: '用一句台词确认彼此身份，快速建立关系。',
    category: '关系',
    tags: ['关系', '叙事', '中等'],
    meta: ['2-6 人', '12 分钟', '关系练习'],
    fit: ['关系建立', '双人练习', '中等难度'],
    verdict: '如果你现在要练关系建立，它会比复杂叙事更轻、更容易起步。',
    avoid: '不适合完全没有热身的新手场，容易急着编背景。',
    lead: '当你想快一点进入人物关系、又不想把规则讲得太重的时候，它很合适。',
    steps: ['一人抛出带身份关系的台词。', '另一人接住关系，并在下一句继续确认。', '几轮后复盘：哪一句让关系变清楚了？'],
    tips: '提醒参与者不要解释背景，先把“我和你是什么关系”演清楚。',
    variant: '变体：限定每句话只能新增一个关系信息。',
    issue: '翻车点：信息一次给太多，关系反而会糊。',
    relatedGameId: 'space-walk',
    stripeTone: 'blue',
    sortOrder: 20,
    saved: true,
    played: false,
    playedCount: 0
  },
  {
    id: 'space-walk',
    title: '空间行走切换',
    desc: '现场有点散时，适合重新聚焦身体和节奏。',
    category: '专注',
    tags: ['专注', '热身', '身体'],
    meta: ['6-12 人', '10 分钟', '中等能量'],
    fit: ['身体到场', '注意力分散', '开场前'],
    verdict: '如果现场有点松散，它会比口头提醒更自然地让大家回到当下。',
    avoid: '不适合空间特别狭窄，或参与者已经明显疲惫的阶段。',
    lead: '如果你感觉大家的身体还没到场，它能比继续解释更快把人带回来。',
    steps: ['所有人在空间里自由行走，感受彼此距离。', '带领者给出速度、方向、状态切换口令。', '加入停顿、对视或成组，提高现场专注度。'],
    tips: '口令保持清晰，变化不要过多，让身体先跟上。',
    variant: '变体：加入情绪温度、重力、身体部位带路。',
    issue: '翻车点：口令过快会让大家只想做对，而不是感受现场。',
    relatedGameId: 'name-chain',
    stripeTone: 'mint',
    sortOrder: 30,
    saved: false,
    played: false,
    playedCount: 0
  }
]

export const todayInspirations: TodayItem[] = [
  {
    id: 'today-inspiration-1',
    type: '灵感',
    title: '一句话交换身份可以加限制词',
    desc: '每轮只允许推进一个关系信息，现场会更稳。'
  },
  {
    id: 'today-inspiration-2',
    type: '灵感',
    title: '开场不要解释太多',
    desc: '让大家先玩一轮，再补规则，理解会更快。'
  }
]

export const todayRehearsals: TodayItem[] = [
  {
    id: 'today-rehearsal',
    title: '开心即兴团 · 90 分钟',
    desc: '身体到场 → 关系建立 → 小复盘',
    status: '进行中'
  }
]

export const methodCards: TodayItem[] = [
  { id: 'method-1', type: '带领提醒', title: '开场不要解释太多', desc: '新手场先用身体和声音统一节奏，再进入关系和叙事，会明显更顺。' },
  { id: 'method-2', type: '游戏改造', title: '一句话交换身份只推进一个信息', desc: '每轮只确认一个关系点，现场会更稳，也更容易接住。' }
]
