const pages = Array.from(document.querySelectorAll(".page"));
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const categoryChips = Array.from(document.querySelectorAll(".category-chip"));
const filterTriggers = Array.from(document.querySelectorAll("[data-open-filter='true']"));
const filterPanel = document.getElementById("filterPanel");
const filterBackdrop = document.getElementById("filterBackdrop");
const closeFilterButton = document.getElementById("closeFilterButton");
const addGameSheet = document.getElementById("addGameSheet");
const addGameBackdrop = document.getElementById("addGameBackdrop");
const openAddGameButton = document.getElementById("openAddGameButton");
const addGameForm = document.getElementById("addGameForm");
const closeAddButtons = Array.from(document.querySelectorAll("[data-close-add='true']"));
const voiceOpenButtons = Array.from(document.querySelectorAll("[data-open-voice]"));
const voiceCloseButtons = Array.from(document.querySelectorAll("[data-close-voice='true']"));
const voiceSheet = document.getElementById("voiceSheet");
const voiceBackdrop = document.getElementById("voiceBackdrop");
const randomGameTrigger = document.getElementById("randomGameTrigger");
const randomGameSheet = document.getElementById("randomGameSheet");
const randomBackdrop = document.getElementById("randomBackdrop");
const closeRandomButtons = Array.from(document.querySelectorAll("[data-close-random='true']"));
const randomGameCard = document.getElementById("randomGameCard");
const rerollRandomButton = document.getElementById("rerollRandomButton");
const openRandomDetailButton = document.getElementById("openRandomDetailButton");
const openSedimentButton = document.getElementById("openSedimentButton");
const sedimentSheet = document.getElementById("sedimentSheet");
const sedimentBackdrop = document.getElementById("sedimentBackdrop");
const closeSedimentButtons = Array.from(document.querySelectorAll("[data-close-sediment='true']"));
const searchTrigger = document.getElementById("searchTrigger");
const searchHint = document.getElementById("searchHint");
const backToDiscover = document.getElementById("backToDiscover");
const collapsibleHeaders = Array.from(document.querySelectorAll(".collapsible-header[data-collapse-target]"));
const gameList = document.getElementById("gameList");
const gameCardCarousel = document.getElementById("gameCardCarousel");
const discoverListView = document.getElementById("discoverListView");
const discoverCardView = document.getElementById("discoverCardView");
const viewSwitchButtons = Array.from(document.querySelectorAll(".view-switch-btn"));
const detailTitle = document.getElementById("detailTitle");
const detailLead = document.getElementById("detailLead");
const detailMeta = document.getElementById("detailMeta");
const detailVerdict = document.getElementById("detailVerdict");
const detailTips = document.getElementById("detailTips");
const detailIssue = document.getElementById("detailIssue");
const detailSteps = document.getElementById("detailSteps");
const relatedCard = document.getElementById("relatedCard");
const relatedTitle = document.getElementById("relatedTitle");
const relatedDescription = document.getElementById("relatedDescription");
const detailSaveButton = document.getElementById("detailSaveButton");
const detailPlayedButton = document.getElementById("detailPlayedButton");
const detailCollectButton = document.getElementById("detailCollectButton");
const voiceDescription = document.getElementById("voiceDescription");
const voicePulse = document.getElementById("voicePulse");
const voiceTimer = document.getElementById("voiceTimer");
const voiceSummary = document.getElementById("voiceSummary");
const startVoiceButton = document.getElementById("startVoiceButton");
const pauseVoiceButton = document.getElementById("pauseVoiceButton");
const finishVoiceButton = document.getElementById("finishVoiceButton");

let gameLibrary = [
  {
    id: "name-chain",
    title: "名字接龙变奏",
    description: "热身开场很好用，能快速统一节奏。",
    meta: ["6-12 人", "8 分钟", "热身"],
    lead: "适合刚开场时快速让大家进入同一个声音和注意力节奏。",
    verdict: "如果你现在需要一个低门槛起手游戏，它很合适。",
    steps: [
      "围成一圈，从一个人开始说出自己的名字并配一个动作。",
      "下一个人重复前一个人的内容，再加入自己的名字和动作。",
      "逐渐加快节奏，让队伍进入共同注意力与声音状态。",
    ],
    tips: "带领时先示范一个轻松、可模仿的动作，让大家快速松开。",
    issue: "如果动作和名字太复杂，节奏会掉下来，建议一开始保持简单、可重复。",
    related: ["status-swap", "space-walk"],
  },
  {
    id: "status-swap",
    title: "一句话交换身份",
    description: "关系练习起手很直接，也适合快速接球。",
    meta: ["2-6 人", "12 分钟", "关系"],
    lead: "当你想快一点进入人物关系、又不想把规则讲得太重的时候，它很合适。",
    verdict: "如果你现在要练关系建立，它会比复杂叙事更轻、更容易起步。",
    steps: [
      "由其中一人先抛出一句带身份关系的台词。",
      "另一人立即接住这层关系，并在下一句里继续确认。",
      "在几轮对话里让关系自然长出来，不急着解释完整背景。",
    ],
    tips: "提醒参与者不要急着讲故事，先把“我和你是什么关系”演清楚。",
    issue: "常见问题是信息一次给太多，关系反而模糊，建议每轮只推进一个关键信息。",
    related: ["name-chain", "space-walk"],
  },
  {
    id: "space-walk",
    title: "空间行走切换",
    description: "现场有点散时，适合重新聚焦身体和节奏。",
    meta: ["6-12 人", "10 分钟", "专注"],
    lead: "如果你感觉大家的身体还没到场，它能比继续解释更快把人带回来。",
    verdict: "如果现场有点松散，它会比口头提醒更自然地让大家重新回到当下。",
    steps: [
      "所有人在空间里自由行走，先感受彼此距离与方向。",
      "带领者给出节奏、速度或状态切换口令，让大家同步变化。",
      "在几轮切换之后加入停顿、对视或成组，逐渐提高专注度。",
    ],
    tips: "口令保持清晰，变化不要过多，让身体先跟上，再往上叠要求。",
    issue: "如果口令变化过快，参与者容易进入执行任务状态，而不是感受现场。",
    related: ["name-chain", "status-swap"],
  },
];

const searchHints = ["试试“破冰”", "试试“关系”", "试试“10 分钟内”", "试试“适合新手”"];
const savedGames = new Set(["status-swap"]);
const playedGames = new Set();
const stripClasses = ["", "alt", "soft"];

let currentPage = "page-discover";
let currentGameId = "name-chain";
let currentDiscoverView = "list";
let currentRandomGameId = "status-swap";
let recording = false;
let elapsedSeconds = 0;
let timerId = null;
let searchIndex = 0;

function findGameById(id) {
  return gameLibrary.find((game) => game.id === id) || gameLibrary[0];
}

function createSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .slice(0, 24);
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function renderMeta(container, values) {
  if (!container) return;
  container.innerHTML = "";
  values.forEach((value) => {
    const span = document.createElement("span");
    span.textContent = value;
    container.appendChild(span);
  });
}

function getStripClass(index) {
  return stripClasses[index % stripClasses.length];
}

function buildListCard(game, index) {
  const stripClass = getStripClass(index);
  const metaSummary = game.meta.slice(0, 2).map((item) => `<span>${item}</span>`).join("");

  return `
    <article class="card game-card game-entry" data-game-id="${game.id}">
      <div class="game-color-strip ${stripClass}"></div>
      <div class="game-info">
        <div class="game-title">${game.title}</div>
        <div class="game-meta">${metaSummary}</div>
        <div class="game-desc">${game.description}</div>
      </div>
      <button class="bookmark-icon" data-game-id="${game.id}" type="button" aria-label="收藏">☆</button>
    </article>
  `;
}

function buildCarouselCard(game, index) {
  const stripClass = getStripClass(index);
  const badge = game.meta[2] || "即兴练习";
  const metaSummary = game.meta.slice(0, 2).map((item) => `<span>${item}</span>`).join("");
  return `
    <article class="carousel-card game-entry" data-game-id="${game.id}">
      <div class="carousel-card-head">
        <div>
          <span class="carousel-badge">${badge}</span>
          <h3>${game.title}</h3>
        </div>
        <button class="bookmark-icon" data-game-id="${game.id}" type="button" aria-label="收藏">☆</button>
      </div>
      <div class="game-meta">${metaSummary}</div>
      <p>${game.description}</p>
      <div class="carousel-actions">
        <button class="mini-btn" data-open-detail="${game.id}" type="button">查看详情</button>
        <button class="mini-btn-ghost" data-open-voice="true" type="button">去记录</button>
      </div>
      <div class="game-color-strip ${stripClass}" aria-hidden="true" style="margin-top: 18px; width: 100%; height: 8px;"></div>
    </article>
  `;
}

function renderDiscoverViews() {
  if (gameList) {
    gameList.innerHTML = gameLibrary.map((game, index) => buildListCard(game, index)).join("");
  }

  if (gameCardCarousel) {
    gameCardCarousel.innerHTML = gameLibrary.map((game, index) => buildCarouselCard(game, index)).join("");
  }

  syncBookmarks();
}

function setDiscoverView(view) {
  currentDiscoverView = view;
  if (discoverListView) discoverListView.classList.toggle("active", view === "list");
  if (discoverCardView) discoverCardView.classList.toggle("active", view === "card");
  viewSwitchButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function syncBookmarks() {
  document.querySelectorAll(".bookmark-icon[data-game-id]").forEach((icon) => {
    const gameId = icon.dataset.gameId;
    const isSaved = savedGames.has(gameId);
    icon.classList.toggle("filled", isSaved);
    icon.textContent = isSaved ? "★" : "☆";
    icon.setAttribute("aria-label", isSaved ? "已收藏" : "收藏");
  });
}

function syncDetailActions() {
  const isSaved = savedGames.has(currentGameId);
  const isPlayed = playedGames.has(currentGameId);

  if (detailSaveButton) {
    detailSaveButton.classList.toggle("filled", isSaved);
    detailSaveButton.textContent = isSaved ? "★" : "☆";
    detailSaveButton.setAttribute("aria-label", isSaved ? "已收藏" : "收藏");
  }

  if (detailCollectButton) {
    detailCollectButton.innerHTML = `<span>${isSaved ? "★" : "☆"}</span>${isSaved ? "已收藏" : "收藏"}`;
  }

  if (detailPlayedButton) {
    detailPlayedButton.innerHTML = `<span>${isPlayed ? "✓" : "○"}</span>${isPlayed ? "已玩过" : "玩过"}`;
  }
}

function renderGameDetails(gameId) {
  const game = findGameById(gameId);
  const relatedGame = findGameById(game.related[0]);
  currentGameId = game.id;

  if (detailTitle) detailTitle.textContent = game.title;
  if (detailLead) detailLead.textContent = game.lead;
  if (detailVerdict) detailVerdict.textContent = game.verdict;
  if (detailTips) detailTips.textContent = game.tips;
  if (detailIssue) detailIssue.textContent = game.issue;
  renderMeta(detailMeta, game.meta);

  if (detailSteps) {
    detailSteps.innerHTML = "";
    game.steps.forEach((step, index) => {
      const item = document.createElement("article");
      item.className = "step-item";
      item.innerHTML = `
        <span class="step-index">${index + 1}</span>
        <p>${step}</p>
      `;
      detailSteps.appendChild(item);
    });
  }

  if (relatedCard) relatedCard.dataset.gameId = relatedGame.id;
  if (relatedTitle) relatedTitle.textContent = relatedGame.title;
  if (relatedDescription) relatedDescription.textContent = relatedGame.description;

  syncDetailActions();
  syncBookmarks();
}

function randomGame(exceptId) {
  const pool = gameLibrary.filter((game) => game.id !== exceptId);
  return pool[Math.floor(Math.random() * pool.length)] || gameLibrary[0];
}

function renderRandomGameCard(gameId) {
  const game = findGameById(gameId);
  currentRandomGameId = game.id;

  if (!randomGameCard) return;
  randomGameCard.innerHTML = `
    <div class="random-card-head">
      <div>
        <span class="carousel-badge">${game.meta[2] || "即兴练习"}</span>
        <h3>${game.title}</h3>
      </div>
      <button class="bookmark-icon" data-game-id="${game.id}" type="button" aria-label="收藏">☆</button>
    </div>
    <div class="game-meta">${game.meta.map((item) => `<span>${item}</span>`).join("")}</div>
    <p>${game.description}</p>
  `;
  syncBookmarks();
}

function closeFilter() {
  if (!filterPanel || !filterBackdrop) return;
  filterPanel.classList.remove("show");
  filterBackdrop.classList.remove("show");
  filterPanel.setAttribute("aria-hidden", "true");
}

function openFilter() {
  closeAllSheets();
  if (!filterPanel || !filterBackdrop) return;
  filterPanel.classList.add("show");
  filterBackdrop.classList.add("show");
  filterPanel.setAttribute("aria-hidden", "false");
}

function closeVoice() {
  if (!voiceSheet || !voiceBackdrop) return;
  voiceSheet.classList.remove("show");
  voiceBackdrop.classList.remove("show");
  voiceSheet.setAttribute("aria-hidden", "true");
}

function openVoice() {
  closeAllSheets();
  if (!voiceSheet || !voiceBackdrop) return;
  voiceSheet.classList.add("show");
  voiceBackdrop.classList.add("show");
  voiceSheet.setAttribute("aria-hidden", "false");
}

function closeAddGame() {
  if (!addGameSheet || !addGameBackdrop) return;
  addGameSheet.classList.remove("show");
  addGameBackdrop.classList.remove("show");
  addGameSheet.setAttribute("aria-hidden", "true");
}

function openAddGame() {
  closeAllSheets();
  if (!addGameSheet || !addGameBackdrop) return;
  addGameSheet.classList.add("show");
  addGameBackdrop.classList.add("show");
  addGameSheet.setAttribute("aria-hidden", "false");
}

function closeRandomGame() {
  if (!randomGameSheet || !randomBackdrop) return;
  randomGameSheet.classList.remove("show");
  randomBackdrop.classList.remove("show");
  randomGameSheet.setAttribute("aria-hidden", "true");
}

function closeSediment() {
  if (!sedimentSheet || !sedimentBackdrop) return;
  sedimentSheet.classList.remove("show");
  sedimentBackdrop.classList.remove("show");
  sedimentSheet.setAttribute("aria-hidden", "true");
}

function openRandomGame(preferredId) {
  closeAllSheets();
  const selected = preferredId ? findGameById(preferredId) : randomGame(currentGameId);
  renderRandomGameCard(selected.id);
  if (!randomGameSheet || !randomBackdrop) return;
  randomGameSheet.classList.add("show");
  randomBackdrop.classList.add("show");
  randomGameSheet.setAttribute("aria-hidden", "false");
}

function openSediment() {
  closeAllSheets();
  if (!sedimentSheet || !sedimentBackdrop) return;
  sedimentSheet.classList.add("show");
  sedimentBackdrop.classList.add("show");
  sedimentSheet.setAttribute("aria-hidden", "false");
}

function closeAllSheets() {
  closeFilter();
  closeVoice();
  closeAddGame();
  closeRandomGame();
  closeSediment();
}

function setActivePage(pageId) {
  currentPage = pageId;
  closeAllSheets();
  pages.forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });
  navItems.forEach((item) => {
    item.classList.toggle("active", pageId !== "page-detail" && item.dataset.page === pageId);
  });
}

function openGameDetail(gameId) {
  renderGameDetails(gameId);
  setActivePage("page-detail");
}

function toggleSaveGame(gameId) {
  if (savedGames.has(gameId)) {
    savedGames.delete(gameId);
  } else {
    savedGames.add(gameId);
  }
  syncBookmarks();
  syncDetailActions();
}

function stopVoiceTimer() {
  if (!timerId) return;
  window.clearInterval(timerId);
  timerId = null;
}

function updateVoiceSheet() {
  if (!voiceDescription || !voicePulse || !voiceTimer || !voiceSummary) return;

  voiceTimer.textContent = formatTime(elapsedSeconds);

  if (recording) {
    voiceDescription.textContent = "先说下来，整理可以稍后再做。";
    voicePulse.classList.add("recording");
    if (startVoiceButton) startVoiceButton.textContent = "录音中";
    voiceSummary.innerHTML = `
      <span class="mini-title">摘要预览</span>
      <p>正在收集这一段练习感觉，完成后会生成一张简短记录卡。</p>
    `;
    return;
  }

  voicePulse.classList.remove("recording");
  if (startVoiceButton) startVoiceButton.textContent = elapsedSeconds > 0 ? "继续录音" : "开始录音";

  if (elapsedSeconds > 0) {
    voiceDescription.textContent = "这条灵感已经先帮你留住了。";
    voiceSummary.innerHTML = `
      <span class="mini-title">摘要预览</span>
      <p>刚才的起手进入状态很快，后半段节奏开始松掉，下次可以加一句更明确的限制词。</p>
    `;
    return;
  }

  voiceDescription.textContent = "先把刚刚那一下留住。";
  voiceSummary.innerHTML = `
    <span class="mini-title">摘要预览</span>
    <p>完成录音后，这里会出现一张简短记录卡。</p>
  `;
}

function createGameFromForm(formData) {
  const title = formData.get("title")?.toString().trim() || "";
  const people = formData.get("people")?.toString().trim() || "";
  const duration = formData.get("duration")?.toString().trim() || "";
  const tag = formData.get("tag")?.toString().trim() || "";
  const description = formData.get("description")?.toString().trim() || "";
  const slugBase = createSlug(title) || `game-${Date.now()}`;
  const id = gameLibrary.some((game) => game.id === slugBase) ? `${slugBase}-${Date.now()}` : slugBase;
  const relatedIds = gameLibrary.slice(0, 2).map((game) => game.id);

  return {
    id,
    title,
    description,
    meta: [people, duration, tag],
    lead: `${description} 适合你想快速拉起场上状态的时候使用。`,
    verdict: `如果你现在正想试一个“${tag}”方向的新游戏，它值得先玩一轮。`,
    steps: [
      "先把核心规则用一句话讲清楚，让大家知道这一轮主要练什么。",
      "先试玩一轮短版，确认节奏和边界，再决定是否加难度。",
      "结束后快速复盘：哪一刻最有效，下次可以怎么继续发展。",
    ],
    tips: "第一次带这个游戏时，先保证规则短、动作小、节奏清晰，不要一开始叠太多要求。",
    issue: "如果参与者还不熟悉规则，容易把注意力放在“做对”而不是“接住现场”，建议先做一轮示范。",
    related: relatedIds.length ? relatedIds : [currentGameId],
  };
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const pageId = item.dataset.page;
    if (pageId) setActivePage(pageId);
  });
});

categoryChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    categoryChips.forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
  });
});

filterTriggers.forEach((trigger) => {
  trigger.addEventListener("click", openFilter);
});

if (closeFilterButton) {
  closeFilterButton.addEventListener("click", closeFilter);
}

if (filterBackdrop) {
  filterBackdrop.addEventListener("click", closeFilter);
}

if (openAddGameButton) {
  openAddGameButton.addEventListener("click", openAddGame);
}

if (addGameBackdrop) {
  addGameBackdrop.addEventListener("click", closeAddGame);
}

closeAddButtons.forEach((button) => {
  button.addEventListener("click", closeAddGame);
});

if (randomGameTrigger) {
  randomGameTrigger.addEventListener("click", () => {
    openRandomGame();
  });
}

if (randomBackdrop) {
  randomBackdrop.addEventListener("click", closeRandomGame);
}

closeRandomButtons.forEach((button) => {
  button.addEventListener("click", closeRandomGame);
});

if (rerollRandomButton) {
  rerollRandomButton.addEventListener("click", () => {
    const nextGame = randomGame(currentRandomGameId);
    renderRandomGameCard(nextGame.id);
  });
}

if (openRandomDetailButton) {
  openRandomDetailButton.addEventListener("click", () => {
    closeRandomGame();
    openGameDetail(currentRandomGameId);
  });
}

if (openSedimentButton) {
  openSedimentButton.addEventListener("click", openSediment);
}

if (sedimentBackdrop) {
  sedimentBackdrop.addEventListener("click", closeSediment);
}

closeSedimentButtons.forEach((button) => {
  button.addEventListener("click", closeSediment);
});

viewSwitchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view) setDiscoverView(view);
  });
});

if (gameList) {
  gameList.addEventListener("click", (event) => {
    const bookmark = event.target.closest(".bookmark-icon");
    if (bookmark) {
      event.stopPropagation();
      const gameId = bookmark.dataset.gameId;
      if (gameId) toggleSaveGame(gameId);
      return;
    }
    const entry = event.target.closest(".game-entry");
    const gameId = entry?.dataset.gameId;
    if (gameId) openGameDetail(gameId);
  });
}

if (gameCardCarousel) {
  gameCardCarousel.addEventListener("click", (event) => {
    const bookmark = event.target.closest(".bookmark-icon");
    if (bookmark) {
      event.stopPropagation();
      const gameId = bookmark.dataset.gameId;
      if (gameId) toggleSaveGame(gameId);
      return;
    }

    const detailTrigger = event.target.closest("[data-open-detail]");
    if (detailTrigger) {
      const gameId = detailTrigger.dataset.openDetail;
      if (gameId) openGameDetail(gameId);
      return;
    }

    const voiceTrigger = event.target.closest("[data-open-voice]");
    if (voiceTrigger) {
      openVoice();
      return;
    }

    const entry = event.target.closest(".game-entry");
    const gameId = entry?.dataset.gameId;
    if (gameId) openGameDetail(gameId);
  });
}

document.addEventListener("click", (event) => {
  const bookmark = event.target.closest(".random-card .bookmark-icon");
  if (!bookmark) return;
  const gameId = bookmark.dataset.gameId;
  if (gameId) toggleSaveGame(gameId);
});

document.querySelectorAll(".tag-group").forEach((group) => {
  group.addEventListener("click", (event) => {
    const tag = event.target.closest(".tag");
    if (!tag) return;
    group.querySelectorAll(".tag").forEach((item) => item.classList.remove("selected"));
    tag.classList.add("selected");
  });
});

voiceOpenButtons.forEach((button) => {
  button.addEventListener("click", openVoice);
});

voiceCloseButtons.forEach((button) => {
  button.addEventListener("click", closeVoice);
});

if (voiceBackdrop) {
  voiceBackdrop.addEventListener("click", closeVoice);
}

if (backToDiscover) {
  backToDiscover.addEventListener("click", () => {
    setActivePage("page-discover");
  });
}

collapsibleHeaders.forEach((header) => {
  header.addEventListener("click", () => {
    const targetId = header.dataset.collapseTarget;
    if (!targetId) return;
    const content = document.getElementById(targetId);
    if (!content) return;
    const isOpen = content.classList.toggle("open");
    header.classList.toggle("is-open", isOpen);
    header.setAttribute("aria-expanded", String(isOpen));
  });
});

if (relatedCard) {
  relatedCard.addEventListener("click", () => {
    const gameId = relatedCard.dataset.gameId;
    if (gameId) openGameDetail(gameId);
  });
}

if (detailSaveButton) {
  detailSaveButton.addEventListener("click", () => {
    toggleSaveGame(currentGameId);
  });
}

if (detailCollectButton) {
  detailCollectButton.addEventListener("click", () => {
    toggleSaveGame(currentGameId);
  });
}

if (detailPlayedButton) {
  detailPlayedButton.addEventListener("click", () => {
    if (playedGames.has(currentGameId)) {
      playedGames.delete(currentGameId);
    } else {
      playedGames.add(currentGameId);
    }
    syncDetailActions();
  });
}

if (searchTrigger) {
  searchTrigger.addEventListener("click", () => {
    searchTrigger.classList.add("is-focused");
    searchIndex = (searchIndex + 1) % searchHints.length;
    if (searchHint) searchHint.textContent = searchHints[searchIndex];
    window.setTimeout(() => {
      searchTrigger.classList.remove("is-focused");
    }, 1000);
  });
}

if (addGameForm) {
  addGameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(addGameForm);
    const title = formData.get("title")?.toString().trim();
    const people = formData.get("people")?.toString().trim();
    const duration = formData.get("duration")?.toString().trim();
    const tag = formData.get("tag")?.toString().trim();
    const description = formData.get("description")?.toString().trim();

    if (!title || !people || !duration || !tag || !description) return;

    const newGame = createGameFromForm(formData);
    gameLibrary = [newGame, ...gameLibrary].map((game, index, list) => ({
      ...game,
      related: game.related?.length ? game.related.filter((id) => id !== game.id) : list.filter((item) => item.id !== game.id).slice(0, 2).map((item) => item.id),
    }));

    renderDiscoverViews();
    renderGameDetails(currentGameId);
    addGameForm.reset();
    closeAddGame();
    setDiscoverView("list");
  });
}

if (startVoiceButton) {
  startVoiceButton.addEventListener("click", () => {
    if (recording) return;
    recording = true;
    stopVoiceTimer();
    timerId = window.setInterval(() => {
      elapsedSeconds += 1;
      updateVoiceSheet();
    }, 1000);
    updateVoiceSheet();
  });
}

if (pauseVoiceButton) {
  pauseVoiceButton.addEventListener("click", () => {
    recording = false;
    stopVoiceTimer();
    updateVoiceSheet();
  });
}

if (finishVoiceButton) {
  finishVoiceButton.addEventListener("click", () => {
    recording = false;
    stopVoiceTimer();
    if (elapsedSeconds === 0) {
      elapsedSeconds = 36;
    }
    updateVoiceSheet();
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllSheets();
  }
});

renderDiscoverViews();
renderGameDetails(currentGameId);
renderRandomGameCard(currentRandomGameId);
setDiscoverView("list");
updateVoiceSheet();
setActivePage("page-discover");
