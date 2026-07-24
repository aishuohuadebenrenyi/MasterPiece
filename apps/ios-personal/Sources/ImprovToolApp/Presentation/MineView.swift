import SwiftUI
import PhotosUI

struct MineView: View {
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @EnvironmentObject private var container: AppContainer
    @EnvironmentObject private var rootTabBar: RootTabBarVisibility
    var openDiscover: () -> Void = {}
    var openRecord: () -> Void = {}
    @StateObject private var viewModelHolder = Holder<MineViewModel>()
    @State private var activeSheet: MineSheet?
    @State private var navigationPath: [MineDestination] = []
    @State private var methodCardDetail: MethodCard?
    @State private var rehearsalDetail: Rehearsal?
    @SceneStorage("improvtool.mine.section") private var selectedMineSectionRawValue: String?

    private var viewModel: MineViewModel? { viewModelHolder.value }
    private var selectedMineSection: MineDestination? {
        selectedMineSectionRawValue.flatMap(MineDestination.init(rawValue:))
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            mineWorkspace
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if adaptiveLayoutMode != .split {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            navigationPath.append(.settings)
                        } label: {
                            Label("设置", systemImage: "gearshape")
                        }
                    }
                }
            }
            .navigationDestination(for: MineDestination.self) { destination in
                mineDestination(destination)
                    .rootTabBarVisibility(.hidden)
            }
            .navigationDestination(isPresented: Binding(
                get: { adaptiveLayoutMode != .split && methodCardDetail != nil },
                set: { if !$0 { methodCardDetail = nil } }
            )) {
                if let card = methodCardDetail, let viewModel {
                    MethodCardDetailView(card: card, viewModel: viewModel)
                        .rootTabBarVisibility(.hidden)
                }
            }
            .navigationDestination(isPresented: Binding(
                get: { adaptiveLayoutMode != .split && rehearsalDetail != nil },
                set: { if !$0 { rehearsalDetail = nil } }
            )) {
                if let rehearsal = rehearsalDetail {
                    RehearsalDetailView(rehearsal: rehearsal)
                    .rootTabBarVisibility(.hidden)
                }
            }
            .onChange(of: navigationPath) { _, _ in
                updateRootTabBarVisibility()
            }
            .onChange(of: methodCardDetail?.id) { _, _ in
                updateRootTabBarVisibility()
            }
            .onChange(of: rehearsalDetail?.id) { _, _ in
                updateRootTabBarVisibility()
            }
            .overlay(alignment: .bottom) {
                MessageBanner(message: viewModel?.message)
                    .padding(.bottom, AppTheme.bottomBarHeight + 24)
            }
            .task {
                if let viewModel {
                    await viewModel.load()
                    viewModelHolder.objectWillChange.send()
                } else {
                    let next = container.makeMineViewModel()
                    await next.load()
                    viewModelHolder.value = next
                }
            }
            .sheet(item: $activeSheet) { sheet in
                mineSheet(sheet)
            }
            .onChange(of: activeSheet?.id) { _, sheetId in
                rootTabBar.setVisible(sheetId == nil)
            }
        }
    }

    @ViewBuilder
    private var mineWorkspace: some View {
        if adaptiveLayoutMode == .split, let viewModel {
            NavigationSplitView {
                AppPageShell(tracksRootTabBar: true, onRefresh: {
                    await viewModel.load()
                }) {
                    mineSplitSidebar(viewModel)
                }
                .navigationTitle("我的")
                .navigationSplitViewColumnWidth(min: 300, ideal: 340, max: 420)
            } detail: {
                mineSplitDetail(viewModel)
            }
            .navigationSplitViewStyle(.balanced)
        } else {
            AppPageShell(tracksRootTabBar: true, onRefresh: {
                await viewModel?.load()
            }) {
                mineCompactContent
            }
        }
    }

    @ViewBuilder
    private var mineCompactContent: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let viewModel {
                switch viewModel.state {
                case .idle, .loading:
                    LoadingCard(title: "加载个人空间中")
                case .failed(let message):
                    EmptyStateCard(title: "个人空间加载失败", subtitle: message)
                    PrimaryButton(title: "重试") { Task { await viewModel.load() } }
                default:
                    mineProfileSummary(viewModel)
                }

                Text("个人沉淀")
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textSecondary)
                    .padding(.top, 4)
                mineAssetDirectory(viewModel, usesSplitSelection: false)
            } else {
                LoadingCard(title: "加载个人空间中")
            }
        }
    }

    @ViewBuilder
    private func mineSplitSidebar(_ viewModel: MineViewModel) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            mineProfileSummary(viewModel)
            Text("资产目录")
                .font(.headline.weight(.heavy))
                .foregroundStyle(AppTheme.textSecondary)
            mineAssetDirectory(viewModel, usesSplitSelection: true)
            Button {
                selectMineSection(.settings, usesSplitSelection: true)
            } label: {
                AppCard {
                    Label("设置", systemImage: "gearshape")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(AppTheme.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private func mineProfileSummary(_ viewModel: MineViewModel) -> some View {
        let totalRecords = viewModel.inspirations.count + viewModel.practiceRecords.count + viewModel.rehearsals.count
        ProfileCard(profile: viewModel.profile) {
            activeSheet = .profile
        }
        StatsCard(
            totalRecords: totalRecords,
            practicedMaterials: viewModel.practicedMaterialCount,
            methodCards: viewModel.methodCards.count
        )
        if viewModel.pendingRecordCount > 0 {
            PendingCard(count: viewModel.pendingRecordCount) {
                selectMineSection(.pending, usesSplitSelection: adaptiveLayoutMode == .split)
            }
        }
    }

    @ViewBuilder
    private func mineAssetDirectory(_ viewModel: MineViewModel, usesSplitSelection: Bool) -> some View {
        VStack(spacing: 14) {
            if viewModel.methodCards.isEmpty && viewModel.inspirations.isEmpty && viewModel.practiceRecords.isEmpty && viewModel.rehearsals.isEmpty {
                MineIntroCard(openDiscover: openDiscover, openRecord: openRecord)
            }
            if !viewModel.methodCards.isEmpty {
                MineAssetCard(title: "方法卡", count: viewModel.methodCards.count, subtitle: "下次可直接复用的带练提示", tags: ["带领提醒", "素材改造", "排练复盘"]) {
                    selectMineSection(.methodCards, usesSplitSelection: usesSplitSelection)
                }
            }
            if !viewModel.inspirations.isEmpty {
                MineAssetCard(title: "灵感记录", count: viewModel.inspirations.count, tags: ["灵感", "待整理"]) {
                    selectMineSection(.inspirations, usesSplitSelection: usesSplitSelection)
                }
            }
            if !viewModel.practiceRecords.isEmpty {
                MineAssetCard(title: "素材练习记录", count: viewModel.practiceRecords.count, tags: ["练习", "复盘"]) {
                    selectMineSection(.practiceRecords, usesSplitSelection: usesSplitSelection)
                }
            }
            if !viewModel.rehearsals.isEmpty {
                MineAssetCard(title: "排练记录", count: viewModel.rehearsals.count, tags: ["个人", "过程"]) {
                    selectMineSection(.rehearsals, usesSplitSelection: usesSplitSelection)
                }
            }
        }
    }

    private func selectMineSection(_ destination: MineDestination, usesSplitSelection: Bool) {
        methodCardDetail = nil
        rehearsalDetail = nil
        if usesSplitSelection {
            selectedMineSectionRawValue = destination.rawValue
        } else {
            navigationPath.append(destination)
        }
    }

    @ViewBuilder
    private func mineSplitDetail(_ viewModel: MineViewModel) -> some View {
        if let methodCardDetail {
            MethodCardDetailView(card: methodCardDetail, viewModel: viewModel)
        } else if let rehearsalDetail {
            RehearsalDetailView(rehearsal: rehearsalDetail)
        } else if let selectedMineSection {
            mineDestination(selectedMineSection)
        } else {
            AppPageShell {
                EmptyStateCard(title: "选择一项资产", subtitle: "在左侧打开待整理、方法卡、练习记录、排练记录或设置。")
            }
        }
    }

    private func updateRootTabBarVisibility() {
        rootTabBar.setVisible(
            navigationPath.isEmpty && methodCardDetail == nil && rehearsalDetail == nil
        )
    }

    @ViewBuilder
    private func mineDestination(_ destination: MineDestination) -> some View {
        switch destination {
        case .settings:
            SettingsSheet(dismissBeforeOpen: false) { nextSheet in
                switch nextSheet {
                case .help:
                    navigationPath.append(.help)
                case .privacy:
                    navigationPath.append(.privacy)
                case .feedback, .deleteAccount:
                    activeSheet = nextSheet
                default:
                    activeSheet = nextSheet
                }
            }
        case .practiceRecords:
            PracticeRecordsView(
                records: viewModel?.practiceRecords ?? [],
                loadRecords: { try await container.repository.listPracticeRecords(materialId: nil) },
                onUpdateRecord: { record in
                    await viewModel?.updatePracticeRecord(record)
                },
                onDeleteRecord: { record in
                    await viewModel?.deletePracticeRecord(record) ?? false
                },
                openRecord: openRecord,
                openDiscover: openDiscover
            )
        case .rehearsals:
            RehearsalRecordsView(
                rehearsals: viewModel?.rehearsals ?? [],
                onDeleteRehearsal: { rehearsal in
                    await viewModel?.deleteRehearsal(rehearsal) ?? false
                },
                openRecord: openRecord,
                openDiscover: openDiscover,
                openDetail: { rehearsalDetail = $0 }
            )
        case .methodCards:
            if let viewModel {
                MethodCardsView(viewModel: viewModel) { methodCardDetail = $0 }
            }
        case .pending:
            if let viewModel {
                PendingRecordsView(viewModel: viewModel)
            }
        case .inspirations:
            if let viewModel {
                InspirationRecordsView(title: "灵感记录", inspirations: viewModel.inspirations, viewModel: viewModel)
            }
        case .help:
            HelpSheet()
        case .privacy:
            PrivacySheet()
        }
    }

    @ViewBuilder
    private func mineSheet(_ sheet: MineSheet) -> some View {
        switch sheet {
        case .settings:
            SettingsSheet { nextSheet in
                activeSheet = nextSheet
            }
        case .profile:
            if let viewModel {
                ProfileEditSheet(viewModel: viewModel)
            }
        case .practiceRecords:
            PracticeRecordsView(
                records: viewModel?.practiceRecords ?? [],
                loadRecords: { try await container.repository.listPracticeRecords(materialId: nil) },
                onUpdateRecord: { record in
                    await viewModel?.updatePracticeRecord(record)
                },
                onDeleteRecord: { record in
                    await viewModel?.deletePracticeRecord(record) ?? false
                },
                openRecord: {
                    activeSheet = nil
                    openRecord()
                },
                openDiscover: {
                    activeSheet = nil
                    openDiscover()
                }
            )
        case .help:
            HelpSheet()
        case .privacy:
            PrivacySheet()
        case .feedback:
            if let viewModel {
                FeedbackSheet(viewModel: viewModel)
            } else {
                SimpleMineSheet(title: "意见反馈", message: "个人空间加载后可以提交反馈。")
            }
        case .deleteAccount:
            if let viewModel {
                DeleteAccountSheet(viewModel: viewModel)
            }
        }
    }
}

private enum MineSheet: String, Identifiable {
    case settings
    case profile
    case practiceRecords
    case help
    case privacy
    case feedback
    case deleteAccount

    var id: String { rawValue }
}

private enum MineDestination: String, Hashable {
    case settings
    case practiceRecords
    case rehearsals
    case methodCards
    case pending
    case inspirations
    case help
    case privacy
}

private struct ProfileCard: View {
    let profile: Profile
    let onEdit: () -> Void

    var body: some View {
        AppCard {
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(AppTheme.blue)
                    if profile.avatarUrl.isEmpty {
                        Text("即兴")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.onPrimary)
                    } else {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.largeTitle.weight(.semibold))
                            .foregroundStyle(AppTheme.onPrimary)
                    }
                }
                .frame(width: 74, height: 74)

                VStack(alignment: .leading, spacing: 8) {
                    Text(profile.displayName)
                        .font(.title3.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    HStack(spacing: 8) {
                        Text("即兴现场")
                        Text(profile.troupeName.isEmpty ? "个人空间" : profile.troupeName)
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(AppTheme.blueSoft, in: Capsule())
                }

                Spacer()

                SmallPillButton(title: "编辑") {
                    onEdit()
                }
            }
        }
    }
}

private struct StatsCard: View {
    let totalRecords: Int
    let practicedMaterials: Int
    let methodCards: Int

    var body: some View {
        AppCard {
            HStack {
                stat(value: totalRecords, label: "累计记录")
                Divider().frame(height: 38)
                stat(value: practicedMaterials, label: "练过素材")
                Divider().frame(height: 38)
                stat(value: methodCards, label: "方法卡")
            }
        }
    }

    private func stat(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.title.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct PendingCard: View {
    let count: Int
    let action: () -> Void

    var body: some View {
        AppCard(padding: 0) {
            ZStack(alignment: .trailing) {
                LinearGradient(
                    colors: [
                        AppTheme.blueSoft,
                        AppTheme.orangeSoft
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                VStack(alignment: .leading, spacing: 10) {
                    Text("待整理")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.textSecondary)
                    Text("\(count) 条可沉淀记录")
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    HStack(spacing: 8) {
                        Text("灵感")
                        Text("素材练习")
                        Text("排练复盘")
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppTheme.blue)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)

                SmallPillButton(title: "整理") {
                    action()
                }
                .padding(.trailing, 18)
            }
            .frame(minHeight: 128)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

private struct MineIntroCard: View {
    let openDiscover: () -> Void
    let openRecord: () -> Void

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("你的记录与方法卡")
                        .font(.title3.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Text("灵感、练习和排练记录会沉到这里。")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }

                HStack(spacing: 8) {
                    Text("方法卡")
                    Text("灵感回看")
                    Text("排练记录")
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(AppTheme.blue)

                HStack(spacing: 12) {
                    SmallPillButton(title: "去发现") {
                        openDiscover()
                    }
                    PrimaryButton(title: "去记录") {
                        openRecord()
                    }
                    .frame(maxWidth: 150)
                }
            }
        }
    }
}

private struct MineAssetCard: View {
    let title: String
    let count: Int
    var subtitle: String? = nil
    let tags: [String]
    let action: () -> Void

    var body: some View {
        AppCard {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(title)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppTheme.textSecondary)
                    Text("\(count) \(title == "方法卡" ? "张方法卡" : "条记录")")
                        .font(.title2.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    if let subtitle {
                        Text(subtitle)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                    HStack(spacing: 6) {
                        ForEach(tags.prefix(3), id: \.self) { tag in
                            DisplayTag(title: tag)
                        }
                    }
                }
                Spacer()
                SmallPillButton(title: "查看") {
                    action()
                }
                .accessibilityIdentifier("mine.asset.\(title)")
            }
        }
    }
}

private struct SettingsSheet: View {
    var dismissBeforeOpen = true
    let open: (MineSheet) -> Void
    @EnvironmentObject private var container: AppContainer
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section("帮助") {
                Button("使用帮助") { openDestination(.help) }
                    .accessibilityIdentifier("settings.help")
                Button("意见反馈") { openDestination(.feedback) }
                    .accessibilityIdentifier("settings.feedback")
            }

            Section("偏好") {
                Picker("外观主题", selection: $container.theme) {
                    ForEach(AppVisualTheme.allCases) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                Text(container.theme == .vivid ? "现场主题适合低光环境。" : "灵感主题适合日常记录。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Picker("素材来源", selection: $container.materialSourcePreference) {
                    ForEach(MaterialSourcePreference.allCases) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                Text(container.materialSourcePreference.subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("关于") {
                Button("隐私政策") { openDestination(.privacy) }
                    .accessibilityIdentifier("settings.privacy")
                LabeledContent("版本", value: "iOS 个人版")
            }

            Section("账号") {
                Button("注销并删除数据", role: .destructive) {
                    openDestination(.deleteAccount)
                }
                .accessibilityIdentifier("settings.deleteAccount")
            }
        }
        .navigationTitle("设置")
        .formStyle(.grouped)
        .tint(container.theme.primary)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .rootTabBarVisibility(.hidden)
    }

    private func openDestination(_ destination: MineSheet) {
        if dismissBeforeOpen { dismiss() }
        open(destination)
    }
}

private struct ProfileEditSheet: View {
    @ObservedObject var viewModel: MineViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var troupeName: String
    @State private var avatarUrl: String
    @State private var selectedAvatarItem: PhotosPickerItem?

    init(viewModel: MineViewModel) {
        self.viewModel = viewModel
        _name = State(initialValue: viewModel.profile.displayName)
        _troupeName = State(initialValue: viewModel.profile.troupeName)
        _avatarUrl = State(initialValue: viewModel.profile.avatarUrl)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                SheetTitleBar("编辑个人卡片") { dismiss() }
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        PhotosPicker(selection: $selectedAvatarItem, matching: .images) {
                            HStack(spacing: 14) {
                                ZStack {
                                    Circle()
                                        .fill(AppTheme.blue)
                                    Image(systemName: "person.crop.circle.fill")
                                        .font(.largeTitle.weight(.semibold))
                                        .foregroundStyle(AppTheme.onPrimary)
                                }
                                .frame(width: 76, height: 76)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("点击更换头像")
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text("选择照片后上传并保存")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                }
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                        .onChange(of: selectedAvatarItem) { _, item in
                            guard let item else { return }
                            Task {
                                defer { selectedAvatarItem = nil }
                                guard let url = try? await importedMediaURL(from: item, type: .image),
                                      let fileID = await viewModel.uploadProfileImage(localURL: url) else { return }
                                avatarUrl = fileID
                            }
                        }
                        TextField("名字", text: $name)
                            .textFieldStyle(AppTextFieldStyle())
                        TextField("剧团（选填）", text: $troupeName)
                            .textFieldStyle(AppTextFieldStyle())
                    }
                }
                PrimaryButton(title: "保存") {
                    Task {
                        if await viewModel.updateProfile(displayName: name, troupeName: troupeName, avatarUrl: avatarUrl) {
                            dismiss()
                        }
                    }
                }
                .disabled(viewModel.isSavingProfile || viewModel.isUploadingProfile)
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private struct MineRowsSheet: View {
    let title: String
    let rows: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 16) {
                PageTitle(title: title)
                if rows.isEmpty {
                    EmptyStateCard(title: "暂无内容", subtitle: "完成记录后会出现在这里。")
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

private enum PendingRecordItem: Identifiable {
    case inspiration(Inspiration)
    case practice(PracticeRecord)
    case rehearsal(Rehearsal)

    var id: String {
        switch self {
        case .inspiration(let item): "inspiration-\(item.id)"
        case .practice(let item): "practice-\(item.id)"
        case .rehearsal(let item): "rehearsal-\(item.id)"
        }
    }

    var title: String {
        switch self {
        case .inspiration(let item): item.title
        case .practice(let item): item.materialTitle
        case .rehearsal(let item): item.title
        }
    }

    var desc: String {
        switch self {
        case .inspiration(let item): return item.desc
        case .practice(let item): return item.note
        case .rehearsal(let item):
            return item.reviewReminder.isEmpty ? item.goals.joined(separator: " / ") : item.reviewReminder
        }
    }

    var typeLabel: String {
        switch self {
        case .inspiration: "灵感"
        case .practice: "素材练习"
        case .rehearsal: "排练复盘"
        }
    }

    var meta: [String] {
        switch self {
        case .inspiration(let item):
            return item.meta.isEmpty ? ["待整理"] : item.meta
        case .practice(let item):
            var values = ["\(item.score) 分"]
            if !item.attachments.isEmpty { values.append("\(item.attachments.count) 个附件") }
            return values + item.meta
        case .rehearsal(let item):
            return [item.status.rawValue] + Array(item.goals.prefix(2))
        }
    }
}

private struct PendingRecordsView: View {
    @ObservedObject var viewModel: MineViewModel
    @State private var selectedItem: PendingRecordItem?

    private var items: [PendingRecordItem] {
        viewModel.pendingInspirations.map(PendingRecordItem.inspiration)
            + viewModel.practiceRecords.map(PendingRecordItem.practice)
            + viewModel.rehearsals.filter { $0.status == .completed }.map(PendingRecordItem.rehearsal)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "待整理")
                AppCard(padding: 0) {
                    ZStack(alignment: .leading) {
                        LinearGradient(
                            colors: [
                                AppTheme.blueSoft,
                                AppTheme.orangeSoft
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        VStack(alignment: .leading, spacing: 10) {
                            Text("待整理")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.textSecondary)
                            Text("\(items.count) 条可沉淀记录")
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            FlowWrap(spacing: 8, rowSpacing: 8) {
                                Text("灵感")
                                Text("素材练习")
                                Text("排练复盘")
                            }
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.blue)
                        }
                        .padding(18)
                    }
                    .frame(minHeight: 120)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }

                if items.isEmpty {
                    EmptyStateCard(title: "没有待整理记录", subtitle: "保存灵感、练习复盘或排练复盘后会出现在这里。")
                } else {
                    ForEach(items) { item in
                        Button {
                            selectedItem = item
                        } label: {
                            AppCard {
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Text(item.typeLabel)
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(AppTheme.blue)
                                            .padding(.horizontal, 9)
                                            .padding(.vertical, 5)
                                            .background(AppTheme.blueSoft, in: Capsule())
                                        Spacer()
                                        if case .inspiration = item {
                                            Text("编辑")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(AppTheme.orange)
                                        }
                                    }
                                    Text(item.title)
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(item.desc.isEmpty ? "待整理" : item.desc)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                        .lineLimit(2)
                                    FlowWrap(spacing: 6, rowSpacing: 6) {
                                        ForEach(item.meta.prefix(4), id: \.self) { meta in
                                            DisplayTag(title: meta, tone: AppTheme.textSecondary, fill: AppTheme.cardBackground)
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
        .sheet(item: $selectedItem) { item in
            switch item {
            case .inspiration(let inspiration):
                InspirationDetailSheet(inspiration: inspiration, viewModel: viewModel)
            case .practice, .rehearsal:
                PendingSedimentSheet(item: item, viewModel: viewModel)
            }
        }
        .rootTabBarVisibility(.hidden)
    }
}

private struct PendingSedimentSheet: View {
    let item: PendingRecordItem
    @ObservedObject var viewModel: MineViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var methodTitle: String
    @State private var methodDesc: String

    init(item: PendingRecordItem, viewModel: MineViewModel) {
        self.item = item
        self.viewModel = viewModel
        _methodTitle = State(initialValue: item.title)
        _methodDesc = State(initialValue: item.desc)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "待整理详情")
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(item.typeLabel)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.blue)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(AppTheme.blueSoft, in: Capsule())
                        Text(item.title)
                            .font(.title2.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(item.desc.isEmpty ? "暂无详情" : item.desc)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        FlowWrap(spacing: 6, rowSpacing: 6) {
                            ForEach(item.meta.prefix(5), id: \.self) { meta in
                                Text(meta)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(AppTheme.cardBackground, in: Capsule())
                            }
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("沉淀为方法卡")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("把这次有效的做法留下，下次可以直接照着带。")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        TextField("标题", text: $methodTitle)
                            .textFieldStyle(AppTextFieldStyle())
                        AppTextEditor(text: $methodDesc, placeholder: "下次怎么带或怎么调整", minHeight: 130)
                    }
                }
                HStack(spacing: 12) {
                    Button("暂不整理") {
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                    .tint(AppTheme.textSecondary)

                    PrimaryButton(title: "保存方法卡") {
                        Task {
                            await viewModel.createMethodCard(title: methodTitle, desc: methodDesc, sourceType: sourceType)
                            dismiss()
                        }
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var sourceType: String {
        switch item {
        case .inspiration: "inspiration"
        case .practice: "practice"
        case .rehearsal: "rehearsal"
        }
    }
}

private struct InspirationRecordsView: View {
    let title: String
    let inspirations: [Inspiration]
    @ObservedObject var viewModel: MineViewModel
    @State private var filter = "全部"
    @State private var selectedInspiration: Inspiration?

    private var filteredInspirations: [Inspiration] {
        switch filter {
        case "待整理": inspirations.filter { $0.meta.contains("待整理") }
        case "训练线索": inspirations.filter { $0.meta.contains("训练线索") }
        case "排练线索": inspirations.filter { $0.meta.contains("排练线索") }
        case "已沉淀": inspirations.filter { $0.meta.contains("已沉淀") }
        default: inspirations
        }
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: title)
                FlowWrap(spacing: 8, rowSpacing: 8) {
                    ForEach(["全部", "待整理", "训练线索", "排练线索", "已沉淀"], id: \.self) { option in
                        ActionChip(title: option, selected: filter == option) {
                            filter = option
                        }
                    }
                }
                if filteredInspirations.isEmpty {
                    EmptyStateCard(title: "暂无灵感", subtitle: "保存快速记录后，会进入这里继续整理。")
                } else {
                    ForEach(filteredInspirations) { inspiration in
                        Button {
                            selectedInspiration = inspiration
                        } label: {
                            AppCard {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text(inspiration.title)
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(inspiration.desc)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                        .lineLimit(2)
                                    HStack(spacing: 8) {
                                        ForEach(inspiration.meta.prefix(3), id: \.self) { meta in
                                            Text(meta)
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(AppTheme.blue)
                                                .padding(.horizontal, 9)
                                                .padding(.vertical, 5)
                                                .background(AppTheme.blueSoft, in: Capsule())
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
        .sheet(item: $selectedInspiration) { inspiration in
            InspirationDetailSheet(inspiration: inspiration, viewModel: viewModel)
        }
        .rootTabBarVisibility(.hidden)
    }
}

private struct InspirationDetailSheet: View {
    let inspiration: Inspiration
    @ObservedObject var viewModel: MineViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var intent = ""
    @State private var methodTitle: String
    @State private var methodDesc: String
    @State private var editingOriginal = false
    @State private var originalTitle: String
    @State private var originalDesc: String
    @State private var selectedTags: Set<String>
    @State private var linkedMaterialId: String
    @State private var linkedRehearsalId: String
    @State private var deleteConfirmationVisible = false

    init(inspiration: Inspiration, viewModel: MineViewModel) {
        self.inspiration = inspiration
        self.viewModel = viewModel
        _methodTitle = State(initialValue: inspiration.title)
        _methodDesc = State(initialValue: inspiration.desc)
        _originalTitle = State(initialValue: inspiration.title)
        _originalDesc = State(initialValue: inspiration.desc)
        _selectedTags = State(initialValue: Set(inspiration.meta))
        _linkedMaterialId = State(initialValue: inspiration.linkedMaterialId)
        _linkedRehearsalId = State(initialValue: inspiration.linkedRehearsalId)
        _intent = State(initialValue: inspiration.meta.first { $0 == "训练线索" || $0 == "排练线索" } ?? "")
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "灵感详情")
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("标签")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        FlowWrap(spacing: 8, rowSpacing: 8) {
                            ForEach(["待整理", "训练线索", "排练线索", "已沉淀"], id: \.self) { tag in
                                ActionChip(title: tag, selected: selectedTags.contains(tag)) {
                                    toggleTag(tag)
                                }
                            }
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("原始记录")
                                .font(.headline.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Spacer()
                            SmallPillButton(title: editingOriginal ? "收起" : "编辑") {
                                editingOriginal.toggle()
                            }
                        }
                        if editingOriginal {
                            TextField("标题", text: $originalTitle)
                                .textFieldStyle(AppTextFieldStyle())
                            TextEditor(text: $originalDesc)
                                .font(.body.weight(.semibold))
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 120)
                                .padding(10)
                                .background(AppTheme.inputBackground, in: RoundedRectangle(cornerRadius: 12))
                            Picker("关联素材", selection: $linkedMaterialId) {
                                Text("不关联素材").tag("")
                                ForEach(viewModel.materials.filter { !$0.referenceOnly }) { material in
                                    Text(material.title).tag(material.id)
                                }
                            }
                            .pickerStyle(.menu)
                            Picker("关联排练", selection: $linkedRehearsalId) {
                                Text("不关联排练").tag("")
                                ForEach(viewModel.rehearsals) { rehearsal in
                                    Text(rehearsal.title).tag(rehearsal.id)
                                }
                            }
                            .pickerStyle(.menu)
                            HStack(spacing: 10) {
                                SmallPillButton(title: "删除", tone: AppTheme.error, fill: AppTheme.error.opacity(0.10)) {
                                    deleteConfirmationVisible = true
                                }
                                PrimaryButton(title: "保存灵感") {
                                    Task {
                                        if await saveDraft(tags: selectedTags) { editingOriginal = false }
                                    }
                                }
                            }
                        } else {
                            Text(inspiration.title)
                                .font(.title2.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(inspiration.desc)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                            if !inspiration.linkedMaterialTitle.isEmpty {
                                DisplayTag(title: "素材：\(inspiration.linkedMaterialTitle)")
                            }
                            if !inspiration.linkedRehearsalTitle.isEmpty {
                                DisplayTag(title: "排练：\(inspiration.linkedRehearsalTitle)")
                            }
                            if !inspiration.attachments.isEmpty {
                                Text("\(inspiration.attachments.count) 个附件")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.blue)
                                    .padding(.horizontal, 9)
                                    .padding(.vertical, 5)
                                    .background(AppTheme.blueSoft, in: Capsule())
                            }
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("整理方向")
                            .font(.headline.weight(.heavy))
                        HStack(spacing: 8) {
                            ActionChip(title: "训练线索", selected: intent == "训练线索") {
                                intent = intent == "训练线索" ? "" : "训练线索"
                                syncIntentTag()
                            }
                            ActionChip(title: "排练线索", selected: intent == "排练线索") {
                                intent = intent == "排练线索" ? "" : "排练线索"
                                syncIntentTag()
                            }
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("沉淀为方法卡")
                            .font(.headline.weight(.heavy))
                        Text("把这次有效的做法留下，下次可以直接照着带。")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        TextField("标题", text: $methodTitle)
                            .textFieldStyle(AppTextFieldStyle())
                        AppTextEditor(text: $methodDesc, placeholder: "下次怎么带或怎么调整", minHeight: 120)
                    }
                }
                HStack(spacing: 12) {
                    Button("不再整理") {
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                    .tint(AppTheme.textSecondary)

                    PrimaryButton(title: "保存方法卡") {
                        Task {
                            await viewModel.createMethodCard(title: methodTitle, desc: methodDesc, sourceType: intent.isEmpty ? "inspiration" : intent)
                            var nextTags = selectedTags
                            nextTags.insert("已沉淀")
                            if !intent.isEmpty {
                                nextTags.insert(intent)
                            }
                            if await saveDraft(tags: nextTags) { dismiss() }
                        }
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .alert("删除灵感", isPresented: $deleteConfirmationVisible) {
            Button("取消", role: .cancel) {}
            Button("删除", role: .destructive) {
                Task {
                    await viewModel.deleteInspiration(inspiration)
                    dismiss()
                }
            }
        } message: {
            Text("删除后会从当前灵感记录中移除。")
        }
    }

    private func saveDraft(tags: Set<String>) async -> Bool {
        var draft = inspiration
        draft.title = originalTitle
        draft.desc = originalDesc
        draft.meta = Array(tags)
        draft.linkedMaterialId = linkedMaterialId
        draft.linkedMaterialTitle = viewModel.materials.first { $0.id == linkedMaterialId }?.title ?? ""
        draft.linkedRehearsalId = linkedRehearsalId
        draft.linkedRehearsalTitle = viewModel.rehearsals.first { $0.id == linkedRehearsalId }?.title ?? ""
        return await viewModel.updateInspiration(draft)
    }

    private func toggleTag(_ tag: String) {
        let wasSelected = selectedTags.contains(tag)
        if tag == "训练线索" || tag == "排练线索" {
            selectedTags.remove("训练线索")
            selectedTags.remove("排练线索")
        }
        if wasSelected {
            selectedTags.remove(tag)
        } else {
            selectedTags.insert(tag)
        }
        if tag == "训练线索" || tag == "排练线索" {
            intent = selectedTags.contains(tag) ? tag : ""
        }
    }

    private func syncIntentTag() {
        selectedTags.remove("训练线索")
        selectedTags.remove("排练线索")
        if !intent.isEmpty {
            selectedTags.insert(intent)
        }
    }
}

private struct MethodCardsView: View {
    @ObservedObject var viewModel: MineViewModel
    let openDetail: (MethodCard) -> Void

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "方法卡")
                Text("把这次有效的做法留下，下次可以直接照着带。")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                if viewModel.methodCards.isEmpty {
                    EmptyStateCard(title: "暂无方法卡", subtitle: "把灵感、练习或排练中有效的做法留下，方便下次直接复用。")
                } else {
                    ForEach(viewModel.methodCards) { card in
                        Button {
                            openDetail(card)
                        } label: {
                            AppCard {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text(card.title)
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Text(card.desc)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(AppTheme.textSecondary)
                                        .lineLimit(2)
                                    if let sourceLabel = card.sourceDisplayLabel {
                                        Text(sourceLabel)
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(AppTheme.blue)
                                            .padding(.horizontal, 9)
                                            .padding(.vertical, 5)
                                            .background(AppTheme.blueSoft, in: Capsule())
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
}

private struct MethodCardDetailView: View {
    let card: MethodCard
    @ObservedObject var viewModel: MineViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var desc: String
    @State private var deleteConfirmationVisible = false

    init(card: MethodCard, viewModel: MineViewModel) {
        self.card = card
        self.viewModel = viewModel
        _title = State(initialValue: card.title)
        _desc = State(initialValue: card.desc)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("下次可直接复用的带练提示")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("把这次有效的做法或提醒写下来。")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text("标题")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        TextField("例如：热身先降门槛", text: $title)
                            .textFieldStyle(AppTextFieldStyle())
                        Text("下次怎么做")
                            .font(.subheadline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        AppTextEditor(text: $desc, placeholder: "例如：先让动作变小、规则变少，再逐步加速。", minHeight: 150)
                    }
                }
                PrimaryButton(title: "保存修改") {
                    Task {
                        await viewModel.updateMethodCard(card, title: title, desc: desc)
                        dismiss()
                    }
                }
            }
        }
        .navigationTitle("编辑方法卡")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("删除", role: .destructive) {
                    deleteConfirmationVisible = true
                }
            }
        }
        .alert("删除方法卡", isPresented: $deleteConfirmationVisible) {
            Button("取消", role: .cancel) {}
            Button("删除", role: .destructive) {
                Task {
                    await viewModel.deleteMethodCard(card)
                    dismiss()
                }
            }
        } message: {
            Text("删除后会从个人沉淀中移除。")
        }
        .rootTabBarVisibility(.hidden)
    }
}

private struct RehearsalRecordsView: View {
    let onDeleteRehearsal: (Rehearsal) async -> Bool
    let openRecord: () -> Void
    let openDiscover: () -> Void
    let openDetail: (Rehearsal) -> Void
    @State private var recordsState: [Rehearsal]

    init(
        rehearsals: [Rehearsal],
        onDeleteRehearsal: @escaping (Rehearsal) async -> Bool = { _ in false },
        openRecord: @escaping () -> Void = {},
        openDiscover: @escaping () -> Void = {},
        openDetail: @escaping (Rehearsal) -> Void = { _ in }
    ) {
        self.onDeleteRehearsal = onDeleteRehearsal
        self.openRecord = openRecord
        self.openDiscover = openDiscover
        self.openDetail = openDetail
        _recordsState = State(initialValue: rehearsals)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "排练记录")
                if recordsState.isEmpty {
                    EmptyStateCard(title: "暂无排练记录", subtitle: "从记录页快速开启排练后，会在这里回看。")
                    HStack(spacing: 12) {
                        Button("去发现") {
                            openDiscover()
                        }
                        .buttonStyle(.bordered)
                        .tint(AppTheme.blue)
                        PrimaryButton(title: "去记录") {
                            openRecord()
                        }
                    }
                } else {
                    AppCard {
                        HStack {
                            stat(value: "\(recordsState.count)", label: "总排练")
                            stat(value: "\(recordsState.filter { $0.status == .completed }.count)", label: "已完成")
                            stat(value: "\(recordsState.flatMap(\.plan).count)", label: "素材计划")
                        }
                    }
                    ForEach(recordsState) { rehearsal in
                        AppCard {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text(rehearsal.title)
                                        .font(.headline.weight(.heavy))
                                        .foregroundStyle(AppTheme.textPrimary)
                                    Spacer()
                                    Text(rehearsal.status.rawValue)
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(AppTheme.blue)
                                }
                                Text("\(rehearsal.duration) · \(rehearsal.goals.joined(separator: " / "))")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                HStack {
                                    SmallPillButton(title: "查看") {
                                        openDetail(rehearsal)
                                    }
                                    Spacer()
                                    SmallPillButton(title: "删除", tone: AppTheme.error, fill: AppTheme.error.opacity(0.10)) {
                                        Task {
                                            if await onDeleteRehearsal(rehearsal) {
                                                recordsState.removeAll { $0.id == rehearsal.id }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .rootTabBarVisibility(.hidden)
    }

    private func stat(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.weight(.heavy))
                .foregroundStyle(AppTheme.textPrimary)
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct RehearsalDetailView: View {
    let rehearsal: Rehearsal

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "排练详情")
                AppCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(rehearsal.title)
                            .font(.title2.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("\(rehearsal.duration) · \(rehearsal.status.rawValue)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        Text(rehearsal.goals.joined(separator: " / "))
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(AppTheme.blue)
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("素材计划")
                            .font(.headline.weight(.heavy))
                        if rehearsal.plan.isEmpty {
                            Text("没有素材计划")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        } else {
                            ForEach(rehearsal.plan) { item in
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text(item.materialTitle.isEmpty ? item.materialId : item.materialTitle)
                                            .font(.headline.weight(.semibold))
                                            .foregroundStyle(AppTheme.textPrimary)
                                        Spacer()
                                        Text(item.status.rawValue)
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(AppTheme.blue)
                                    }
                                    if !item.keep.isEmpty || !item.tryNext.isEmpty {
                                        Text("Keep: \(item.keep)  Try: \(item.tryNext)")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(AppTheme.textSecondary)
                                    }
                                }
                                Divider()
                            }
                        }
                    }
                }
                if !rehearsal.reviewKeep.isEmpty || !rehearsal.reviewTry.isEmpty {
                    AppCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("整体复盘")
                                .font(.headline.weight(.heavy))
                            Text("Keep: \(rehearsal.reviewKeep)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                            Text("Try: \(rehearsal.reviewTry)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("排练详情")
        .navigationBarTitleDisplayMode(.inline)
        .rootTabBarVisibility(.hidden)
    }
}

private struct SimpleMineSheet: View {
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

private struct HelpSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("3 步开始") {
                helpStep(1, "在发现页选择素材")
                helpStep(2, "进入详情开始练习")
                helpStep(3, "结束后记录 Keep 和 Try")
            }
            Section("找素材与练习") {
                Text("可以搜索、筛选或随机抽取素材。路径仅供参考，不参与练习和排练。")
            }
            Section("分类与筛选") {
                Text("素材类型是一级分类，训练能力和使用场景用于筛选；标签只补充细节。")
            }
            Section("记录与排练") {
                Text("在记录页保存灵感，或开启排练并填写 Keep、Try；结束后完成整体复盘。")
            }
            Section("回看与整理") {
                Text("我的页集中保存灵感、练习、排练和方法卡。保存失败时当前输入会保留，可直接重试。")
            }
        }
        .navigationTitle("使用帮助")
        .listStyle(.insetGrouped)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .rootTabBarVisibility(.hidden)
    }

    private func helpStep(_ index: Int, _ text: String) -> some View {
        HStack(spacing: 10) {
            Text("\(index)")
                .font(.caption.weight(.heavy))
                .foregroundStyle(AppTheme.onPrimary)
                .frame(width: 24, height: 24)
                .background(AppTheme.orange, in: Circle())
            Text(text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.textSecondary)
        }
    }

}

private struct PrivacySheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "隐私政策")
                AppCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("更新日期：2026年7月")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppTheme.textSecondary)
                        privacySummary("只保存你主动创建或提交的内容。")
                        privacySummary("个人数据按账号隔离。")
                        privacySummary("可在设置中注销并删除账号数据。")
                    }
                }
                privacyBlock("一、我们收集的信息", [
                    "微信登录标识或 iOS 账号标识，用于区分用户并隔离个人数据。",
                    "你主动填写的个人资料，包括昵称、剧团名和头像。头像由你从相册或相机中主动选择，正式版会存储为云端文件。",
                    "你主动创建的灵感、排练、练习复盘、方法卡和自定义素材。",
                    "素材收藏、练过标记、最近练习等操作状态。",
                    "你主动提交的反馈，包括类型、内容、选填联系方式、来源页面和应用版本，仅用于定位问题与沟通。"
                ])
                privacyBlock("二、使用与存储", [
                    "这些信息用于提供训练功能、保存和展示你的内容、同步个人资料，以及改进产品。",
                    "昵称、剧团名、头像和反馈联系方式均由你主动填写或选择；不填写不会影响素材浏览、记录和排练等核心功能。",
                    "我们不会出售、出租或以其他方式向第三方提供你的个人信息。",
                    "正式版通过 CloudBase 服务保存账号资料和你主动创建的内容；媒体附件可由受控对象存储网关保存。数据仅用于提供应用功能和处理你主动提交的反馈。"
                ])
                privacyBlock("三、安全与用户权利", [
                    "数据读写通过服务端校验。你可以查看、编辑或删除自己创建的内容，也可以在我的页修改昵称、剧团名和头像。",
                    "删除全部个人数据、已提交反馈、素材状态、头像和附件，请前往“我的 → 设置 → 注销并删除数据”。删除会使此前登录会话失效，完成后无法恢复。",
                    "除法律法规另有要求或删除任务暂时失败外，注销请求完成后不再保留可识别的个人业务数据；部分失败时会提示重试。"
                ])
                privacyBlock("四、未成年人保护", [
                    "未满 14 周岁的用户，请在监护人指导下使用。"
                ])
                privacyBlock("五、更新与联系", [
                    "政策更新时，我们会在应用内或通过适当方式提醒。如有问题，请前往“我的 → 设置 → 意见反馈”。"
                ])
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .rootTabBarVisibility(.hidden)
    }

    private func privacySummary(_ text: String) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(AppTheme.textPrimary)
    }

    private func privacyBlock(_ title: String, _ items: [String]) -> some View {
        AppCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                ForEach(items, id: \.self) { text in
                    Text(text)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
            }
        }
    }
}

struct FeedbackSheet: View {
    @ObservedObject var viewModel: MineViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showsDiscardConfirmation = false

    private var hasDraft: Bool {
        !viewModel.feedbackText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !viewModel.feedbackContact.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            viewModel.feedbackCategory != "suggestion"
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                SheetTitleBar("意见反馈", closeAccessibilityLabel: "取消意见反馈", closeAction: requestDismiss)
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("反馈类型")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        FlowWrap(spacing: 8, rowSpacing: 8) {
                            ForEach(["bug", "suggestion", "content", "other"], id: \.self) { category in
                                ActionChip(title: feedbackLabel(category), selected: viewModel.feedbackCategory == category) {
                                    viewModel.feedbackCategory = category
                                }
                            }
                        }
                        Text("反馈内容（10-500 字）")
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        TextEditor(text: $viewModel.feedbackText)
                            .font(.body.weight(.semibold))
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 170)
                            .padding(10)
                            .background(AppTheme.inputBackground, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(alignment: .topLeading) {
                                if viewModel.feedbackText.isEmpty {
                                    Text("发生了什么？你希望怎样？")
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(AppTheme.textMuted)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 18)
                                        .allowsHitTesting(false)
                                }
                            }
                        Text("\(viewModel.feedbackText.count) / 500")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(viewModel.feedbackText.count > 500 ? AppTheme.error : AppTheme.textMuted)
                        Text("请描述发生了什么，以及你希望怎样改进。")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textMuted)
                        TextField("联系方式（选填）", text: $viewModel.feedbackContact)
                            .textFieldStyle(AppTextFieldStyle())
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            PrimaryButton(title: "提交反馈") {
                Task {
                    if await viewModel.submitFeedback() { dismiss() }
                }
            }
            .disabled(viewModel.isSubmittingFeedback)
            .padding(.horizontal, 20)
            .padding(.top, 10)
            .padding(.bottom, 12)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) { Divider().opacity(0.5) }
        }
        .interactiveDismissDisabled(viewModel.isSubmittingFeedback || hasDraft)
        .alert("放弃本次反馈？", isPresented: $showsDiscardConfirmation) {
            Button("继续编辑", role: .cancel) {}
            Button("放弃", role: .destructive) { dismiss() }
        } message: {
            Text("未提交的反馈内容将被丢弃。")
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func feedbackLabel(_ category: String) -> String {
        switch category {
        case "bug": "问题"
        case "content": "内容"
        case "other": "其他"
        default: "建议"
        }
    }

    private func requestDismiss() {
        if hasDraft {
            showsDiscardConfirmation = true
        } else {
            dismiss()
        }
    }
}

private struct DeleteAccountSheet: View {
    @ObservedObject var viewModel: MineViewModel
    @EnvironmentObject private var container: AppContainer
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "注销并删除数据")
                AppCard {
                    Text("确认后会调用 account.delete 删除个人私有数据、素材状态、头像和附件，并使该账户此前签发的所有登录会话失效；服务端会返回逐项处理结果，部分失败时可重试。")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(AppTheme.textSecondary)
                }
                PrimaryButton(title: "确认注销并删除数据") {
                    Task {
                        if await viewModel.deleteAccount() {
                            container.accountWasDeleted()
                            dismiss()
                        }
                    }
                }
                .disabled(viewModel.isDeletingAccount)
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
