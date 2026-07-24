import SwiftUI

struct DiscoverView: View {
    @EnvironmentObject private var container: AppContainer
    @EnvironmentObject private var rootTabBar: RootTabBarVisibility
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @StateObject private var viewModelHolder = Holder<DiscoverViewModel>()
    @State private var query = ""
    @State private var activeSheet: DiscoverSheet?
    @State private var activePopover: DiscoverSheet?
    @State private var navigationPath: [String] = []
    @State private var browseMode: BrowseMode = .all
    @State private var activeCategory: MaterialType?
    @State private var randomButtonPosition: CGPoint?
    @SceneStorage("improvtool.discover.selectedMaterialID") private var selectedMaterialID: String?

    private var viewModel: DiscoverViewModel? {
        viewModelHolder.value
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            discoverPresentedContent
        }
    }

    private var discoverObservedContent: AnyView {
        AnyView(discoverStack
            .toolbar(adaptiveLayoutMode == .compact ? .hidden : .visible, for: .navigationBar)
            .toolbar {
                if adaptiveLayoutMode == .split {
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        ShareLink(item: shareText(for: viewModel?.materials ?? [])) {
                            Label("分享", systemImage: "square.and.arrow.up")
                        }
                        Button {
                            activeSheet = .create
                        } label: {
                            Label("新建素材", systemImage: "plus")
                        }
                        .accessibilityIdentifier("discover.create")
                        Button {
                            presentQuickAction(.filter)
                        } label: {
                            Label("筛选", systemImage: "line.3.horizontal.decrease")
                        }
                        .accessibilityIdentifier("discover.filter")
                        Button {
                            Task {
                                await viewModel?.randomMaterial()
                                presentQuickAction(.random)
                            }
                        } label: {
                            Label("随机抽卡", systemImage: "shuffle")
                        }
                        .accessibilityIdentifier("discover.random")
                    }
                }
            }
            .onChange(of: query) { _, nextQuery in
                viewModel?.scheduleQuery(nextQuery)
            }
            .onChange(of: container.materialSourcePreference) { _, preference in
                Task { await viewModel?.applySource(preference.filter) }
            }
            .onChange(of: navigationPath) { _, path in
                rootTabBar.setVisible(path.isEmpty)
            }
            .onChange(of: activeCategory) { _, category in
                rootTabBar.setVisible(category == nil)
            }
            .onChange(of: visibleMaterialIDs) { _, ids in
                guard let selectedMaterialID, !ids.contains(selectedMaterialID) else { return }
                self.selectedMaterialID = nil
            }
        )
    }

    private var discoverRoutedContent: AnyView {
        AnyView(discoverObservedContent
            .navigationDestination(for: String.self) { materialId in
                if let material = material(for: materialId) {
                    MaterialDetailView(
                        material: material,
                        viewModel: viewModel,
                        practiceViewModel: container.makePracticeFeedbackViewModel(),
                        openMaterial: openMaterial
                    )
                } else {
                    EmptyStateCard(title: "素材不存在", subtitle: "素材可能已被删除或筛选条件已变化。")
                }
            }
            .overlay(alignment: .bottom) {
                MessageBanner(message: viewModel?.message)
                    .padding(.bottom, AppTheme.bottomBarHeight + 24)
            }
            .task {
                await loadDiscoverViewModel()
            }
        )
    }

    private var discoverPresentedContent: AnyView {
        AnyView(discoverRoutedContent
            .modifier(DiscoverPresentationModifier(
                activeSheet: $activeSheet,
                activePopover: $activePopover,
                viewModel: viewModel,
                browseMode: $browseMode,
                activeCategory: $activeCategory,
                openMaterial: openMaterial
            ))
            .onChange(of: activeSheet?.id) { _, sheetId in
                rootTabBar.setVisible(sheetId == nil && activePopover == nil)
            }
            .onChange(of: activePopover?.id) { _, popoverId in
                rootTabBar.setVisible(popoverId == nil && activeSheet == nil)
            }
        )
    }

    private var discoverStack: AnyView {
        AnyView(
            ZStack(alignment: .bottomTrailing) {
                discoverWorkspace
                randomFloatingAction
            }
        )
    }

    @ViewBuilder
    private var randomFloatingAction: some View {
        if adaptiveLayoutMode == .compact, viewModel?.state == .loaded {
            DraggableFloatingAction(position: $randomButtonPosition) {
                Task {
                    await viewModel?.randomMaterial()
                    presentQuickAction(.random)
                }
            } label: {
                randomButtonLabel
            }
            .accessibilityIdentifier("discover.random")
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .opacity(rootTabBar.isVisible ? 1 : 0)
            .allowsHitTesting(rootTabBar.isVisible)
        }
    }

    @MainActor
    private func loadDiscoverViewModel() async {
        if let viewModel {
            await viewModel.applySource(container.materialSourcePreference.filter)
            viewModelHolder.objectWillChange.send()
        } else {
            let next = container.makeDiscoverViewModel()
            await next.applySource(container.materialSourcePreference.filter)
            viewModelHolder.value = next
        }
    }

    private func presentQuickAction(_ sheet: DiscoverSheet) {
        if adaptiveLayoutMode == .compact {
            activeSheet = sheet
        } else {
            activePopover = sheet
        }
    }

    @ViewBuilder
    private var discoverWorkspace: some View {
        if adaptiveLayoutMode == .split {
            NavigationSplitView {
                discoverPrimaryPane
                    .navigationTitle("发现")
                    .navigationSplitViewColumnWidth(min: 320, ideal: 380, max: 460)
            } detail: {
                discoverDetailPane
            }
            .navigationSplitViewStyle(.balanced)
            .searchable(text: $query, placement: .sidebar, prompt: "搜索素材、能力或场景")
        } else {
            discoverPrimaryPane
        }
    }

    private var discoverPrimaryPane: some View {
        AppPageShell(tracksRootTabBar: true, onRefresh: {
            await viewModel?.load()
        }) {
            VStack(spacing: 18) {
                if let viewModel {
                    switch viewModel.state {
                    case .idle, .loading:
                        LoadingCard(title: "加载素材中")
                    case .failed(let message):
                        EmptyStateCard(title: "素材加载失败", subtitle: message)
                        PrimaryButton(title: "重试") { Task { await viewModel.load() } }
                    default:
                        DiscoverModeSwitch(selection: $browseMode)
                        if adaptiveLayoutMode == .compact, browseMode == .all || activeCategory != nil {
                            searchCard
                        }
                        if browseMode == .all {
                            materialSection(viewModel)
                        } else {
                            categorySection(viewModel)
                        }
                    }
                } else {
                    LoadingCard(title: "加载素材中")
                }
            }
        }
    }

    @ViewBuilder
    private var discoverDetailPane: some View {
        if let selectedMaterialID, let material = material(for: selectedMaterialID) {
            MaterialDetailView(
                material: material,
                viewModel: viewModel,
                practiceViewModel: container.makePracticeFeedbackViewModel(),
                openMaterial: openMaterial
            )
            .id(material.id)
        } else {
            AppPageShell {
                EmptyStateCard(title: "选择一张素材", subtitle: "在左侧浏览素材，详情和训练操作会保留在当前窗口。")
                    .frame(maxWidth: 520)
            }
        }
    }

    private var visibleMaterialIDs: [String] {
        guard let viewModel else { return [] }
        if browseMode == .all {
            return viewModel.materials.map(\.id)
        }
        guard let activeCategory else { return [] }
        return viewModel.allMaterials.filter { $0.type == activeCategory }.map(\.id)
    }

    private var searchCard: some View {
        AppCard(padding: 14) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(AppTheme.textSecondary)
                TextField(activeCategory.map { "在\($0.rawValue)里搜索" } ?? "搜索素材、能力或场景", text: $query)
                    .font(.subheadline.weight(.semibold))
                    .submitLabel(.search)
                    .onSubmit {
                        Task {
                            if let activeCategory {
                                await viewModel?.applyType(activeCategory)
                            }
                            await viewModel?.applyQuery(query)
                        }
                    }
                    .accessibilityIdentifier("discover.search")
                Text(activeCategory == nil ? "角色 / 主题" : "类别内")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.blue)
            }
        }
    }

    private var randomButtonLabel: some View {
        Text("抽")
            .font(.headline.weight(.heavy))
            .foregroundStyle(AppTheme.textPrimary)
            .frame(width: 58, height: 58)
            .background(AppTheme.orange, in: Circle())
            .overlay(Circle().stroke(AppTheme.onPrimary.opacity(0.90), lineWidth: 2))
            .shadow(color: AppTheme.orange.opacity(0.26), radius: 12, x: 0, y: 6)
            .accessibilityLabel("随机抽卡")
    }

    @ViewBuilder
    private func materialSection(_ viewModel: DiscoverViewModel) -> some View {
        VStack(spacing: 16) {
            HStack(alignment: .center, spacing: 8) {
                Text("全部素材")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                Spacer()
                if adaptiveLayoutMode == .compact {
                    ShareLink(item: shareText(for: viewModel.materials)) {
                        DiscoverToolbarLabel(title: "分享", tone: AppTheme.blue, fill: AppTheme.blueSoft)
                    }
                    Button {
                        activeSheet = .create
                    } label: {
                        DiscoverToolbarLabel(title: "新建", tone: AppTheme.orange, fill: AppTheme.orangeSoft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("discover.create")
                    Button {
                        presentQuickAction(.filter)
                    } label: {
                        DiscoverToolbarLabel(title: "筛选", tone: AppTheme.blue, fill: AppTheme.blueSoft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("discover.filter")
                }
            }

            switch viewModel.state {
            case .loading:
                LoadingCard(title: "加载素材中")
            case .empty(let title):
                if container.materialSourcePreference == .owned, viewModel.allMaterials.isEmpty {
                    ownedMaterialsEmptyCard()
                } else if viewModel.allMaterials.isEmpty {
                    firstMaterialEmptyCard(title)
                } else {
                    noMatchCard(viewModel)
                }
            case .failed(let title):
                EmptyStateCard(title: title, subtitle: "请稍后重试，草稿和筛选条件不会丢失。")
            default:
                LazyVStack(spacing: 16) {
                    ForEach(viewModel.materials) { material in
                        MaterialCard(
                            material: material,
                            onOpen: {
                                openMaterial(material)
                            },
                            onSave: {
                                Task { await viewModel.toggleSaved(material) }
                            }
                        )
                        .task {
                            await viewModel.loadMoreIfNeeded(current: material)
                        }
                    }
                    if viewModel.isLoadingMore {
                        ProgressView("加载更多")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                }
            }
        }
    }

    private func noMatchCard(_ viewModel: DiscoverViewModel) -> some View {
        AppCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("没有匹配素材")
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                Text("调整搜索或筛选条件。当前共有 \(viewModel.allMaterials.count) 条素材。")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                HStack(spacing: 12) {
                    SmallPillButton(title: "重新筛选") {
                        presentQuickAction(.filter)
                    }
                    SmallPillButton(title: "清空条件", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                        Task {
                            query = ""
                            await viewModel.resetSearchAndFilters()
                        }
                    }
                }
            }
        }
    }

    private func firstMaterialEmptyCard(_ title: String) -> some View {
        AppCard {
            VStack(alignment: .center, spacing: 14) {
                Text("添加素材")
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                Text(title == "还没有素材，先添加第一张卡片。" ? "马上开玩" : title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                SmallPillButton(title: "添加素材", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                    activeSheet = .create
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
        }
    }

    private func ownedMaterialsEmptyCard() -> some View {
        AppCard {
            VStack(alignment: .center, spacing: 14) {
                Text("还没有自己的素材")
                    .font(.title2.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                Text("新建一条素材，或恢复查看公共素材。")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                HStack(spacing: 12) {
                    SmallPillButton(title: "新建素材", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                        activeSheet = .create
                    }
                    SmallPillButton(title: "显示全部素材") {
                        container.materialSourcePreference = .all
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
        }
    }

    @ViewBuilder
    private func categorySection(_ viewModel: DiscoverViewModel) -> some View {
        if let activeCategory {
            VStack(spacing: 16) {
                HStack {
                    Button {
                        self.activeCategory = nil
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                            .frame(width: 34, height: 34)
                            .background(AppTheme.cardBackground, in: Circle())
                    }
                    .buttonStyle(.plain)
                    Text(activeCategory.rawValue)
                        .font(.title2.weight(.heavy))
                    Spacer()
                    SmallPillButton(title: "筛选") { presentQuickAction(.filter) }
                }

                let materials = viewModel.allMaterials.filter { $0.type == activeCategory }
                if materials.isEmpty {
                    EmptyStateCard(title: "暂无\(activeCategory.rawValue)素材", subtitle: "可以新建当前类别素材，或返回分类总览。")
                } else {
                    LazyVStack(spacing: 16) {
                        ForEach(materials) { material in
                            MaterialCard(
                            material: material,
                            onOpen: {
                                    openMaterial(material)
                            },
                                onSave: {
                                    Task { await viewModel.toggleSaved(material) }
                                }
                            )
                        }
                    }
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("素材类别")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Spacer()
                    ShareLink(item: shareText(for: viewModel.allMaterials)) {
                        DiscoverToolbarLabel(title: "分享", tone: AppTheme.blue, fill: AppTheme.blueSoft)
                    }
                }

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    ForEach(MaterialType.allCases, id: \.self) { type in
                        let count = viewModel.allMaterials.filter { $0.type == type }.count
                        MaterialCategoryCard(type: type, count: count) {
                            activeCategory = type
                        }
                    }
                }

                Text("学习地图与训练路径")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.top, 4)

                VStack(spacing: 12) {
                    PathPreviewCard(title: "学习地图", desc: "从基础反应到格式主理，按能力层层展开。", tags: ["反应", "身体", "角色", "叙事", "主理"]) {
                        presentQuickAction(.path("learning"))
                    }
                    PathPreviewCard(title: "训练路径", desc: "从个人启动到演后复盘，形成一条可执行路线。", tags: ["热身", "排练", "复盘"]) {
                        presentQuickAction(.path("training"))
                    }
                }
            }
        }
    }

    private func openMaterial(_ material: Material) {
        if adaptiveLayoutMode == .split {
            selectedMaterialID = material.id
            return
        }
        rootTabBar.setVisible(false)
        navigationPath.append(material.id)
    }

    private func material(for id: String) -> Material? {
        viewModel?.allMaterials.first { $0.id == id } ?? viewModel?.materials.first { $0.id == id }
    }

    private func shareText(for materials: [Material]) -> String {
        let names = materials.prefix(5).map(\.title).joined(separator: "、")
        return "即兴工具箱素材库：\(names)\(materials.count > 5 ? " 等 \(materials.count) 个素材" : "")"
    }
}

private enum BrowseMode: String, CaseIterable, Identifiable {
    case all = "全部"
    case category = "分类"

    var id: String { rawValue }
}

private struct DiscoverModeSwitch: View {
    @Binding var selection: BrowseMode

    var body: some View {
        HStack(spacing: 6) {
            ForEach(BrowseMode.allCases) { mode in
                Button {
                    selection = mode
                } label: {
                    Text(mode.rawValue)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(selection == mode ? AppTheme.textPrimary : AppTheme.textSecondary)
                        .frame(width: 68, height: 34)
                        .background {
                            if selection == mode {
                                Capsule().fill(AppTheme.orangeSoft)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(AppTheme.elevatedCardBackground.opacity(0.82), in: Capsule())
        .overlay(Capsule().stroke(AppTheme.divider.opacity(0.55), lineWidth: 1))
    }
}

private struct DiscoverToolbarLabel: View {
    let title: String
    let tone: Color
    let fill: Color

    var body: some View {
        ZStack {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(tone)
                .lineLimit(1)
                .frame(width: 46, height: 28)
                .background(fill, in: Capsule())
                .overlay(Capsule().stroke(tone.opacity(0.16), lineWidth: 1))
        }
        .frame(width: 46, height: 44)
        .contentShape(Rectangle())
    }
}

private struct MaterialCard: View {
    let material: Material
    let onOpen: () -> Void
    let onSave: () -> Void

    var body: some View {
        AppCard {
            HStack(alignment: .top, spacing: 14) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(accentColor)
                    .frame(width: 5, height: 76)

                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        Button(action: onOpen) {
                            Text(material.title)
                                .font(.title3.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                        Spacer()
                        Button(action: onSave) {
                            Image(systemName: material.saved ? "heart.fill" : "heart")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(material.saved ? AppTheme.orange : AppTheme.textMuted)
                                .frame(width: 34, height: 34)
                        }
                        .buttonStyle(.plain)
                    }

                    Button(action: onOpen) {
                        Text(material.desc)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var accentColor: Color {
        switch material.type {
        case .game, .format: AppTheme.orange
        case .character, .talent: AppTheme.blue
        case .hosting, .technique: AppTheme.teal
        case .review, .path: AppTheme.teal
        }
    }
}

private struct MaterialCategoryCard: View {
    let type: MaterialType
    let count: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            AppCard(padding: 14) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(type.rawValue)
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Spacer()
                        DisplayTag(title: "\(count)")
                    }
                    Text(categoryDescription(type))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func categoryDescription(_ type: MaterialType) -> String {
        switch type {
        case .game: "热身、限制、关系和现场启动。"
        case .character: "快速建立身份、关系和状态。"
        case .talent: "舞蹈、口音、模仿和识别点。"
        case .format: "短篇结构、长篇格式和转场。"
        case .hosting: "主持词、控场和带练提示。"
        case .technique: "Yes And、聆听和关系推进。"
        case .review: "Keep / Try 和复盘方法。"
        case .path: "低频参考路线和学习地图。"
        }
    }
}

private struct PathPreviewCard: View {
    let title: String
    let desc: String
    let tags: [String]
    let action: () -> Void

    var body: some View {
        AppCard {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(title)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text(desc)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            DisplayTag(title: tag)
                        }
                    }
                }
                Spacer()
                SmallPillButton(title: "查看", action: action)
            }
        }
    }
}

private enum DiscoverSheet: Identifiable {
    case create
    case filter
    case random
    case path(String)

    var id: String {
        switch self {
        case .create: "create"
        case .filter: "filter"
        case .random: "random"
        case .path(let kind): "path-\(kind)"
        }
    }
}

private struct DiscoverPresentationModifier: ViewModifier {
    @Binding var activeSheet: DiscoverSheet?
    @Binding var activePopover: DiscoverSheet?
    let viewModel: DiscoverViewModel?
    @Binding var browseMode: BrowseMode
    @Binding var activeCategory: MaterialType?
    let openMaterial: (Material) -> Void

    func body(content: Content) -> some View {
        content
            .sheet(item: $activeSheet) { sheet in
                presentation(sheet)
            }
            .popover(item: $activePopover, arrowEdge: .top) { sheet in
                presentation(sheet)
                    .frame(idealWidth: 680, idealHeight: 720)
                    .presentationCompactAdaptation(.sheet)
            }
    }

    private func presentation(_ sheet: DiscoverSheet) -> AnyView {
        switch sheet {
        case .create:
            return AnyView(MaterialFormSheet(title: "添加素材", material: nil, viewModel: viewModel))
        case .filter:
            return AnyView(FilterSheet(viewModel: viewModel))
        case .random:
            return AnyView(RandomDrawSheet(viewModel: viewModel) { material in
                activeSheet = nil
                activePopover = nil
                openMaterial(material)
            })
        case .path(let kind):
            return AnyView(PathReferenceSheet(kind: kind, viewModel: viewModel) { ability in
                Task {
                    await viewModel?.applyAbility(ability)
                    browseMode = .all
                    activeCategory = nil
                }
            })
        }
    }
}

struct MaterialDetailHostView: View {
    let material: Material
    @EnvironmentObject private var container: AppContainer
    @StateObject private var discoverHolder = Holder<DiscoverViewModel>()
    @StateObject private var practiceHolder = Holder<PracticeFeedbackViewModel>()
    @State private var relatedMaterial: Material?
    @State private var relatedPresented = false

    var body: some View {
        Group {
            if let discoverViewModel = discoverHolder.value,
               let practiceViewModel = practiceHolder.value {
                MaterialDetailView(
                    material: material,
                    viewModel: discoverViewModel,
                    practiceViewModel: practiceViewModel,
                    openMaterial: { related in
                        relatedMaterial = related
                        relatedPresented = true
                    }
                )
            } else {
                LoadingCard(title: "加载素材详情")
                    .padding(20)
            }
        }
        .task {
            guard discoverHolder.value == nil else { return }
            let discover = container.makeDiscoverViewModel()
            await discover.load()
            await discover.loadPracticeRecords(materialId: material.id)
            discoverHolder.value = discover
            practiceHolder.value = container.makePracticeFeedbackViewModel()
        }
        .navigationDestination(isPresented: $relatedPresented) {
            if let relatedMaterial {
                MaterialDetailHostView(material: relatedMaterial)
            }
        }
        .rootTabBarVisibility(.hidden)
    }
}

private struct MaterialDetailView: View {
    let material: Material
    let viewModel: DiscoverViewModel?
    @ObservedObject var practiceViewModel: PracticeFeedbackViewModel
    let openMaterial: (Material) -> Void
    @EnvironmentObject private var container: AppContainer
    @Environment(\.dismiss) private var dismiss
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @State private var editPresented = false
    @State private var practicePresented = false
    @State private var recordsPresented = false
    @State private var sessionRefreshToken = UUID()

    private var currentSession: MaterialSession? {
        guard let session = viewModel?.currentMaterialSession, session.materialId == material.id else { return nil }
        return session
    }

    var body: some View {
        AppPageShell(bottomInset: 132, onRefresh: {
            await viewModel?.loadPracticeRecords(materialId: material.id)
        }) {
            VStack(alignment: .leading, spacing: 18) {
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(detailKicker)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                    .lineLimit(1)
                                Text(material.title)
                                    .font(.title.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                            }
                            Spacer()
                            ShareLink(item: "\(material.title)\n\(material.desc)") {
                                Text("分享")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(AppTheme.blue)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(AppTheme.blueSoft, in: Capsule())
                            }
                        }
                        Text(material.desc)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                }

                if !material.steps.isEmpty {
                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("训练步骤")
                                .font(.headline.weight(.heavy))
                            ForEach(Array(material.steps.enumerated()), id: \.offset) { index, step in
                                HStack(alignment: .top, spacing: 10) {
                                    Text("\(index + 1)")
                                        .font(.caption.weight(.heavy))
                                        .foregroundStyle(AppTheme.onPrimary)
                                        .frame(width: 24, height: 24)
                                        .background(AppTheme.orange, in: Circle())
                                    Text(step)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                }
                            }
                        }
                    }
                }

                if !material.tips.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    AppCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("使用提示")
                                .font(.headline.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(material.tips)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }

                if !material.variant.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !material.issue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    AppCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("变体与注意点")
                                .font(.headline.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            if !material.variant.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                Text(material.variant)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                            if !material.issue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                Text(material.issue)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AppTheme.error)
                            }
                        }
                    }
                }

                if let related = viewModel?.relatedMaterial(for: material) {
                    AppCard {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("关联素材")
                                    .font(.headline.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                                Text(related.title)
                                    .font(.subheadline.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                                Text(related.desc)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                    .lineLimit(2)
                            }
                            Spacer()
                            SmallPillButton(title: "查看") {
                                openMaterial(related)
                            }
                        }
                    }
                }

                PracticeSummaryCard(material: material, records: viewModel?.selectedPracticeRecords ?? []) {
                    recordsPresented = true
                }
            }
        }
        .id(sessionRefreshToken)
        .adaptiveTaskInset(layoutMode: adaptiveLayoutMode) {
            MaterialDetailActionBar(
                material: material,
                currentSession: currentSession,
                togglePlayed: {
                    Task { await viewModel?.togglePlayed(material) }
                },
                toggleSaved: {
                    Task { await viewModel?.toggleSaved(material) }
                },
                startPractice: {
                    viewModel?.startPractice(material)
                    sessionRefreshToken = UUID()
                },
                toggleSession: {
                    viewModel?.pauseOrResumeMaterialSession()
                    sessionRefreshToken = UUID()
                },
                finishSession: {
                    practicePresented = true
                }
            )
        }
        .navigationDestination(isPresented: $editPresented) {
            MaterialFormSheet(title: "编辑素材", material: material, viewModel: viewModel) {
                dismiss()
            }
        }
        .navigationDestination(isPresented: $practicePresented) {
            PracticeFeedbackView(material: material, viewModel: practiceViewModel)
        }
        .navigationDestination(isPresented: $recordsPresented) {
            MaterialRecordsView(
                material: material,
                records: viewModel?.selectedPracticeRecords ?? [],
                loadRecords: { try await container.repository.listPracticeRecords(materialId: material.id) }
            ) { record in
                await viewModel?.updatePracticeRecord(record)
            }
        }
        .task {
            await viewModel?.loadPracticeRecords(materialId: material.id)
        }
        .toolbar {
            if viewModel != nil, material.isOwnedByCurrentUser {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        editPresented = true
                    } label: {
                        Label("编辑", systemImage: "pencil")
                    }
                    .accessibilityLabel("编辑素材")
                }
            }
        }
        .rootTabBarVisibility(.hidden)
    }

    private var detailKicker: String {
        ([material.type.rawValue] + material.abilities + material.tags)
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}

private struct MaterialDetailActionBar: View {
    let material: Material
    let currentSession: MaterialSession?
    let togglePlayed: () -> Void
    let toggleSaved: () -> Void
    let startPractice: () -> Void
    let toggleSession: () -> Void
    let finishSession: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            actionButtons
        }
        .padding(7)
        .background(AppTheme.elevatedCardBackground.opacity(0.94), in: Capsule())
        .overlay {
            Capsule()
                .stroke(AppTheme.onPrimary.opacity(0.74), lineWidth: 1)
        }
        .shadow(color: AppVisualTheme.current.shadow, radius: 18, x: 0, y: 10)
        .padding(.horizontal, 24)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private var actionButtons: some View {
            if let currentSession {
                MaterialDetailBarButton(
                    title: currentSession.status == .paused ? "继续" : "暂停",
                    role: .secondary,
                    action: toggleSession
                )
                MaterialDetailBarButton(title: "结束复盘", role: .primary, action: finishSession)
            } else if material.referenceOnly {
                MaterialDetailBarButton(
                    title: material.saved ? "已收藏" : "收藏",
                    role: .secondary,
                    action: toggleSaved
                )
                Text("路径只查看")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(AppTheme.cardBackground.opacity(0.86), in: Capsule())
            } else {
                Button {
                    togglePlayed()
                } label: {
                    Label(material.played ? "已练过" : "练过", systemImage: material.played ? "checkmark" : "circle")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(AppTheme.textSecondary)
                        .lineLimit(1)
                        .frame(minHeight: 46)
                        .padding(.horizontal, 10)
                        .background(AppTheme.cardBackground, in: Capsule())
                }
                .buttonStyle(.plain)
                Button {
                    toggleSaved()
                } label: {
                    Label(material.saved ? "已收藏" : "收藏", systemImage: material.saved ? "heart.fill" : "heart")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(material.saved ? AppTheme.orange : AppTheme.textSecondary)
                        .lineLimit(1)
                        .frame(minHeight: 46)
                        .padding(.horizontal, 6)
                }
                .buttonStyle(.plain)
                MaterialDetailBarButton(title: "开始训练", role: .primary, action: startPractice)
            }
    }
}

private struct MaterialDetailBarButton: View {
    enum Role {
        case primary
        case secondary
    }

    let title: String
    let role: Role
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font((role == .primary ? Font.headline : Font.subheadline).weight(.bold))
                .foregroundStyle(role == .primary ? AppTheme.textPrimary : AppTheme.blue)
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .frame(maxWidth: .infinity)
                .frame(height: 46)
                .background(background, in: Capsule())
                .overlay(
                    Capsule()
                        .stroke(strokeColor, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private var background: Color {
        switch role {
        case .primary:
            AppTheme.orange
        case .secondary:
            AppTheme.blueSoft
        }
    }

    private var strokeColor: Color {
        switch role {
        case .primary:
            AppTheme.orange.opacity(0.20)
        case .secondary:
            AppTheme.blue.opacity(0.12)
        }
    }
}

private struct PracticeSummaryCard: View {
    let material: Material
    let records: [PracticeRecord]
    let openAll: () -> Void

    private var averageScore: String {
        guard !records.isEmpty else { return "-" }
        let average = Double(records.map(\.score).reduce(0, +)) / Double(records.count)
        return String(format: "%.1f", average)
    }

    private var markerCount: Int {
        records
            .flatMap(\.attachments)
            .reduce(0) { $0 + $1.markers.count }
    }

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("个人练习记录")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Spacer()
                    SmallPillButton(title: "查看全部", action: openAll)
                }
                HStack(spacing: 0) {
                    summary(value: averageScore, label: "平均分")
                    summary(value: "\(records.count)", label: "训练次数")
                    summary(value: "\(records.filter { !$0.attachments.filter { $0.type == .video }.isEmpty }.count)", label: "视频记录")
                    summary(value: "\(markerCount)", label: "关键时刻")
                }
                if records.isEmpty {
                    Text("练完 \(material.title) 后，这里会出现最近复盘。")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                } else {
                    ForEach(records.sorted(by: { $0.createdAt > $1.createdAt }).prefix(3)) { record in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(dateLabel(record.createdAt)) · \(record.score) 分")
                                .font(.subheadline.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(record.note)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                                .lineLimit(2)
                        }
                        if record.id != records.sorted(by: { $0.createdAt > $1.createdAt }).prefix(3).last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }

    private func dateLabel(_ date: Date) -> String {
        let components = Calendar.current.dateComponents([.month, .day], from: date)
        return "\(components.month ?? 0)月\(components.day ?? 0)日"
    }

    private func summary(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MaterialFormSheet: View {
    let title: String
    let material: Material?
    let viewModel: DiscoverViewModel?
    let onDeleted: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var draftTitle: String
    @State private var draftDesc: String
    @State private var draftType: MaterialType
    @State private var draftAbilities: Set<String>
    @State private var draftScenes: Set<String>
    @State private var draftTags: String
    @State private var draftPeople: String
    @State private var draftDuration: String
    @State private var draftSteps: String
    @State private var draftTips: String
    @State private var draftVariant: String
    @State private var draftIssue: String
    @State private var showMoreOptions = false
    @State private var isCustomTagInputVisible = false
    @State private var customTagInput = ""
    @State private var isSaving = false
    @State private var deleteConfirmationVisible = false

    init(title: String, material: Material?, viewModel: DiscoverViewModel?, onDeleted: (() -> Void)? = nil) {
        self.title = title
        self.material = material
        self.viewModel = viewModel
        self.onDeleted = onDeleted
        _draftTitle = State(initialValue: material?.title ?? "")
        _draftDesc = State(initialValue: material?.desc ?? "")
        _draftType = State(initialValue: material?.type ?? .game)
        _draftAbilities = State(initialValue: Set(material?.abilities ?? []))
        _draftScenes = State(initialValue: Set(material?.scenes ?? []))
        _draftTags = State(initialValue: (material?.tags ?? []).joined(separator: "、"))
        _draftPeople = State(initialValue: material?.tags.first(where: { $0.contains("人") }) ?? "")
        _draftDuration = State(initialValue: material?.durationTag ?? "")
        _draftSteps = State(initialValue: (material?.steps ?? []).joined(separator: "\n"))
        _draftTips = State(initialValue: material?.tips ?? "")
        _draftVariant = State(initialValue: material?.variant ?? "")
        _draftIssue = State(initialValue: material?.issue ?? "")
    }

    var body: some View {
        AppPageShell(bottomInset: 106) {
            VStack(alignment: .leading, spacing: 18) {
                SheetTitleBar(title, closeAccessibilityLabel: "关闭素材编辑") { dismiss() }

                AppCard(padding: 14) {
                    VStack(alignment: .leading, spacing: 16) {
                        formField("素材名称") {
                            TextField("例如：情绪接力", text: $draftTitle)
                                .textFieldStyle(AppTextFieldStyle())
                        }

                        formField("简短描述") {
                            AppTextEditor(text: $draftDesc, placeholder: "一句话描述", minHeight: 92)
                        }

                        formGroup("类型") {
                            ForEach(MaterialType.allCases, id: \.self) { type in
                                ActionChip(title: type.rawValue, selected: draftType == type, compact: true) {
                                    draftType = type
                                }
                            }
                        }

                        formGroup("能力") {
                            ForEach(abilityOptions, id: \.self) { ability in
                                ActionChip(title: ability, selected: draftAbilities.contains(ability), compact: true) {
                                    toggleAbility(ability)
                                }
                            }
                        }

                        formGroup("场景") {
                            ForEach(sceneOptions, id: \.self) { scene in
                                ActionChip(title: scene, selected: draftScenes.contains(scene), compact: true) {
                                    toggleScene(scene)
                                }
                            }
                        }

                        formGroup("标签（可选）") {
                            ForEach(recommendedTags, id: \.self) { tag in
                                ActionChip(title: tag, selected: enteredTags.contains(tag), compact: true) {
                                    toggleTag(tag)
                                }
                            }
                            ForEach(enteredTags.filter { !recommendedTags.contains($0) }, id: \.self) { tag in
                                ActionChip(title: tag, selected: true, compact: true) {
                                    toggleTag(tag)
                                }
                            }
                            ActionChip(title: "+ 添加标签", selected: isCustomTagInputVisible, compact: true) {
                                isCustomTagInputVisible.toggle()
                            }
                        }
                        if isCustomTagInputVisible {
                            HStack(spacing: 10) {
                                TextField("例如：热身、双人、新手", text: $customTagInput)
                                    .textFieldStyle(AppTextFieldStyle())
                                    .onSubmit(addCustomTag)
                                SmallPillButton(title: "添加") {
                                    addCustomTag()
                                }
                            }
                        }

                        HStack(spacing: 12) {
                            formField("适合人数") {
                                TextField("4-8 人", text: $draftPeople)
                                    .textFieldStyle(AppTextFieldStyle())
                            }
                            formField("时长") {
                                TextField("10 分钟", text: $draftDuration)
                                    .textFieldStyle(AppTextFieldStyle())
                            }
                        }

                    }
                }

                SmallPillButton(title: showMoreOptions ? "收起玩法与提示" : "补充玩法与提示") {
                    showMoreOptions.toggle()
                }

                if showMoreOptions {
                    AppCard(padding: 14) {
                        VStack(alignment: .leading, spacing: 14) {
                            formField("补充玩法步骤") {
                                AppTextEditor(text: $draftSteps, placeholder: "每行一个步骤")
                            }
                            formField("带领提示") {
                                materialTextEditor(text: $draftTips, placeholder: "带练提醒")
                            }
                            formField("变体玩法") {
                                materialTextEditor(text: $draftVariant, placeholder: "变体用法")
                            }
                            formField("可能翻车点") {
                                materialTextEditor(text: $draftIssue, placeholder: "易卡住的环节")
                            }
                        }
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            Group {
                if material != nil {
                    SheetActionRow(
                        secondaryTitle: "删除素材",
                        secondaryAction: { deleteConfirmationVisible = true },
                        primaryTitle: "保存修改",
                        primaryAction: saveMaterial,
                        secondaryTint: AppTheme.error,
                        secondaryFill: AppTheme.error.opacity(0.10),
                        isSecondaryDisabled: isSaving,
                        isPrimaryDisabled: isSaving || draftTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )
                } else {
                    PrimaryButton(title: "加入素材库", action: saveMaterial)
                        .disabled(isSaving || draftTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 10)
            .padding(.bottom, 12)
            .background(.ultraThinMaterial)
        }
        .interactiveDismissDisabled(isSaving)
        .alert("删除素材", isPresented: $deleteConfirmationVisible) {
            Button("取消", role: .cancel) {}
            Button("删除", role: .destructive) {
                Task {
                    guard let material else { return }
                    isSaving = true
                    defer { isSaving = false }
                    if await viewModel?.deleteMaterial(material) == true {
                        onDeleted?()
                        dismiss()
                    }
                }
            }
        } message: {
            Text("删除后会从当前素材库移除，已有练习记录保留历史快照。")
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func saveMaterial() {
        Task {
            isSaving = true
            defer { isSaving = false }
            let saved: Bool
            if let material {
                saved = await viewModel?.updateMaterial(material, title: draftTitle, desc: draftDesc, type: draftType, tags: normalizedTags, abilities: Array(draftAbilities), scenes: Array(draftScenes), steps: normalizedSteps, tips: draftTips, variant: draftVariant, issue: draftIssue) ?? false
            } else {
                saved = await viewModel?.createMaterial(title: draftTitle, desc: draftDesc, type: draftType, tags: normalizedTags, abilities: Array(draftAbilities), scenes: Array(draftScenes), steps: normalizedSteps, tips: draftTips, variant: draftVariant, issue: draftIssue) ?? false
            }
            if saved { dismiss() }
        }
    }

    @ViewBuilder
    private func materialTextEditor(text: Binding<String>, placeholder: String) -> some View {
        AppTextEditor(text: text, placeholder: placeholder, minHeight: 86)
    }

    private func formField<Content: View>(_ title: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            content()
        }
    }

    private var abilityOptions: [String] {
        ["自发性", "Yes And", "聆听", "角色塑造", "叙事", "身体", "声音"]
    }

    private var sceneOptions: [String] {
        ["临场速查", "备课", "排练", "演出", "个人空间"]
    }

    private var normalizedTags: [String] {
        let base = draftTags
            .split(whereSeparator: { "、,， ".contains($0) })
            .map { String($0) }
        return Array(Set(base + [draftPeople, draftDuration].filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })).sorted()
    }

    private var enteredTags: [String] {
        Array(Set(
            draftTags
                .split(whereSeparator: { "、,， ".contains($0) })
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        )).sorted()
    }

    private var recommendedTags: [String] {
        ["热身", "新手", "双人", "小组", "高能量", "复盘"]
    }

    private var normalizedSteps: [String] {
        draftSteps
            .split(whereSeparator: \.isNewline)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func formGroup<Content: View>(_ title: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            FlowWrap(spacing: 6, rowSpacing: 6) {
                content()
            }
        }
    }

    private func toggleAbility(_ value: String) {
        if draftAbilities.contains(value) {
            draftAbilities.remove(value)
        } else {
            draftAbilities.insert(value)
        }
    }

    private func toggleScene(_ value: String) {
        if draftScenes.contains(value) {
            draftScenes.remove(value)
        } else {
            draftScenes.insert(value)
        }
    }

    private func toggleTag(_ value: String) {
        var tags = Set(enteredTags)
        if tags.contains(value) {
            tags.remove(value)
        } else {
            tags.insert(value)
        }
        draftTags = tags.sorted().joined(separator: "、")
    }

    private func addCustomTag() {
        let tag = customTagInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tag.isEmpty else { return }
        var tags = Set(enteredTags)
        tags.insert(tag)
        draftTags = tags.sorted().joined(separator: "、")
        customTagInput = ""
        isCustomTagInputVisible = false
    }

}

private extension Material {
    var durationTag: String {
        tags.first { tag in
            tag.contains("分钟") || tag.contains("秒") || tag.localizedCaseInsensitiveContains("min")
        } ?? ""
    }
}

private struct FilterSheet: View {
    let viewModel: DiscoverViewModel?
    @Environment(\.dismiss) private var dismiss
    @State private var draft: MaterialListFilters
    @State private var isApplying = false
    private let defaultAbilities = ["自发性", "Yes And", "聆听", "角色塑造", "叙事"]
    private let defaultScenes = ["临场速查", "备课", "排练", "演出"]

    init(viewModel: DiscoverViewModel?) {
        self.viewModel = viewModel
        _draft = State(initialValue: viewModel?.filters ?? MaterialListFilters())
    }

    private var abilityOptions: [String] {
        Array((viewModel?.availableAbilities ?? defaultAbilities).prefix(8))
    }

    private var sceneOptions: [String] {
        Array((viewModel?.availableScenes ?? defaultScenes).prefix(8))
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 14) {
                PageTitle(title: "筛选素材")
                HStack {
                    Text("\(resultTotal) 条素材")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(AppTheme.textSecondary)
                    if activeFilterCount > 0 {
                        Text("已选 \(activeFilterCount) 项")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.orange)
                    }
                    Spacer()
                    Button("清空") {
                        draft = MaterialListFilters(query: draft.query, source: draft.source)
                    }
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(AppTheme.blue)
                    .frame(minHeight: 44)
                }
                filterGroup("素材类型") {
                    ActionChip(title: "全部", selected: draft.type == nil) {
                        draft.type = nil
                    }
                    ForEach(viewModel?.availableTypes ?? MaterialType.allCases, id: \.self) { type in
                        ActionChip(title: type.rawValue, selected: draft.type == type) {
                            draft.type = type
                        }
                    }
                }

                filterGroup("训练能力") {
                    ActionChip(title: "全部", selected: draft.ability == nil) {
                        draft.ability = nil
                    }
                    ForEach(abilityOptions, id: \.self) { ability in
                        ActionChip(title: ability, selected: draft.ability == ability) {
                            draft.ability = ability
                        }
                    }
                }

                filterGroup("场景") {
                    ActionChip(title: "全部", selected: draft.scene == nil) {
                        draft.scene = nil
                    }
                    ForEach(sceneOptions, id: \.self) { scene in
                        ActionChip(title: scene, selected: draft.scene == scene) {
                            draft.scene = scene
                        }
                    }
                }

                filterGroup("状态") {
                    ActionChip(title: "全部", selected: !draft.onlySaved && !draft.onlyPlayed) {
                        draft.onlySaved = false
                        draft.onlyPlayed = false
                    }
                    ActionChip(title: "已收藏", selected: draft.onlySaved) {
                        draft.onlySaved.toggle()
                    }
                    ActionChip(title: "练过", selected: draft.onlyPlayed) {
                        draft.onlyPlayed.toggle()
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            PrimaryButton(title: "查看结果（\(resultTotal)）") {
                    Task {
                        isApplying = true
                        defer { isApplying = false }
                        await viewModel?.applyFilters(draft)
                        dismiss()
                    }
            }
            .disabled(isApplying)
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 12)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) {
                Divider().opacity(0.5)
            }
        }
        .interactiveDismissDisabled(isApplying)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var resultTotal: Int {
        viewModel?.resultCount(for: draft) ?? 0
    }

    private var activeFilterCount: Int {
        [draft.type == nil, draft.ability == nil, draft.scene == nil, !draft.onlySaved, !draft.onlyPlayed]
            .filter { !$0 }
            .count
    }

    private func filterGroup<Content: View>(_ title: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            FlowWrap(spacing: 6, rowSpacing: 6) {
                content()
            }
        }
    }
}

private struct SimpleActionSheet: View {
    let title: String
    let message: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: title)
                AppCard {
                    Text(message)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private struct RandomDrawSheet: View {
    let viewModel: DiscoverViewModel?
    let openMaterial: (Material) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var refreshToken = UUID()

    init(viewModel: DiscoverViewModel?, openMaterial: @escaping (Material) -> Void) {
        self.viewModel = viewModel
        self.openMaterial = openMaterial
    }

    var body: some View {
        FittedSheet(minimumHeight: 360, maximumHeight: 520) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "随机抽卡")
                if viewModel?.materials.isEmpty ?? true {
                    EmptyStateCard(title: "还没有可抽的素材", subtitle: "先添加几个常用素材，再来条件抽卡。")
                    PrimaryButton(title: "添加素材") { dismiss() }
                } else if let material = viewModel?.selectedMaterial {
                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("抽到 / \(conditionText)")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.textSecondary)
                            Text(material.title)
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(material.desc)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                            HStack(spacing: 5) {
                                DisplayTag(title: material.type.rawValue, tone: AppTheme.textSecondary, fill: AppTheme.cardBackground)
                                ForEach((material.abilities + material.tags).prefix(3), id: \.self) { tag in
                                    DisplayTag(title: tag, tone: AppTheme.textSecondary, fill: AppTheme.cardBackground)
                                }
                            }
                        }
                    }
                    SheetActionRow(
                        secondaryTitle: "再抽一张",
                        secondaryAction: {
                            Task {
                                await viewModel?.randomMaterial()
                                refreshToken = UUID()
                            }
                        },
                        primaryTitle: "查看详情",
                        primaryAction: {
                            dismiss()
                            openMaterial(material)
                        }
                    )
                } else {
                    EmptyStateCard(title: "没有匹配素材", subtitle: "放宽条件，或者先从全部素材里抽一张。")
                    SheetActionRow(
                        secondaryTitle: "清空条件",
                        secondaryAction: {
                            Task {
                                await viewModel?.clearFilters()
                                await viewModel?.randomMaterial()
                                refreshToken = UUID()
                            }
                        },
                        primaryTitle: "从全部素材抽",
                        primaryAction: {
                            Task {
                                await viewModel?.clearFilters()
                                await viewModel?.randomMaterial()
                                refreshToken = UUID()
                            }
                        }
                    )
                }
            }
        }
        .id(refreshToken)
    }

    private var conditionText: String {
        if let type = viewModel?.filters.type { return type.rawValue }
        if let ability = viewModel?.filters.ability { return ability }
        if let scene = viewModel?.filters.scene { return scene }
        return "全部素材"
    }
}

private struct PathReferenceSheet: View {
    let kind: String
    let viewModel: DiscoverViewModel?
    let browseAbility: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var editMode = false
    @State private var draftTitle: String
    @State private var draftDesc: String
    @State private var draftSteps: String
    @State private var draftAbilities: String
    @State private var draftTips: String

    init(kind: String, viewModel: DiscoverViewModel?, browseAbility: @escaping (String) -> Void = { _ in }) {
        self.kind = kind
        self.viewModel = viewModel
        self.browseAbility = browseAbility
        let presetTitle = kind == "learning" ? "学习地图" : "训练路径"
        let presetDesc = kind == "learning" ? "从入门基础到格式与主理，快速定位训练阶段。" : "个人热身、双人场景、小组排练和演后复盘。"
        let presetSteps = kind == "learning"
            ? ["入门基础", "身体与声音", "角色关系", "叙事结构", "格式与主理"]
            : ["个人热身", "双人场景", "小组排练", "演出准备", "演后复盘"]
        _draftTitle = State(initialValue: presetTitle)
        _draftDesc = State(initialValue: presetDesc)
        _draftSteps = State(initialValue: presetSteps.joined(separator: "\n"))
        _draftAbilities = State(initialValue: kind == "learning" ? "入门、身体、叙事" : "热身、排练、复盘")
        _draftTips = State(initialValue: kind == "learning" ? "学习地图用于判断当前阶段，具体训练仍从非路径素材开始。" : "训练路径用于安排练习方向，具体练习仍从非路径素材开始。")
    }

    private var title: String {
        draftTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? (kind == "learning" ? "学习地图" : "训练路径") : draftTitle
    }

    private var steps: [String] {
        normalizedSteps.isEmpty
            ? (kind == "learning"
                ? ["入门基础", "身体与声音", "角色关系", "叙事结构", "格式与主理"]
                : ["个人热身", "双人场景", "小组排练", "演出准备", "演后复盘"])
            : normalizedSteps
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: editMode ? "编辑 · \(title)" : title)
                if editMode {
                    AppCard {
                        VStack(alignment: .leading, spacing: 14) {
                            TextField("路径名称", text: $draftTitle)
                                .textFieldStyle(AppTextFieldStyle())
                            AppTextEditor(text: $draftDesc, placeholder: "训练目标", minHeight: 92)
                            AppTextEditor(text: $draftSteps, placeholder: "阶段步骤", minHeight: 140)
                            TextField("能力标签，用顿号分隔", text: $draftAbilities)
                                .textFieldStyle(AppTextFieldStyle())
                            AppTextEditor(text: $draftTips, placeholder: "带练提醒", minHeight: 90)
                        }
                    }
                    HStack(spacing: 12) {
                        SmallPillButton(title: "取消") {
                            editMode = false
                        }
                        PrimaryButton(title: "保存为我的路径") {
                            savePath()
                        }
                    }
                } else {
                    if !draftDesc.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        AppCard {
                            Text(draftDesc)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                                Label("\(index + 1). \(step)", systemImage: "circle.fill")
                                    .font(.headline.weight(.semibold))
                                    .foregroundStyle(AppTheme.textPrimary)
                            }
                        }
                    }
                    if !draftTips.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        AppCard {
                            Text(draftTips)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                    FlowWrap(spacing: 6, rowSpacing: 6) {
                        ForEach(normalizedAbilities, id: \.self) { tag in
                            DisplayTag(title: tag)
                        }
                    }
                    HStack(spacing: 12) {
                        if let firstAbility = normalizedAbilities.first {
                            SmallPillButton(title: "按能力找素材") {
                                dismiss()
                                browseAbility(firstAbility)
                            }
                        }
                        SmallPillButton(title: "编辑我的版本", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                            editMode = true
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var normalizedSteps: [String] {
        draftSteps
            .split(whereSeparator: \.isNewline)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private var normalizedAbilities: [String] {
        draftAbilities
            .split(whereSeparator: { "、,， ".contains($0) })
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func savePath() {
        Task {
            _ = await viewModel?.createMaterial(
                title: title,
                desc: draftDesc,
                type: .path,
                tags: Array(Set(["路径", "学习路径", "自定义"] + normalizedAbilities)).sorted(),
                abilities: normalizedAbilities,
                scenes: ["备课", "复盘"],
                steps: steps,
                tips: draftTips
            )
            editMode = false
        }
    }
}
