// 素材浏览器 JavaScript
(function() {
    // 全局变量
    let allMaterials = [];
    let filteredMaterials = [];
    let currentPage = 0;
    const pageSize = 10;
    let activeTypeFilter = null;
    let activeDifficultyFilter = null;
    
    // 加载素材数据
    async function loadMaterials() {
        try {
            const response = await fetch('assets/materials.json');
            const data = await response.json();
            allMaterials = data.materials;
            filteredMaterials = allMaterials;
            
            // 初始化页面
            initSummary(data.summary);
            initFilters(data.summary);
            renderMaterials();
            
        } catch (error) {
            console.error('加载素材数据失败:', error);
            showError('加载素材数据失败，请刷新页面重试');
        }
    }
    
    // 初始化总览页面
    function initSummary(summary) {
        // 更新总数
        document.getElementById('total-count').textContent = summary.total;
        
        // 类型分布
        const typeDistribution = document.getElementById('type-distribution');
        Object.entries(summary.by_type)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                const item = createDistributionItem(type, count);
                typeDistribution.appendChild(item);
            });
        
        // 难度分布
        const difficultyDistribution = document.getElementById('difficulty-distribution');
        Object.entries(summary.by_difficulty)
            .sort((a, b) => b[1] - a[1])
            .forEach(([difficulty, count]) => {
                const item = createDistributionItem(difficulty, count);
                difficultyDistribution.appendChild(item);
            });
        
        // 场景分布
        const sceneDistribution = document.getElementById('scene-distribution');
        Object.entries(summary.by_scene)
            .sort((a, b) => b[1] - a[1])
            .forEach(([scene, count]) => {
                const item = createDistributionItem(scene, count);
                sceneDistribution.appendChild(item);
            });
        
        // 热门标签
        const topTags = document.getElementById('top-tags');
        summary.top_tags.forEach(tag => {
            const item = createDistributionItem(tag.name, tag.count);
            topTags.appendChild(item);
        });
    }
    
    // 创建分布项
    function createDistributionItem(name, count) {
        const div = document.createElement('div');
        div.className = 'distribution-item';
        div.innerHTML = `
            <span class="distribution-name">${name}</span>
            <span class="distribution-count">${count}</span>
        `;
        return div;
    }
    
    // 初始化筛选器
    function initFilters(summary) {
        // 类型筛选
        const typeFilters = document.getElementById('type-filters');
        const allBtn = createFilterButton('全部', 'type', true);
        typeFilters.appendChild(allBtn);
        
        Object.keys(summary.by_type).forEach(type => {
            const btn = createFilterButton(type, 'type', false);
            typeFilters.appendChild(btn);
        });
        
        // 难度筛选
        const difficultyFilters = document.getElementById('difficulty-filters');
        const allDifficultyBtn = createFilterButton('全部', 'difficulty', true);
        difficultyFilters.appendChild(allDifficultyBtn);
        
        Object.keys(summary.by_difficulty).forEach(difficulty => {
            const btn = createFilterButton(difficulty, 'difficulty', false);
            difficultyFilters.appendChild(btn);
        });
    }
    
    // 创建筛选按钮
    function createFilterButton(text, type, isActive) {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${isActive ? 'active' : ''}`;
        btn.textContent = text;
        btn.dataset.filter = text;
        btn.dataset.type = type;
        
        btn.addEventListener('click', () => {
            // 更新按钮状态
            const buttons = btn.parentElement.querySelectorAll('.filter-btn');
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 应用筛选
            if (type === 'type') {
                activeTypeFilter = text === '全部' ? null : text;
            } else if (type === 'difficulty') {
                activeDifficultyFilter = text === '全部' ? null : text;
            }
            
            applyFilters();
        });
        
        return btn;
    }
    
    // 应用筛选
    function applyFilters() {
        currentPage = 0;
        
        filteredMaterials = allMaterials.filter(material => {
            const typeMatch = !activeTypeFilter || material.type === activeTypeFilter;
            const difficultyMatch = !activeDifficultyFilter || material.difficulty === activeDifficultyFilter;
            return typeMatch && difficultyMatch;
        });
        
        renderMaterials();
        updateLoadMoreButton();
    }
    
    // 渲染素材列表
    function renderMaterials() {
        const grid = document.getElementById('materials-grid');
        grid.innerHTML = '';
        
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        const materialsToShow = filteredMaterials.slice(startIndex, endIndex);
        
        materialsToShow.forEach(material => {
            const card = createMaterialCard(material);
            grid.appendChild(card);
        });
        
        updateLoadMoreButton();
    }
    
    // 创建素材卡片
    function createMaterialCard(material) {
        const card = document.createElement('div');
        card.className = 'material-card';
        card.dataset.id = material.id;
        
        // 基本信息
        card.innerHTML = `
            <div class="material-header">
                <h3 class="material-title">${material.title}</h3>
                <span class="material-type ${material.type}">${material.type}</span>
            </div>
            <p class="material-desc">${material.desc}</p>
            <div class="material-tags">
                ${material.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="material-meta">
                ${material.meta.map(meta => `<span class="meta-item">${meta}</span>`).join('')}
            </div>
            <div class="expanded-content">
                ${material.steps.length > 0 ? `
                    <div class="expanded-section">
                        <h4 class="expanded-title">操作步骤</h4>
                        <ol class="steps-list">
                            ${material.steps.map(step => `<li>${step}</li>`).join('')}
                        </ol>
                    </div>
                ` : ''}
                ${material.tips ? `
                    <div class="expanded-section">
                        <h4 class="expanded-title">提示</h4>
                        <p class="expanded-text">${material.tips}</p>
                    </div>
                ` : ''}
                ${material.variant ? `
                    <div class="expanded-section">
                        <h4 class="expanded-title">变体</h4>
                        <p class="expanded-text">${material.variant}</p>
                    </div>
                ` : ''}
                ${material.issue ? `
                    <div class="expanded-section">
                        <h4 class="expanded-title">注意事项</h4>
                        <p class="expanded-text">${material.issue}</p>
                    </div>
                ` : ''}
                ${material.abilities.length > 0 ? `
                    <div class="expanded-section">
                        <h4 class="expanded-title">训练能力</h4>
                        <div class="material-tags">
                            ${material.abilities.map(ability => `<span class="tag">${ability}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                ${material.scenes.length > 0 ? `
                    <div class="expanded-section">
                        <h4 class="expanded-title">使用场景</h4>
                        <div class="material-tags">
                            ${material.scenes.map(scene => `<span class="tag">${scene}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // 点击展开/收起
        card.addEventListener('click', () => {
            const expandedContent = card.querySelector('.expanded-content');
            const isExpanded = expandedContent.classList.contains('show');
            
            // 收起其他卡片
            document.querySelectorAll('.material-card.expanded').forEach(c => {
                if (c !== card) {
                    c.classList.remove('expanded');
                    c.querySelector('.expanded-content').classList.remove('show');
                }
            });
            
            // 展开/收起当前卡片
            card.classList.toggle('expanded');
            expandedContent.classList.toggle('show');
        });
        
        return card;
    }
    
    // 更新加载更多按钮
    function updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('load-more');
        const totalLoaded = (currentPage + 1) * pageSize;
        const hasMore = totalLoaded < filteredMaterials.length;
        
        loadMoreBtn.disabled = !hasMore;
        loadMoreBtn.textContent = hasMore ? '加载更多' : '已加载全部';
    }
    
    // 加载更多
    function loadMore() {
        currentPage++;
        renderMaterials();
    }
    
    // 搜索功能
    function searchMaterials(query) {
        const searchResults = document.getElementById('search-results');
        const noResults = document.getElementById('no-results');
        
        if (!query.trim()) {
            searchResults.innerHTML = '';
            noResults.style.display = 'none';
            return;
        }
        
        const results = allMaterials.filter(material => {
            const searchText = `${material.title} ${material.desc} ${material.tags.join(' ')} ${material.abilities.join(' ')}`;
            return searchText.toLowerCase().includes(query.toLowerCase());
        });
        
        if (results.length === 0) {
            searchResults.innerHTML = '';
            noResults.style.display = 'block';
        } else {
            noResults.style.display = 'none';
            searchResults.innerHTML = '';
            
            results.slice(0, 20).forEach(material => {
                const card = createMaterialCard(material);
                searchResults.appendChild(card);
            });
            
            if (results.length > 20) {
                const moreInfo = document.createElement('p');
                moreInfo.style.cssText = 'text-align: center; color: var(--muted); padding: 1rem;';
                moreInfo.textContent = `找到 ${results.length} 条结果，显示前 20 条`;
                searchResults.appendChild(moreInfo);
            }
        }
    }
    
    // 切换标签页
    function switchTab(tabName) {
        // 更新标签按钮状态
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });
        
        // 显示对应内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
        
        // 如果切换到素材库标签，重置筛选
        if (tabName === 'materials') {
            currentPage = 0;
            renderMaterials();
        }
    }
    
    // 显示错误信息
    function showError(message) {
        const mainContent = document.querySelector('.main-content');
        mainContent.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">⚠️</div>
                <p>${message}</p>
            </div>
        `;
    }
    
    // 初始化事件监听器
    function initEventListeners() {
        // 标签页切换
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.dataset.tab);
            });
        });
        
        // 加载更多按钮
        document.getElementById('load-more').addEventListener('click', loadMore);
        
        // 搜索输入
        const searchInput = document.getElementById('search-input');
        let searchTimeout;
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchMaterials(e.target.value);
            }, 300);
        });
    }
    
    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        initEventListeners();
        loadMaterials();
    });
})();