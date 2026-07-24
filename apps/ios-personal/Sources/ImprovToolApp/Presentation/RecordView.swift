import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct RecordView: View {
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @EnvironmentObject private var container: AppContainer
    @EnvironmentObject private var rootTabBar: RootTabBarVisibility
    @StateObject private var viewModelHolder = Holder<RecordViewModel>()
    @State private var activeSheet: RecordSheet?
    @State private var pendingSheet: RecordSheet?
    @State private var pendingDestination: RecordDestination?
    @State private var navigationPath: [RecordDestination] = []
    @State private var overviewDetail: OverviewItem?
    @State private var overviewMaterialRecords: MaterialRecordSelection?
    @State private var recommendationVisible = true
    @State private var sessionRefreshToken = UUID()
    @SceneStorage("improvtool.record.context") private var selectedRecordContextRawValue = RecordContext.today.rawValue

    private var viewModel: RecordViewModel? { viewModelHolder.value }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            recordWorkspace
            .toolbar(adaptiveLayoutMode == .compact ? .hidden : .visible, for: .navigationBar)
            .toolbar {
                if adaptiveLayoutMode == .split {
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button {
                            navigationPath.append(.allRecords)
                        } label: {
                            Label("全部记录", systemImage: "clock.arrow.circlepath")
                        }
                        .accessibilityIdentifier("record.all")
                        Button {
                            activeSheet = .startPractice
                        } label: {
                            Label("记录练习", systemImage: "figure.run")
                        }
                        .accessibilityIdentifier("record.practice")
                        Button {
                            activeSheet = .rehearsal
                        } label: {
                            Label("记录排练", systemImage: "person.3")
                        }
                        .accessibilityIdentifier("record.rehearsal")
                        Button {
                            activeSheet = .addContent
                        } label: {
                            Label("添加内容", systemImage: "plus")
                        }
                        .keyboardShortcut("n", modifiers: .command)
                        .accessibilityIdentifier("record.new")
                    }
                }
            }
            .navigationDestination(for: RecordDestination.self) { destination in
                recordDestination(destination)
                    .rootTabBarVisibility(.hidden)
            }
            .navigationDestination(isPresented: Binding(
                get: { overviewDetail != nil },
                set: { if !$0 { overviewDetail = nil } }
            )) {
                if let item = overviewDetail {
                    SimpleRecordDetailView(item: item) { materialId in
                        guard let selection = materialRecordSelection(materialId: materialId) else { return }
                        overviewMaterialRecords = selection
                    }
                    .rootTabBarVisibility(.hidden)
                }
            }
            .navigationDestination(isPresented: Binding(
                get: { overviewMaterialRecords != nil },
                set: { if !$0 { overviewMaterialRecords = nil } }
            )) {
                if let selection = overviewMaterialRecords {
                    MaterialRecordsView(
                        material: selection.material,
                        records: selection.records,
                        loadRecords: { try await container.repository.listPracticeRecords(materialId: selection.material.id) }
                    )
                    .rootTabBarVisibility(.hidden)
                }
            }
            .onChange(of: navigationPath) { _, _ in
                updateRootTabBarVisibility()
            }
            .onChange(of: overviewDetail?.id) { _, _ in
                updateRootTabBarVisibility()
            }
            .onChange(of: overviewMaterialRecords?.id) { _, _ in
                updateRootTabBarVisibility()
            }
            .overlay(alignment: .bottom) {
                if let viewModel {
                    RecordMessageBanner(viewModel: viewModel)
                        .padding(.bottom, AppTheme.bottomBarHeight + 24)
                }
            }
            .task {
                if let viewModel {
                    await viewModel.load()
                } else {
                    let next = container.makeRecordViewModel()
                    await next.load()
                    viewModelHolder.value = next
                }
            }
            .sheet(item: $activeSheet, onDismiss: {
                if let sheet = pendingSheet {
                    pendingSheet = nil
                    activeSheet = sheet
                } else if let destination = pendingDestination {
                    pendingDestination = nil
                    navigationPath.append(destination)
                }
            }) { sheet in
                switch sheet {
                case .addContent:
                    if let viewModel {
                        QuickAddSheet(viewModel: viewModel) {
                            pendingSheet = .startPractice
                        }
                    }
                case .startPractice:
                    StartPracticeSheet(
                        materials: viewModel?.materials.filter { !$0.referenceOnly } ?? [],
                        onStart: { material, mode in
                            guard viewModel?.startPractice(material: material, mode: mode) == true else { return false }
                            pendingDestination = mode == .session ? .materialDetail(material.id) : .practiceFeedback(material.id)
                            return true
                        }
                    )
                case .rehearsal:
                    RehearsalStartSheet(viewModel: viewModel) {
                        pendingDestination = .currentRehearsal
                    }
                case .todayInspirations:
                    RecordListSheet(
                        title: "今日灵感",
                        rows: viewModel?.todayInspirations.map { "\($0.title)：\($0.desc)" } ?? []
                    )
                case .todayRehearsals:
                    RecordListSheet(
                        title: "今日排练",
                        rows: viewModel?.todayRehearsals.map { "\($0.title)：\($0.goals.joined(separator: " / "))" } ?? []
                    )
                }
            }
            .onChange(of: activeSheet?.id) { _, sheetId in
                rootTabBar.setVisible(sheetId == nil)
            }
            .id(sessionRefreshToken)
        }
    }

    @ViewBuilder
    private var recordWorkspace: some View {
        if adaptiveLayoutMode == .split, let viewModel, viewModel.state == .loaded {
            RecordViewModelContent(viewModel: viewModel) { observedViewModel in
                NavigationSplitView {
                    AppPageShell(topInset: 32, onRefresh: {
                        await observedViewModel.load()
                    }) {
                        recordContextContent(observedViewModel)
                    }
                    .navigationTitle("记录")
                    .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 420)
                } detail: {
                    AppPageShell(topInset: 32, tracksRootTabBar: true, onRefresh: {
                        await observedViewModel.load()
                    }) {
                        recordPrimaryContent(observedViewModel)
                    }
                }
                .navigationSplitViewStyle(.prominentDetail)
            }
        } else {
            AppPageShell(topInset: 66, tracksRootTabBar: true, onRefresh: {
                await viewModel?.load()
            }) {
                VStack(spacing: 12) {
                    recordPageContent
                }
            }
        }
    }

    @ViewBuilder
    private var recordPageContent: some View {
        if let viewModel {
            switch viewModel.state {
            case .idle, .loading:
                LoadingCard(title: "加载记录中")
            case .failed(let message):
                EmptyStateCard(title: "记录加载失败", subtitle: message)
                PrimaryButton(title: "重试") { Task { await viewModel.load() } }
            case .empty(let message):
                EmptyStateCard(title: "暂无记录", subtitle: message)
            case .loaded:
                RecordViewModelContent(viewModel: viewModel) { observedViewModel in
                    recordPrimaryContent(observedViewModel)
                    todaySummary(observedViewModel)
                    sessionCards(observedViewModel)
                    recommendation(observedViewModel)
                }
            }
        } else {
            LoadingCard(title: "加载记录中")
        }
    }

    @ViewBuilder
    private func recordPrimaryContent(_ viewModel: RecordViewModel) -> some View {
        Text("快速记录")
            .font(.title.weight(.heavy))
            .frame(maxWidth: .infinity, alignment: .center)
        QuickRecordCard(viewModel: viewModel) {
            activeSheet = .addContent
        }
        recordActions(viewModel)
    }

    @ViewBuilder
    private func recordContextContent(_ viewModel: RecordViewModel) -> some View {
        Text("记录概览")
            .font(.title2.weight(.heavy))
            .frame(maxWidth: .infinity, alignment: .leading)
        Picker("记录概览", selection: selectedRecordContextBinding) {
            ForEach(RecordContext.allCases) { context in
                Text(context.title).tag(context)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("record.context")

        switch selectedRecordContext {
        case .today:
            todaySummary(viewModel)
            if viewModel.todayInspirations.isEmpty && viewModel.todayRehearsals.isEmpty {
                EmptyStateCard(title: "今天还没有记录", subtitle: "快速记下灵感，或开始一次练习。")
            }
        case .active:
            sessionCards(viewModel)
            if container.sessionStore.currentMaterial == nil && container.sessionStore.currentRehearsal == nil {
                EmptyStateCard(title: "没有进行中的任务", subtitle: "开始练习或排练后会固定显示在这里。")
            }
        case .recommendation:
            recommendation(viewModel)
            if !recommendationVisible || viewModel.recommendedMaterial == nil {
                EmptyStateCard(title: "暂无推荐", subtitle: "稍后回来看看新的练习素材。")
            }
        }
    }

    @ViewBuilder
    private func recommendation(_ viewModel: RecordViewModel) -> some View {
        if recommendationVisible, let material = viewModel.recommendedMaterial {
            RecommendationCard(material: material, onOpen: {
                navigationPath.append(.materialDetail(material.id))
            }) {
                recommendationVisible = false
            }
        }
    }

    private func updateRootTabBarVisibility() {
        rootTabBar.setVisible(
            navigationPath.isEmpty && overviewDetail == nil && overviewMaterialRecords == nil
        )
    }

    private var selectedRecordContext: RecordContext {
        RecordContext(rawValue: selectedRecordContextRawValue) ?? .today
    }

    private var selectedRecordContextBinding: Binding<RecordContext> {
        Binding(
            get: { selectedRecordContext },
            set: { selectedRecordContextRawValue = $0.rawValue }
        )
    }

    @ViewBuilder
    private func recordDestination(_ destination: RecordDestination) -> some View {
        switch destination {
        case .allRecords:
            RecordOverviewView(
                inspirations: viewModel?.inspirations ?? [],
                practiceRecords: viewModel?.practiceRecords ?? [],
                rehearsals: viewModel?.rehearsals ?? [],
                methodCards: viewModel?.methodCards ?? [],
                openDetail: { overviewDetail = $0 }
            )
        case .practiceRecords:
            PracticeRecordsView(
                records: viewModel?.practiceRecords ?? [],
                loadRecords: { try await container.repository.listPracticeRecords(materialId: nil) },
                onUpdateRecord: { record in
                    await viewModel?.updatePracticeRecord(record)
                },
                onDeleteRecord: { record in
                    await viewModel?.deletePracticeRecord(record) ?? false
                }
            )
        case .materialDetail(let materialId):
            if let material = viewModel?.materials.first(where: { $0.id == materialId }) {
                MaterialDetailHostView(material: material)
            } else {
                EmptyStateCard(title: "素材不存在", subtitle: "素材可能已被删除或尚未加载。")
            }
        case .practiceFeedback(let materialId):
            if let material = viewModel?.materials.first(where: { $0.id == materialId }) {
                PracticeFeedbackView(material: material, viewModel: container.makePracticeFeedbackViewModel())
            } else {
                EmptyStateCard(title: "素材不存在", subtitle: "素材可能已被删除或尚未加载。")
            }
        case .currentRehearsal:
            RehearsalView(viewModel: container.makeRehearsalViewModel())
        }
    }

}

private struct QuickRecordCard: View {
    @ObservedObject var viewModel: RecordViewModel
    let addAttachment: () -> Void

    var body: some View {
        AppCard {
            VStack(spacing: 12) {
                ZStack(alignment: .bottomTrailing) {
                    AppTextEditor(text: Binding(
                        get: { viewModel.quickText },
                        set: { viewModel.quickText = $0 }
                    ), placeholder: "记下刚刚闪过的想法", minHeight: 112)
                    .accessibilityIdentifier("record.quickText")

                    SmallPillButton(title: "+ 添加", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                        addAttachment()
                    }
                    .padding(12)
                    .keyboardShortcut("n", modifiers: .command)
                    .accessibilityIdentifier("record.addAttachment")
                }

                if !viewModel.quickAttachments.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(viewModel.quickAttachments) { attachment in
                            HStack {
                                Text(attachmentTitle(attachment))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                Spacer()
                                Button("删除") {
                                    viewModel.removeQuickAttachment(id: attachment.id)
                                }
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.error)
                            }
                        }
                    }
                }

                PrimaryButton(title: "保存灵感") {
                    Task { _ = await viewModel.saveQuickInspiration() }
                }
                .frame(maxWidth: 180)
                .disabled(viewModel.isSaving)
                .keyboardShortcut("s", modifiers: .command)
                .accessibilityIdentifier("record.save")
            }
        }
    }

    private func attachmentTitle(_ attachment: PracticeAttachment) -> String {
        switch attachment.type {
        case .image: "照片 · \(attachment.fileID)"
        case .video: "视频 · \(attachment.fileID)"
        case .audio: "录音 · \(Int(attachment.duration ?? 0)) 秒"
        }
    }
}

private extension RecordView {

    private func materialRecordSelection(materialId: String) -> MaterialRecordSelection? {
        guard let viewModel else { return nil }
        let material = viewModel.materials.first { $0.id == materialId }
            ?? viewModel.practiceRecords.first(where: { $0.materialId == materialId }).map {
                Material(id: materialId, title: $0.materialTitle, desc: "来自练习记录", type: .game)
            }
        guard let material else { return nil }
        return MaterialRecordSelection(
            material: material,
            records: viewModel.practiceRecords.filter { $0.materialId == materialId }
        )
    }

    private func recordActions(_ viewModel: RecordViewModel) -> some View {
        HStack(spacing: 8) {
            ActionChip(title: "全部记录", prominent: true) {
                navigationPath.append(.allRecords)
            }
            .accessibilityIdentifier("record.all")
            ActionChip(title: "记录练习", prominent: true) {
                activeSheet = .startPractice
            }
            .accessibilityIdentifier("record.practice")
            ActionChip(title: "记录排练", prominent: true) {
                activeSheet = .rehearsal
            }
            .accessibilityIdentifier("record.rehearsal")
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func sessionCards(_ viewModel: RecordViewModel) -> some View {
        if let session = container.sessionStore.currentMaterial,
           let material = viewModel.materials.first(where: { $0.id == session.materialId }) {
            AppCard(padding: 0) {
                ZStack(alignment: .trailing) {
                    LinearGradient(
                        colors: [
                            AppTheme.orangeSoft,
                            AppTheme.elevatedCardBackground
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    VStack(alignment: .leading, spacing: 8) {
                        Text(session.status == .paused ? "暂停中的素材练习" : "进行中的素材练习")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(material.title)
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("结束后进入素材练习复盘。")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    SmallPillButton(title: "去复盘", tone: AppTheme.orange, fill: AppTheme.orangeSoft) {
                        navigationPath.append(.practiceFeedback(material.id))
                    }
                    .padding(.trailing, 18)
                }
                .frame(minHeight: 112)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        } else if let rehearsal = container.sessionStore.currentRehearsal {
            AppCard {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(rehearsal.status == .paused ? "暂停中的排练" : "进行中的排练")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(rehearsal.title)
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("目标：\(rehearsal.goals.joined(separator: " / "))")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                            .lineLimit(2)
                    }
                    Spacer()
                    SmallPillButton(title: "继续") {
                        navigationPath.append(.currentRehearsal)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func todaySummary(_ viewModel: RecordViewModel) -> some View {
        let inspirationCount = viewModel.todayInspirations.count
        let rehearsalCount = viewModel.todayRehearsals.count
        if inspirationCount > 0 || rehearsalCount > 0 {
            HStack(spacing: 0) {
                Text("今天已记录")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                Button("\(inspirationCount) 条灵感") {
                    activeSheet = .todayInspirations
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(AppTheme.blue)
                Text("，")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                Button("\(rehearsalCount) 次练习") {
                    activeSheet = .todayRehearsals
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(AppTheme.blue)
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}

private enum RecordSheet: Identifiable {
    case addContent
    case startPractice
    case rehearsal
    case todayInspirations
    case todayRehearsals

    var id: String {
        switch self {
        case .addContent: "addContent"
        case .startPractice: "startPractice"
        case .rehearsal: "rehearsal"
        case .todayInspirations: "todayInspirations"
        case .todayRehearsals: "todayRehearsals"
        }
    }
}

private enum RecordDestination: Hashable {
    case allRecords
    case practiceRecords
    case materialDetail(String)
    case practiceFeedback(String)
    case currentRehearsal
}

private enum RecordContext: String, CaseIterable, Identifiable {
    case today
    case active
    case recommendation

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "今日"
        case .active: "进行中"
        case .recommendation: "推荐"
        }
    }
}

private struct RecommendationCard: View {
    let material: Material
    let onOpen: () -> Void
    let onClose: () -> Void

    var body: some View {
        AppCard(padding: 0) {
            ZStack(alignment: .topTrailing) {
                LinearGradient(
                    colors: [
                        AppTheme.orangeSoft,
                        AppTheme.elevatedCardBackground
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                Button(action: onOpen) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("今日推荐")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(material.title)
                            .font(.title3.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(material.desc)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                            .multilineTextAlignment(.leading)
                            .lineLimit(2)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                }
                .buttonStyle(.plain)

                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(AppTheme.textSecondary)
                        .frame(width: 28, height: 28)
                        .background(AppTheme.elevatedCardBackground.opacity(0.84), in: Circle())
                }
                .buttonStyle(.plain)
                .padding(12)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

private struct QuickAddSheet: View {
    @ObservedObject var viewModel: RecordViewModel
    let openPractice: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedLibraryItem: PhotosPickerItem?
    @State private var audioRecorderVisible = false
    @State private var cameraVisible = false
    @State private var cameraMode: CameraCaptureMode = .photo

    var body: some View {
        NavigationStack {
            AppPageShell(bottomInset: 24) {
                VStack(alignment: .leading, spacing: 18) {
                    PageTitle(title: "添加")
                Text("练习复盘")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textSecondary)
                AppCard {
                    Button {
                        dismiss()
                        openPractice()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("选素材练习")
                                    .font(.headline.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                                Text("先选素材，照片、视频或录音会保存到练习复盘。")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(AppTheme.textMuted)
                        }
                    }
                    .buttonStyle(.plain)
                }

                HStack(alignment: .firstTextBaseline) {
                    Text("先记下来")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textSecondary)
                    Spacer()
                    Text("保存后进入待整理")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textMuted)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    PhotosPicker(selection: $selectedLibraryItem, matching: .any(of: [.images, .videos])) {
                        QuickToolContent(title: "相册", systemImage: "photo", desc: "选择照片或视频")
                    }
                    .buttonStyle(.plain)
                    .onChange(of: selectedLibraryItem) { _, item in
                        guard let item else { return }
                        addPickedLibraryItem(item)
                    }
                    quickTool("拍照", systemImage: "camera") {
                        cameraMode = .photo
                        cameraVisible = true
                    }
                    quickTool("拍视频", systemImage: "video") {
                        cameraMode = .video
                        cameraVisible = true
                    }
                    quickTool("录音", systemImage: "waveform") {
                        audioRecorderVisible = true
                    }
                }

                    if viewModel.isUploadingMedia {
                        ProgressView("正在保存媒体")
                            .frame(maxWidth: .infinity)
                    }

                }
            }
            .navigationDestination(isPresented: $audioRecorderVisible) {
                AudioRecorderSheet(title: "录音") { url, duration in
                    saveMedia(url: url, type: .audio, duration: duration)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .fullScreenCover(isPresented: $cameraVisible) {
            CameraCaptureView(mode: cameraMode) { url, type in
                saveMedia(url: url, type: type)
            }
        }
    }

    private func quickTool(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            QuickToolContent(title: title, systemImage: systemImage, desc: "保存后进入待整理")
        }
        .buttonStyle(.plain)
    }

    private func addPickedLibraryItem(_ item: PhotosPickerItem) {
        let isVideo = item.supportedContentTypes.contains { $0.conforms(to: .movie) }
        let type: AttachmentType = isVideo ? .video : .image
        Task {
            defer { selectedLibraryItem = nil }
            guard let url = try? await importedMediaURL(from: item, type: type) else { return }
            saveMedia(url: url, type: type)
        }
    }

    private func saveMedia(url: URL, type: AttachmentType, duration: TimeInterval? = nil) {
        Task {
            guard await viewModel.saveQuickMedia(localURL: url, type: type, duration: duration) else { return }
            dismiss()
        }
    }
}

private struct RecordViewModelContent<Content: View>: View {
    @ObservedObject var viewModel: RecordViewModel
    private let content: (RecordViewModel) -> Content

    init(viewModel: RecordViewModel, @ViewBuilder content: @escaping (RecordViewModel) -> Content) {
        self.viewModel = viewModel
        self.content = content
    }

    var body: some View {
        content(viewModel)
    }
}

private struct RecordMessageBanner: View {
    @ObservedObject var viewModel: RecordViewModel

    var body: some View {
        MessageBanner(message: viewModel.message)
    }
}

private struct QuickToolContent: View {
    let title: String
    let systemImage: String
    let desc: String

    var body: some View {
        AppCard(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: systemImage)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(AppTheme.blue)
                Text(title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                Text(desc)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }
}

private struct StartPracticeSheet: View {
    let materials: [Material]
    let onStart: (Material, PracticeStartMode) -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var selectedMaterial: Material?
    @State private var mode: PracticeStartMode = .session

    private var visibleMaterials: [Material] {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return materials }
        return materials.filter { material in
            ([material.title, material.desc] + material.tags + material.abilities + material.scenes)
                .joined(separator: " ")
                .localizedCaseInsensitiveContains(clean)
        }
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                SheetTitleBar("快速开始练习") { dismiss() }
                AppCard(padding: 14) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(AppTheme.textSecondary)
                        TextField("搜索素材、能力或目标", text: $query)
                            .font(.subheadline.weight(.semibold))
                    }
                }

                Picker("记录方式", selection: $mode) {
                    Text("开始练习").tag(PracticeStartMode.session)
                    Text("直接复盘").tag(PracticeStartMode.immediateFeedback)
                }
                .pickerStyle(.segmented)

                if visibleMaterials.isEmpty {
                    EmptyStateCard(title: "没有可练习素材", subtitle: "路径素材不会进入练习，先添加或放宽搜索。")
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(visibleMaterials) { material in
                            Button {
                                selectedMaterial = material
                            } label: {
                                AppCard {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 8) {
                                            Text(material.title)
                                                .font(.headline.weight(.heavy))
                                                .foregroundStyle(AppTheme.textPrimary)
                                            Text(material.desc)
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(AppTheme.textSecondary)
                                                .lineLimit(2)
                                        }
                                        Spacer()
                                        if selectedMaterial?.id == material.id {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(AppTheme.orange)
                                        }
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                PrimaryButton(title: "开始练习") {
                    guard let selectedMaterial else { return }
                    guard onStart(selectedMaterial, mode) else { return }
                    dismiss()
                }
                .disabled(selectedMaterial == nil)
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

private struct RecordOverviewView: View {
    let inspirations: [Inspiration]
    let practiceRecords: [PracticeRecord]
    let rehearsals: [Rehearsal]
    let methodCards: [MethodCard]
    let openDetail: (OverviewItem) -> Void
    @State private var filter = "全部"

    private var items: [OverviewItem] {
        let all = (inspirations.map {
            OverviewItem(
                title: $0.title,
                desc: $0.desc,
                kind: "灵感",
                meta: overviewMeta($0),
                createdAt: $0.createdAt,
                hasMedia: !$0.attachments.isEmpty,
                pending: $0.meta.contains("待整理")
            )
        }
            + practiceRecords.map {
                OverviewItem(
                    title: $0.materialTitle,
                    desc: $0.note,
                    kind: "素材练习",
                    meta: overviewMeta($0),
                    createdAt: $0.createdAt,
                    hasMedia: !$0.attachments.isEmpty,
                    pending: true,
                    materialId: $0.materialId
                )
            }
            + rehearsals.map {
            OverviewItem(
                title: $0.title,
                desc: $0.reviewReminder.isEmpty ? $0.goals.joined(separator: " / ") : $0.reviewReminder,
                kind: "排练",
                    meta: [$0.status.rawValue] + Array($0.goals.prefix(2)),
                createdAt: $0.createdAt,
                hasMedia: false,
                pending: $0.status == .completed
            )
            }
            + methodCards.map {
                OverviewItem(
                    title: $0.title,
                    desc: $0.desc,
                    kind: "方法卡",
                    meta: [$0.sourceDisplayLabel].compactMap { $0 },
                    createdAt: $0.createdAt,
                    hasMedia: false,
                    pending: false
                )
            })
            .sorted { $0.createdAt > $1.createdAt }
        guard filter != "全部" else { return all }
        return all.filter { $0.kind == filter || (filter == "有媒体" && $0.hasMedia) || (filter == "待整理" && $0.pending) }
    }

    private var summary: (total: Int, inspiration: Int, practice: Int, rehearsal: Int, method: Int) {
        (
            inspirations.count + practiceRecords.count + rehearsals.count + methodCards.count,
            inspirations.count,
            practiceRecords.count,
            rehearsals.count,
            methodCards.count
        )
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "全部记录")
                overviewSummary
                FlowWrap(spacing: 8, rowSpacing: 8) {
                    ForEach(["全部", "灵感", "素材练习", "排练", "方法卡", "有媒体", "待整理"], id: \.self) { option in
                        ActionChip(title: option, selected: filter == option) {
                            filter = option
                        }
                    }
                }

                if items.isEmpty {
                    EmptyStateCard(title: "暂无记录", subtitle: "记录灵感、素材练习或排练后会出现在这里。")
                } else {
                    ForEach(items) { item in
                        Button {
                            openDetail(item)
                        } label: {
                            AppCard {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(item.kind)
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(AppTheme.blue)
                                            .padding(.horizontal, 9)
                                            .padding(.vertical, 5)
                                            .background(AppTheme.blueSoft, in: Capsule())
                                        Spacer()
                                        Text(item.dateLabel)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(AppTheme.textMuted)
                                    }
                                    Text(item.title)
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(item.desc)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                        .lineLimit(2)
                                    if !item.meta.isEmpty {
                                        FlowWrap(spacing: 6, rowSpacing: 6) {
                                            ForEach(item.meta.prefix(4), id: \.self) { meta in
                                                DisplayTag(title: meta, tone: AppTheme.textSecondary, fill: AppTheme.cardBackground)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .rootTabBarVisibility(.hidden)
    }

    private var overviewSummary: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("总览")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text("\(summary.total) 条记录")
                            .font(.title2.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                    }
                    Spacer()
                    Text(filter)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.blue)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(AppTheme.blueSoft, in: Capsule())
                }
                HStack {
                    summaryMetric(value: summary.inspiration, label: "灵感")
                    summaryMetric(value: summary.practice, label: "素材练习")
                    summaryMetric(value: summary.rehearsal, label: "排练")
                    summaryMetric(value: summary.method, label: "方法卡")
                }
            }
        }
    }

    private func summaryMetric(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.title3.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.76)
        }
        .frame(maxWidth: .infinity)
    }

    private func overviewMeta(_ inspiration: Inspiration) -> [String] {
        var meta = inspiration.meta
        if !inspiration.attachments.isEmpty {
            meta.insert(attachmentSummary(inspiration.attachments), at: 0)
        }
        return Array(meta.filter { !$0.isEmpty }.prefix(5))
    }

    private func overviewMeta(_ record: PracticeRecord) -> [String] {
        var meta = ["\(record.score) 分"] + record.meta
        if !record.attachments.isEmpty {
            meta.append(attachmentSummary(record.attachments))
        }
        return Array(meta.filter { !$0.isEmpty }.prefix(5))
    }

    private func attachmentSummary(_ attachments: [PracticeAttachment]) -> String {
        let imageCount = attachments.filter { $0.type == .image }.count
        let videoCount = attachments.filter { $0.type == .video }.count
        let audioCount = attachments.filter { $0.type == .audio }.count
        let parts = [
            imageCount > 0 ? "\(imageCount) 张照片" : "",
            videoCount > 0 ? "\(videoCount) 个视频" : "",
            audioCount > 0 ? "\(audioCount) 段音频" : ""
        ].filter { !$0.isEmpty }
        return parts.isEmpty ? "有媒体" : parts.joined(separator: " · ")
    }

}

private struct OverviewItem: Identifiable {
    let id = UUID()
    let title: String
    let desc: String
    let kind: String
    let meta: [String]
    var createdAt = Date.distantPast
    var hasMedia = false
    var pending = false
    var materialId = ""

    var dateLabel: String {
        guard createdAt > Date.distantPast else { return "-" }
        let components = Calendar.current.dateComponents([.month, .day], from: createdAt)
        return "\(components.month ?? 0)月\(components.day ?? 0)日"
    }
}

private struct MaterialRecordSelection: Identifiable {
    var id: String { material.id }
    let material: Material
    let records: [PracticeRecord]
}

private struct SimpleRecordDetailView: View {
    let item: OverviewItem
    let openMaterialRecords: (String) -> Void

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "记录详情")
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(item.kind)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(item.title)
                            .font(.title2.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(item.desc.isEmpty ? "暂无详情" : item.desc)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        if !item.meta.isEmpty {
                            FlowWrap(spacing: 6, rowSpacing: 6) {
                                ForEach(item.meta.prefix(4), id: \.self) { meta in
                                    DisplayTag(title: meta)
                                }
                            }
                        }
                        if item.kind == "素材练习", !item.materialId.isEmpty {
                            PrimaryButton(title: "查看该素材全部记录") {
                                openMaterialRecords(item.materialId)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("记录详情")
        .navigationBarTitleDisplayMode(.inline)
        .rootTabBarVisibility(.hidden)
    }
}

private struct RecordListSheet: View {
    let title: String
    let rows: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 16) {
                PageTitle(title: title)
                if rows.isEmpty {
                    EmptyStateCard(title: "暂无内容", subtitle: "保存记录后会出现在这里。")
                } else {
                    ForEach(rows, id: \.self) { row in
                        AppCard {
                            Text(row)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

private struct RehearsalStartSheet: View {
    let viewModel: RecordViewModel?
    let onStarted: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var teamName = ""
    @State private var duration = "90 分钟"
    @State private var customDuration = ""
    @State private var isCustomDurationSelected = false
    @State private var isCustomDurationExpanded = false
    @State private var selectedGoals: Set<String> = ["身体到场"]
    @State private var customGoal = ""
    @State private var isCustomGoalSelected = false
    @State private var isCustomGoalExpanded = false
    @State private var source: RehearsalSource = .recommended

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                SheetTitleBar("快速开启排练") { dismiss() }
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("团队或排练名称（可选）")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("先定一个轻量目标，现场中可以继续加素材和写 Keep / Try。")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        TextField("例如：周三剧团", text: $teamName)
                            .textFieldStyle(AppTextFieldStyle())

                        Text("时长")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        FlowWrap(spacing: 8, rowSpacing: 8) {
                            ForEach(["60 分钟", "90 分钟", "120 分钟"], id: \.self) { option in
                                ActionChip(title: option, selected: !isCustomDurationSelected && duration == option) {
                                    duration = option
                                    isCustomDurationSelected = false
                                    isCustomDurationExpanded = false
                                }
                            }
                            ActionChip(title: customDurationChipTitle, selected: isCustomDurationSelected) {
                                toggleCustomDuration()
                            }
                        }
                        if isCustomDurationExpanded {
                            TextField("输入分钟数", text: $customDuration)
                                .keyboardType(.numberPad)
                                .textFieldStyle(AppTextFieldStyle())
                                .onChange(of: customDuration) { _, value in
                                    let digits = value.filter(\.isNumber)
                                    if digits != value { customDuration = digits }
                                    isCustomDurationSelected = true
                                }
                        }

                        Text("本次目标")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        FlowWrap(spacing: 8, rowSpacing: 8) {
                            ForEach(["身体到场", "关系建立", "叙事", "演出前", "复盘"], id: \.self) { goal in
                                ActionChip(title: goal, selected: selectedGoals.contains(goal)) {
                                    toggleGoal(goal)
                                }
                            }
                            ActionChip(title: customGoalChipTitle, selected: isCustomGoalSelected) {
                                toggleCustomGoal()
                            }
                        }
                        if isCustomGoalExpanded {
                            TextField("例如：默契升温", text: $customGoal)
                                .textFieldStyle(AppTextFieldStyle())
                                .onChange(of: customGoal) { _, value in
                                    isCustomGoalSelected = !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("素材来源")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textSecondary)
                    Picker("素材来源", selection: $source) {
                        Text("推荐 3 个").tag(RehearsalSource.recommended)
                        Text("收藏 3 个").tag(RehearsalSource.saved)
                        Text("空白开始").tag(RehearsalSource.blank)
                    }
                    .pickerStyle(.segmented)
                    Text(sourceDescription)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }

                PrimaryButton(title: "快速开启排练") {
                    Task {
                        guard await viewModel?.startRehearsal(
                            teamName: teamName,
                            duration: rehearsalDuration,
                            goals: rehearsalGoals,
                            source: source
                        ) == true else { return }
                        onStarted()
                        dismiss()
                    }
                }
                .disabled(viewModel?.isSaving == true || !canStartRehearsal)
                if let message = viewModel?.message {
                    Text(message)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func toggleGoal(_ goal: String) {
        if selectedGoals.contains(goal) {
            selectedGoals.remove(goal)
        } else {
            selectedGoals.insert(goal)
        }
    }

    private func toggleCustomDuration() {
        if isCustomDurationSelected {
            isCustomDurationExpanded.toggle()
        } else {
            isCustomDurationSelected = true
            isCustomDurationExpanded = true
        }
    }

    private func toggleCustomGoal() {
        if isCustomGoalSelected {
            isCustomGoalExpanded.toggle()
        } else {
            isCustomGoalSelected = true
            isCustomGoalExpanded = true
        }
    }

    private var customDurationChipTitle: String {
        isCustomDurationSelected && !customDuration.isEmpty ? "\(customDuration) 分钟" : "+ 自定义"
    }

    private var customGoalChipTitle: String {
        isCustomGoalSelected && !customGoal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? customGoal : "+ 自定义"
    }

    private var rehearsalDuration: String {
        isCustomDurationSelected && !customDuration.isEmpty ? "\(customDuration) 分钟" : duration
    }

    private var rehearsalGoals: [String] {
        let custom = isCustomGoalSelected ? customGoal.trimmingCharacters(in: .whitespacesAndNewlines) : ""
        return Array(selectedGoals.union(custom.isEmpty ? [] : [custom])).sorted()
    }

    private var canStartRehearsal: Bool {
        !isCustomDurationSelected || !customDuration.isEmpty
    }

    private var sourceDescription: String {
        switch source {
        case .recommended:
            "从可练素材中随机推荐 3 个。"
        case .saved:
            "从已收藏素材中选择 3 个；没有收藏时不会开始。"
        case .blank:
            "不预置素材，进入排练后再添加。"
        }
    }
}
