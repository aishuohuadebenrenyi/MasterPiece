#!/usr/bin/env node
/**
 * 从 improvgo.netlify.app 提取素材数据
 * 生成 improv_materials 格式的 JSON Lines 文件
 *
 * 用法: node tools/extract-improvgo.js
 * 前置: 需要先下载 games.js 和 index.html 到 /tmp/improvgo/
 */

const fs = require('fs');
const path = require('path');

// ===== HTML 解析工具 =====

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<\/li>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function extractSection(html, sectionTitle) {
  const regex = new RegExp(`<h2>${sectionTitle}</h2>([\\s\\S]*?)(?=<h2|$)`, 'i');
  const match = html.match(regex);
  return match ? match[1] : '';
}

function extractListItems(html) {
  const items = [];
  const liRegex = /<li>([\s\S]*?)<\/li>/g;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text) items.push(text);
  }
  return items;
}

function extractParagraphs(html) {
  const paragraphs = [];
  const pRegex = /<p>([\s\S]*?)<\/p>/g;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

function truncate(text, maxLen = 120) {
  if (!text) return '';
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

function extractIssue(content) {
  const allText = stripHtml(content);
  const sentences = allText.split(/[。！？]/);
  for (const s of sentences) {
    if (/不要|避免|注意|如果.*容易|容易.*如果|问题|陷阱|错误|切忌|否则|导致|反而/.test(s) && s.length > 5 && s.length < 60) {
      return s.trim() + '。';
    }
  }
  return '';
}

// ===== ID 生成 =====

const usedIds = new Set();

function generateId(title, fallback) {
  // 尝试从标题提取英文部分
  const englishMatch = title.match(/([A-Za-z][A-Za-z\s'-]+)/);
  let id;
  if (englishMatch) {
    id = englishMatch[1]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  } else {
    id = fallback || 'item';
  }

  // 处理重复 ID
  if (usedIds.has(id)) {
    let suffix = 2;
    while (usedIds.has(`${id}-${suffix}`)) suffix++;
    id = `${id}-${suffix}`;
  }
  usedIds.add(id);
  return id;
}

// ===== 解析 games.js =====

function parseGames(source) {
  // 使用 new Function 安全地评估 JS
  const fn = new Function(source + '; return { games: games, gameOrder: gameOrder };');
  return fn();
}

// ===== 解析 HTML 中的 articles =====

function parseArticles(html) {
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const scriptContent = scriptMatch[1];
    if (!scriptContent.includes('const articles')) continue;

    // 用花括号计数提取 articles 对象
    const startIdx = scriptContent.indexOf('const articles = {');
    if (startIdx === -1) continue;

    let braceCount = 0;
    let inTemplate = false;
    let i = startIdx + 'const articles = '.length;

    while (i < scriptContent.length) {
      const char = scriptContent[i];
      const prevChar = i > 0 ? scriptContent[i - 1] : '';

      if (char === '`' && prevChar !== '\\') {
        inTemplate = !inTemplate;
      }

      if (!inTemplate) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            const articlesCode = scriptContent.substring(startIdx, i + 1);
            try {
              const fn = new Function(articlesCode + '; return articles;');
              return fn();
            } catch (e) {
              console.error('解析 articles 失败:', e.message);
              return null;
            }
          }
        }
      }
      i++;
    }
  }
  return null;
}

// ===== 提取模块顺序 =====

function parseModuleOrder(html) {
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const scriptContent = scriptMatch[1];
    const moduleOrderMatch = scriptContent.match(/module0:\s*\[([^\]]*)\]/);
    if (moduleOrderMatch) {
      // 找到 moduleOrder 对象
      const orderMatch = scriptContent.match(/(?:const|var)\s+\w+\s*=\s*\{[\s\S]*?module0:\s*\[([^\]]*)\][\s\S]*?\};/);
      if (orderMatch) {
        try {
          const code = '(function(){' + scriptContent.match(/(?:const|var)\s+\w+\s*=\s*\{[\s\S]*?module0:[\s\S]*?\};/)[0] + '; return this;})()';
          // 简单提取各模块数组
          const result = {};
          const modules = ['module0', 'module1', 'module2', 'module4'];
          for (const mod of modules) {
            const modMatch = scriptContent.match(new RegExp(`${mod}:\\s*\\[([^\\]]*)\\]`));
            if (modMatch) {
              result[mod] = modMatch[1].match(/'[^']+'/g)?.map(s => s.replace(/'/g, '')) || [];
            }
          }
          return result;
        } catch (e) {
          console.error('解析 moduleOrder 失败:', e.message);
        }
      }
    }
  }
  return null;
}

// ===== 映射: 游戏 → 素材 =====

const scenesMap = {
  warmup: ['备课', '排练'],
  training: ['排练'],
  both: ['排练', '演出'],
  performance: ['演出']
};

const stripeMap = {
  '热身破冰': 'orange',
  'Yes And 与接纳': 'blue',
  '角色塑造': 'blue',
  '场景与叙事': 'mint',
  '地位与情绪': 'orange',
  '语言与文字': 'blue',
  '竞技与表演': 'mint',
  '长即兴格式': 'orange'
};

function gameToMaterial(game, sortOrder) {
  const titleParts = game.title.split('——');
  const title = titleParts[0].trim();
  const desc = titleParts[1] ? titleParts[1].trim() : '';

  // 提取游戏规则步骤 - 尝试多个可能的章节名
  let steps = extractListItems(extractSection(game.content, '游戏规则'));
  if (steps.length === 0) {
    // 长即兴格式类游戏使用不同章节名
    for (const section of ['演出结构', '格式概述', '核心规则', '基本规则']) {
      steps = extractListItems(extractSection(game.content, section));
      if (steps.length > 0) break;
    }
  }
  // 限制每条长度
  steps = steps.map(s => truncate(s, 80));

  // 提取进阶变体
  const variantSection = extractSection(game.content, '进阶变体');
  const variantItems = extractListItems(variantSection);
  const variant = variantItems.length > 0
    ? variantItems.map(item => item.replace(/^[^：:]*[：:]/, '').trim()).join('；')
    : '';

  // 提取教学提示 - 尝试多个可能的章节名
  let tipsText = extractParagraphs(extractSection(game.content, '教学提示')).join(' ');
  if (!tipsText) {
    for (const section of ['排练提示', '演出提示', '关键原则', '格式概述', '核心要点']) {
      tipsText = extractParagraphs(extractSection(game.content, section)).join(' ');
      if (tipsText) break;
    }
  }
  // 如果仍然没有 tips，从第一段 <p> 提取
  if (!tipsText) {
    const allParagraphs = extractParagraphs(game.content);
    tipsText = allParagraphs.slice(0, 2).join(' ');
  }
  const tips = truncate(tipsText, 100);

  // 提取常见问题
  const issue = extractIssue(game.content);

  return {
    id: generateId(game.title, game.subtopic),
    title,
    desc,
    type: '游戏',
    tags: [game.subtopic, game.level].filter(Boolean),
    abilities: game.skills || [],
    scenes: scenesMap[game.usage] || ['排练'],
    meta: [game.players?.label, game.readTime].filter(Boolean),
    steps,
    tips,
    variant: truncate(variant, 100),
    issue,
    relatedMaterialId: '',
    referenceOnly: false,
    stripeTone: stripeMap[game.subtopic] || 'mint',
    sortOrder,
    ownerOpenId: 'system',
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    deletedAt: null
  };
}

// ===== 映射: 文章 → 素材 =====

function articleToMaterial(article, sortOrder, typeOverride) {
  const titleParts = article.title.split('——');
  const title = titleParts[0].trim();
  let desc = titleParts[1] ? titleParts[1].trim() : '';

  // 如果没有 desc，从第一段 <p> 提取
  if (!desc) {
    const firstP = extractParagraphs(article.content)[0];
    if (firstP) desc = truncate(firstP, 60);
  }

  // 提取步骤 - 优先 <ol>，没有则用 <h2> 标题
  const steps = [];
  const olRegex = /<ol>([\s\S]*?)<\/ol>/g;
  let olMatch;
  while ((olMatch = olRegex.exec(article.content)) !== null) {
    const items = extractListItems(olMatch[1]);
    steps.push(...items.map(s => truncate(s, 80)));
  }
  // 如果没有 <ol>，提取 <h2> 标题作为步骤
  if (steps.length === 0) {
    const h2Regex = /<h2>([\s\S]*?)<\/h2>/g;
    let h2Match;
    while ((h2Match = h2Regex.exec(article.content)) !== null) {
      const heading = stripHtml(h2Match[1]);
      if (heading && !heading.includes('推荐') && !heading.includes('参考')) {
        steps.push(heading);
      }
    }
  }

  // 提取变体
  const variantItems = [];
  const ulRegex = /<ul>([\s\S]*?)<\/ul>/g;
  let ulMatch;
  while ((ulMatch = ulRegex.exec(article.content)) !== null) {
    variantItems.push(...extractListItems(ulMatch[1]));
  }
  const variant = truncate(variantItems.slice(0, 3).join('；'), 100);

  // 提取 tips
  const paragraphs = extractParagraphs(article.content);
  const tipsText = paragraphs.slice(0, 2).join(' ');
  const tips = truncate(tipsText, 120);

  // 提取 issue
  const issue = extractIssue(article.content);

  const type = typeOverride || '技巧';

  return {
    id: generateId(article.title, article.module + '-' + article.subtopic),
    title,
    desc,
    type,
    tags: [article.subtopic, article.level].filter(Boolean),
    abilities: [],
    scenes: type === '路径' ? ['备课'] : ['备课', '排练'],
    meta: [article.readTime].filter(Boolean),
    steps,
    tips,
    variant,
    issue,
    relatedMaterialId: '',
    referenceOnly: type === '路径',
    stripeTone: type === '路径' ? 'mint' : (type === '主理' ? 'blue' : 'orange'),
    sortOrder,
    ownerOpenId: 'system',
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    deletedAt: null
  };
}

// ===== 模块二子主题 → type 映射 =====

function getModule1Type(subtopic) {
  if (subtopic.includes('角色')) return '角色';
  if (subtopic.includes('高阶') || subtopic.includes('长即兴') || subtopic.includes('音乐') || subtopic.includes('类型') || subtopic.includes('竞技') || subtopic.includes('双人') || subtopic.includes('团体')) return '格式';
  return '技巧';
}

// ===== 模块五子主题 → type 映射 =====

function getModule4Type(subtopic) {
  if (subtopic.includes('演出') || subtopic.includes('提示词') || subtopic.includes('主持')) return '主理';
  if (subtopic.includes('复盘')) return '复盘';
  if (subtopic.includes('共学') || subtopic.includes('资源') || subtopic.includes('行动')) return '路径';
  return '技巧';
}

// ===== 主流程 =====

const RELEASE_SUPPORT_ROOT = path.resolve(__dirname, '../../..');
const MOCK_DATA_DIR = path.join(RELEASE_SUPPORT_ROOT, 'mock-data');
const gamesSource = fs.readFileSync('/tmp/improvgo/games.js', 'utf8');
const html = fs.readFileSync('/tmp/improvgo/index.html', 'utf8');

// 解析数据
const { games, gameOrder } = parseGames(gamesSource);
console.log(`解析到 ${Object.keys(games).length} 个游戏`);

const articles = parseArticles(html);
console.log(`解析到 ${articles ? Object.keys(articles).length : 0} 篇文章`);

const moduleOrder = parseModuleOrder(html);
console.log('模块顺序:', moduleOrder ? Object.keys(moduleOrder).map(k => `${k}: ${moduleOrder[k].length}篇`).join(', ') : '未找到');

// ===== 生成游戏素材 =====

const gameMaterials = [];
const validGameIds = gameOrder.filter(id => games[id]);
validGameIds.forEach((id, idx) => {
  const game = games[id];
  const material = gameToMaterial(game, 200 + idx * 2);
  gameMaterials.push(material);
});

const gamesJson = gameMaterials.map(m => JSON.stringify(m)).join('\n');
const gamesPath = path.join(MOCK_DATA_DIR, 'improv_materials_games.json');
fs.writeFileSync(gamesPath, gamesJson + '\n', 'utf8');
console.log(`\n生成 ${gameMaterials.length} 个游戏素材 → ${gamesPath}`);

// ===== 生成文章素材 =====

const articleMaterials = [];

if (articles) {
  // 模块顺序 (手动定义, 以防 moduleOrder 解析失败)
  const m0Order = moduleOrder?.module0 || ['m0-1', 'm0-2', 'm0-3', 'm0-4', 'm0-5', 'm0-6', 'm0-7'];
  const m1Order = moduleOrder?.module1 || Array.from({ length: 19 }, (_, i) => `m1-${i + 1}`);
  const m2Order = moduleOrder?.module2 || Array.from({ length: 12 }, (_, i) => `m2-${i + 1}`);
  const m4Order = moduleOrder?.module4 || ['m4-1', 'm4-2', 'm4-3', 'm4-5', 'm4-6', 'm4-13', 'm4-7', 'm4-8', 'm4-9', 'm4-10', 'm4-14', 'm4-11', 'm4-12'];

  // 模块一: 认识即兴 (7篇 → 技巧)
  m0Order.forEach((id, idx) => {
    if (!articles[id]) return;
    articleMaterials.push(articleToMaterial(articles[id], 500 + idx * 2, '技巧'));
  });

  // 模块二: 即兴戏剧要学什么 (19篇 → 按子主题映射)
  m1Order.forEach((id, idx) => {
    if (!articles[id]) return;
    const type = getModule1Type(articles[id].subtopic || '');
    articleMaterials.push(articleToMaterial(articles[id], 520 + idx * 2, type));
  });

  // 模块三: 如何系统学习 (12篇 → 3条路径素材, 按阶段合并)
  const m2Articles = m2Order.filter(id => articles[id]).map(id => articles[id]);
  const stages = {};
  m2Articles.forEach(a => {
    const stage = a.subtopic || '未分类';
    if (!stages[stage]) stages[stage] = [];
    stages[stage].push(a);
  });

  let stageIdx = 0;
  for (const [stageName, stageArticles] of Object.entries(stages)) {
    const stageId = stageName.includes('入门') ? 'beginner'
      : stageName.includes('进阶') ? 'intermediate'
      : stageName.includes('高阶') ? 'advanced'
      : `stage-${stageIdx}`;
    const material = {
      id: generateId(stageName + '学习路径', stageId + '-learning-path'),
      title: `${stageName}学习路径`,
      desc: stageArticles.map(a => a.title.split('——')[0].trim()).join('、'),
      type: '路径',
      tags: ['学习路径', stageName, '参考'],
      abilities: ['自发性', '团队协作'],
      scenes: ['备课'],
      meta: ['参考', '路径', `${stageArticles.length} 篇`],
      steps: stageArticles.map(a => a.title.split('——')[0].trim()),
      tips: stageName.includes('入门') ? '先建立安全感再追求技巧，新手阶段允许笨拙。'
        : stageName.includes('进阶') ? '从"做对"转向"做活"，关注场景层次和角色真实感。'
        : '重在整合与个人化，把技巧内化成自己的表达方式。',
      variant: '',
      issue: stageName.includes('入门') ? '跳过破冰直接练技巧，信任不足会放不开。'
        : stageName.includes('进阶') ? '只堆砌技巧不回到关系和聆听，场景会变空。'
        : '追求复杂格式忽略当下连接，演出失去生命力。',
      relatedMaterialId: 'actor-training-map',
      referenceOnly: true,
      stripeTone: stageName.includes('入门') ? 'orange' : stageName.includes('进阶') ? 'blue' : 'mint',
      sortOrder: 560 + stageIdx * 2,
      ownerOpenId: 'system',
      createdAt: '2026-06-18T00:00:00.000Z',
      updatedAt: '2026-06-18T00:00:00.000Z',
      deletedAt: null
    };
    articleMaterials.push(material);
    stageIdx++;
  }

  // 模块五: 资源与演出 (13篇 → 按子主题映射)
  m4Order.forEach((id, idx) => {
    if (!articles[id]) return;
    const type = getModule4Type(articles[id].subtopic || '');
    articleMaterials.push(articleToMaterial(articles[id], 580 + idx * 2, type));
  });
}

const articlesJson = articleMaterials.map(m => JSON.stringify(m)).join('\n');
const articlesPath = path.join(MOCK_DATA_DIR, 'improv_materials_articles.json');
fs.writeFileSync(articlesPath, articlesJson + '\n', 'utf8');
console.log(`生成 ${articleMaterials.length} 个文章素材 → ${articlesPath}`);

// ===== 统计 =====

console.log('\n===== 统计 =====');
const typeCount = {};
[...gameMaterials, ...articleMaterials].forEach(m => {
  typeCount[m.type] = (typeCount[m.type] || 0) + 1;
});
console.log('类型分布:', typeCount);
console.log(`总计: ${gameMaterials.length + articleMaterials.length} 条素材`);
