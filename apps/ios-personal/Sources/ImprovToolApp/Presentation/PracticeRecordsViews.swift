import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVFAudio
import AVKit
import UIKit

struct PracticeRecordsView: View {
    let loadRecords: (() async throws -> [PracticeRecord])?
    let onUpdateRecord: (PracticeRecord) async -> PracticeRecord?
    let onDeleteRecord: (PracticeRecord) async -> Bool
    let openRecord: () -> Void
    let openDiscover: () -> Void
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var container: AppContainer
    @State private var recordsState: [PracticeRecord]
    @State private var selectedFilter = "全部"
    @State private var selectedMaterialId: String?
    @State private var materialSheetVisible = false
    @State private var materialSearchKeyword = ""
    @State private var selectedRecord: PracticeRecord?
    @State private var loadState: ViewState = .idle

    init(
        records: [PracticeRecord],
        loadRecords: (() async throws -> [PracticeRecord])? = nil,
        onUpdateRecord: @escaping (PracticeRecord) async -> PracticeRecord? = { record in record },
        onDeleteRecord: @escaping (PracticeRecord) async -> Bool = { _ in false },
        openRecord: @escaping () -> Void = {},
        openDiscover: @escaping () -> Void = {}
    ) {
        self.loadRecords = loadRecords
        self.onUpdateRecord = onUpdateRecord
        self.onDeleteRecord = onDeleteRecord
        self.openRecord = openRecord
        self.openDiscover = openDiscover
        _recordsState = State(initialValue: records)
    }

    private var filteredRecords: [PracticeRecord] {
        let materialRecords = selectedMaterialId.map { id in recordsState.filter { $0.materialId == id } } ?? recordsState
        switch selectedFilter {
        case "8-10 分": return materialRecords.filter { $0.score >= 8 }
        case "1-4 分": return materialRecords.filter { $0.score >= 1 && $0.score <= 4 }
        case "有照片": return materialRecords.filter { record in record.attachments.contains { $0.type == .image } }
        case "有视频": return materialRecords.filter { record in record.attachments.contains { $0.type == .video } }
        case "有音频": return materialRecords.filter { record in record.attachments.contains { $0.type == .audio } }
        default: return materialRecords
        }
    }

    private var materialOptions: [PracticeMaterialOption] {
        let grouped = Dictionary(grouping: recordsState, by: \.materialId)
        return grouped.compactMap { materialId, records in
            guard let first = records.sorted(by: { $0.createdAt > $1.createdAt }).first else { return nil }
            return PracticeMaterialOption(
                id: materialId,
                title: first.materialTitle,
                desc: "\(records.count) 条记录"
            )
        }
        .sorted { $0.title < $1.title }
    }

    private var visibleMaterialOptions: [PracticeMaterialOption] {
        let clean = materialSearchKeyword.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return materialOptions }
        return materialOptions.filter { option in
            "\(option.title) \(option.desc)".localizedCaseInsensitiveContains(clean)
        }
    }

    private var materialFilterLabel: String {
        guard let selectedMaterialId else { return "全部素材" }
        return materialOptions.first(where: { $0.id == selectedMaterialId })?.title ?? "全部素材"
    }

    var body: some View {
        AppPageShell(bottomInset: 24, onRefresh: reload) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "练习记录")
                if case .loading = loadState {
                    LoadingCard(title: "加载练习记录")
                }
                if case .failed(let message) = loadState {
                    EmptyStateCard(title: "练习记录加载失败", subtitle: message)
                    PrimaryButton(title: "重试") { Task { await reload() } }
                }
                if !recordsState.isEmpty {
                    AppCard {
                        HStack {
                            summary(value: "\(recordsState.count)", label: "总记录")
                            summary(value: "\(recordsState.filter { $0.score >= 8 }.count)", label: "高分")
                            summary(value: "\(recordsState.filter { !$0.attachments.isEmpty }.count)", label: "有附件")
                        }
                    }
                }
                Button {
                    materialSheetVisible = true
                } label: {
                    AppCard(padding: 14) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("素材")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                Text(materialFilterLabel)
                                    .font(.headline.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                            }
                            Spacer()
                            Text("切换")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppTheme.orange)
                        }
                    }
                }
                .buttonStyle(.plain)
                FlowWrap(spacing: 8, rowSpacing: 8) {
                    ForEach(["全部", "有视频", "有照片", "有音频", "8-10 分", "1-4 分"], id: \.self) { filter in
                        ActionChip(title: filter, selected: selectedFilter == filter) {
                            selectedFilter = filter
                        }
                    }
                }
                if filteredRecords.isEmpty {
                    EmptyStateCard(
                        title: selectedMaterialId == nil && selectedFilter == "全部" ? "还没有练习记录" : "暂无练习记录",
                        subtitle: selectedMaterialId == nil && selectedFilter == "全部" ? "完成一次练习后，可在这里回看。" : "没有符合条件的记录。"
                    )
                    if selectedMaterialId == nil && selectedFilter == "全部" {
                        SheetActionRow(
                            secondaryTitle: "去发现",
                            secondaryAction: {
                                dismiss()
                                openDiscover()
                            },
                            primaryTitle: "去记录",
                            primaryAction: {
                                dismiss()
                                openRecord()
                            }
                        )
                    } else {
                        PrimaryButton(title: "查看全部") {
                            selectedMaterialId = nil
                            selectedFilter = "全部"
                        }
                    }
                } else {
                    ForEach(filteredRecords) { record in
                        PracticeRecordCard(record: record) {
                            selectedRecord = record
                        }
                    }
                }
            }
        }
        .task { await reload() }
        .navigationDestination(isPresented: Binding(
            get: { selectedRecord != nil },
            set: { if !$0 { selectedRecord = nil } }
        )) {
            if let record = selectedRecord {
                PracticeRecordDetailView(
                    record: record,
                    resolveMedia: resolveMedia,
                    onUpdateAttachment: { attachment in
                        await updateAttachment(attachment, in: record)
                    },
                    onDeleteAttachment: { attachment in
                        await deleteAttachment(attachment, in: record)
                    },
                    onDelete: {
                        await deleteRecord(record)
                    }
                )
            }
        }
        .sheet(isPresented: $materialSheetVisible) {
            materialPickerSheet
        }
        .rootTabBarVisibility(.hidden)
        .accessibilityIdentifier("mine.practiceRecords.detail")
    }

    private func reload() async {
        guard let loadRecords else {
            loadState = .loaded
            return
        }
        loadState = .loading
        do {
            recordsState = try await loadRecords()
            loadState = recordsState.isEmpty ? .empty("还没有练习记录") : .loaded
        } catch {
            loadState = .failed("请检查网络后重试")
        }
    }

    private var materialPickerSheet: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "选择素材")
                AppCard(padding: 14) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(AppTheme.textSecondary)
                        TextField("搜索素材名称", text: $materialSearchKeyword)
                            .font(.subheadline.weight(.semibold))
                    }
                }
                VStack(spacing: 12) {
                    materialOptionCard(
                        title: "全部素材",
                        desc: "\(recordsState.count) 条记录",
                        selected: selectedMaterialId == nil
                    ) {
                        selectedMaterialId = nil
                        materialSheetVisible = false
                    }
                    if visibleMaterialOptions.isEmpty {
                        Text("没有匹配的素材")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 24)
                    } else {
                        ForEach(visibleMaterialOptions) { option in
                            materialOptionCard(
                                title: option.title,
                                desc: option.desc,
                                selected: selectedMaterialId == option.id
                            ) {
                                selectedMaterialId = option.id
                                materialSheetVisible = false
                            }
                        }
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func materialOptionCard(title: String, desc: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            AppCard(padding: 14) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(desc)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                    Spacer()
                    Text(selected ? "✓" : "")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.orange)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func summary(value: String, label: String) -> some View {
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

    private func updateAttachment(_ attachment: PracticeAttachment, in record: PracticeRecord) async {
        var updatedRecord = record
        updatedRecord.attachments = updatedRecord.attachments.map { $0.id == attachment.id ? attachment : $0 }
        await saveRecord(updatedRecord)
    }

    private func deleteAttachment(_ attachment: PracticeAttachment, in record: PracticeRecord) async {
        var updatedRecord = record
        updatedRecord.attachments.removeAll { $0.id == attachment.id }
        await saveRecord(updatedRecord)
    }

    private func deleteRecord(_ record: PracticeRecord) async {
        guard await onDeleteRecord(record) else { return }
        recordsState.removeAll { $0.id == record.id }
        selectedRecord = nil
    }

    private func resolveMedia(fileID: String) async -> MediaPlaybackResource? {
        do {
            return try await container.mediaPlaybackRepository.resolveMedia(fileID: fileID)
        } catch {
            return nil
        }
    }

    private func saveRecord(_ record: PracticeRecord) async {
        if let updated = await onUpdateRecord(record) {
            recordsState = recordsState.map { $0.id == updated.id ? updated : $0 }
        }
    }
}

private struct PracticeMaterialOption: Identifiable {
    let id: String
    let title: String
    let desc: String
}

struct MaterialRecordsView: View {
    let material: Material
    let loadRecords: (() async throws -> [PracticeRecord])?
    let onUpdateRecord: (PracticeRecord) async -> PracticeRecord?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @EnvironmentObject private var container: AppContainer
    @State private var recordsState: [PracticeRecord]
    @State private var selectedFilter = "全部"
    @State private var selectedRecord: PracticeRecord?
    @State private var compareSelection: [PracticeRecord] = []
    @State private var compareVisible = false
    @State private var message: String?
    @State private var loadState: ViewState = .idle

    init(
        material: Material,
        records: [PracticeRecord],
        loadRecords: (() async throws -> [PracticeRecord])? = nil,
        onUpdateRecord: @escaping (PracticeRecord) async -> PracticeRecord? = { record in record }
    ) {
        self.material = material
        self.loadRecords = loadRecords
        self.onUpdateRecord = onUpdateRecord
        _recordsState = State(initialValue: records)
    }

    private var filteredRecords: [PracticeRecord] {
        let records = materialRecords
        return switch selectedFilter {
        case "有视频": records.filter { record in record.attachments.contains { $0.type == .video } }
        case "有照片": records.filter { record in record.attachments.contains { $0.type == .image } }
        case "有音频": records.filter { record in record.attachments.contains { $0.type == .audio } }
        case "关键时刻": records.filter { record in record.attachments.contains { !$0.markers.isEmpty } }
        case "8-10 分": records.filter { $0.score >= 8 }
        case "1-4 分": records.filter { $0.score >= 1 && $0.score <= 4 }
        default: records
        }
    }

    private var materialRecords: [PracticeRecord] {
        recordsState
            .filter { $0.materialId == material.id }
            .sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        AppPageShell(bottomInset: 24, onRefresh: reload) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: material.title)
                if case .loading = loadState {
                    LoadingCard(title: "加载素材档案")
                }
                if case .failed(let error) = loadState {
                    EmptyStateCard(title: "素材档案加载失败", subtitle: error)
                    PrimaryButton(title: "重试") { Task { await reload() } }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("素材成长档案")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                Text(material.title)
                                    .font(.headline.weight(.heavy))
                                    .foregroundStyle(AppTheme.textPrimary)
                            }
                            Spacer()
                        }
                        HStack {
                            summary(value: averageScore, label: "平均分")
                            summary(value: "\(materialRecords.count)", label: "练习次数")
                            summary(value: "\(materialRecords.flatMap(\.attachments).filter { $0.type == .video }.count)", label: "视频记录")
                            summary(value: "\(markerCount)", label: "关键时刻")
                        }
                        if let latestComparison {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("最近对比")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppTheme.textSecondary)
                                Text(latestComparison)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.textPrimary)
                                    .lineLimit(2)
                            }
                            .padding(12)
                            .background(AppTheme.cardBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                }
                FlowWrap(spacing: 8, rowSpacing: 8) {
                    ForEach(["全部", "有视频", "有照片", "有音频", "关键时刻", "8-10 分", "1-4 分"], id: \.self) { filter in
                        ActionChip(title: filter, selected: selectedFilter == filter) {
                            selectedFilter = filter
                        }
                    }
                }
                if filteredRecords.isEmpty {
                    EmptyStateCard(title: "暂无该素材记录", subtitle: "练习并保存复盘后，会形成这张素材的时间线。")
                } else {
                    ForEach(filteredRecords) { record in
                        PracticeRecordCard(record: record) {
                            selectedRecord = record
                        } compareAction: {
                            toggleCompare(record)
                        } compareSelected: {
                            compareSelection.contains(where: { $0.id == record.id })
                        }
                    }
                }
            }
        }
        .task { await reload() }
        .navigationDestination(isPresented: Binding(
            get: { selectedRecord != nil },
            set: { if !$0 { selectedRecord = nil } }
        )) {
            if let record = selectedRecord {
                PracticeRecordDetailView(
                    record: record,
                    resolveMedia: resolveMedia,
                    onUpdateAttachment: { attachment in
                        await updateAttachment(attachment, in: record)
                    }
                )
            }
        }
        .navigationDestination(isPresented: $compareVisible) {
            VideoCompareView(records: compareSelection) { note in
                await saveComparison(note)
            }
        }
        .overlay(alignment: .bottom) {
            MessageBanner(message: message)
                .padding(.bottom, 20)
        }
        .adaptiveTaskInset(layoutMode: adaptiveLayoutMode) {
            if !compareSelection.isEmpty {
                AdaptiveTaskPanel {
                    PrimaryButton(title: compareSelection.count == 2 ? "开始对比" : "选择 2 条含视频记录") {
                        compareVisible = compareSelection.count == 2
                    }
                }
            }
        }
        .rootTabBarVisibility(.hidden)
    }

    private func reload() async {
        guard let loadRecords else {
            loadState = .loaded
            return
        }
        loadState = .loading
        do {
            recordsState = try await loadRecords()
            loadState = recordsState.isEmpty ? .empty("还没有素材练习记录") : .loaded
        } catch {
            loadState = .failed("请检查网络后重试")
        }
    }

    private var averageScore: String {
        guard !materialRecords.isEmpty else { return "-" }
        let average = Double(materialRecords.map(\.score).reduce(0, +)) / Double(materialRecords.count)
        return String(format: "%.1f", average)
    }

    private var latestComparison: String? {
        materialRecords
            .flatMap(\.comparisonNotes)
            .sorted { $0.createdAt > $1.createdAt }
            .compactMap { note in
                [note.nextFocus, note.improvement, note.issue]
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .first { !$0.isEmpty }
            }
            .first
    }

    private var markerCount: Int {
        materialRecords
            .flatMap(\.attachments)
            .reduce(0) { $0 + $1.markers.count }
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
                .minimumScaleFactor(0.76)
        }
        .frame(maxWidth: .infinity)
    }

    private func dateLabel(_ date: Date) -> String {
        let components = Calendar.current.dateComponents([.month, .day], from: date)
        return "\(components.month ?? 0)月\(components.day ?? 0)日"
    }

    private func resolveMedia(fileID: String) async -> MediaPlaybackResource? {
        do {
            return try await container.mediaPlaybackRepository.resolveMedia(fileID: fileID)
        } catch {
            return nil
        }
    }

    private func toggleCompare(_ record: PracticeRecord) {
        guard record.attachments.contains(where: { $0.type == .video }) else { return }
        if compareSelection.contains(where: { $0.id == record.id }) {
            compareSelection.removeAll { $0.id == record.id }
        } else if compareSelection.count < 2 {
            compareSelection.append(record)
        }
    }

    private func updateAttachment(_ attachment: PracticeAttachment, in record: PracticeRecord?) async {
        guard var record else { return }
        record.attachments = record.attachments.map { $0.id == attachment.id ? attachment : $0 }
        await saveRecord(record)
    }

    private func saveComparison(_ note: ComparisonNote) async {
        guard let target = compareSelection.sorted(by: { $0.createdAt > $1.createdAt }).first else { return }
        var next = target
        next.comparisonNotes.append(note)
        await saveRecord(next)
        compareSelection = []
        compareVisible = false
    }

    private func saveRecord(_ record: PracticeRecord) async {
        if let updated = await onUpdateRecord(record) {
            recordsState = recordsState.map { $0.id == updated.id ? updated : $0 }
            compareSelection = compareSelection.map { $0.id == updated.id ? updated : $0 }
            message = "已保存记录更新"
        } else {
            message = "保存失败，请重试"
        }
    }
}

private struct PracticeRecordCard: View {
    let record: PracticeRecord
    let action: () -> Void
    var compareAction: (() -> Void)?
    var compareSelected: (() -> Bool)?

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("\(record.score) 分")
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.orange)
                    Text(record.materialTitle)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(AppTheme.textPrimary)
                    Spacer()
                    SmallPillButton(title: "查看", action: action)
                }
                Text(record.note)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
                    .lineLimit(2)
                if !record.attachments.isEmpty {
                    MediaPreviewStrip(attachments: record.attachments)
                }
                HStack(spacing: 8) {
                    Spacer()
                    if let compareAction {
                        SmallPillButton(title: (compareSelected?() ?? false) ? "已选" : "选择对比", tone: AppTheme.orange, fill: AppTheme.orangeSoft, action: compareAction)
                    }
                }
            }
        }
    }
}

private struct MediaPreviewStrip: View {
    let attachments: [PracticeAttachment]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(attachments.prefix(4)) { attachment in
                    VStack(alignment: .leading, spacing: 6) {
                        Image(systemName: iconName(attachment.type))
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(tint(attachment.type))
                        Text(label(attachment.type))
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(meta(attachment))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                    .frame(width: 96, height: 82, alignment: .leading)
                    .padding(10)
                    .background(background(attachment.type), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
    }

    private func iconName(_ type: AttachmentType) -> String {
        switch type {
        case .image: "photo"
        case .video: "play.rectangle.fill"
        case .audio: "waveform"
        }
    }

    private func label(_ type: AttachmentType) -> String {
        switch type {
        case .image: "照片"
        case .video: "视频"
        case .audio: "音频"
        }
    }

    private func meta(_ attachment: PracticeAttachment) -> String {
        if attachment.type == .video, !attachment.markers.isEmpty {
            return "\(attachment.markers.count) 个关键时刻"
        }
        if let duration = attachment.duration {
            return "\(Int(duration)) 秒"
        }
        return "查看"
    }

    private func tint(_ type: AttachmentType) -> Color {
        switch type {
        case .image: AppTheme.blue
        case .video: AppTheme.orange
        case .audio: AppTheme.teal
        }
    }

    private func background(_ type: AttachmentType) -> Color {
        switch type {
        case .image: AppTheme.blueSoft
        case .video: AppTheme.orangeSoft
        case .audio: AppTheme.teal.opacity(0.12)
        }
    }
}

private struct PracticeRecordDetailView: View {
    let record: PracticeRecord
    let resolveMedia: (String) async -> MediaPlaybackResource?
    let onUpdateAttachment: (PracticeAttachment) async -> Void
    let onDeleteAttachment: ((PracticeAttachment) async -> Void)?
    let onDelete: (() async -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var attachments: [PracticeAttachment]
    @State private var managedAttachment: PracticeAttachment?

    init(
        record: PracticeRecord,
        resolveMedia: @escaping (String) async -> MediaPlaybackResource? = { _ in nil },
        onUpdateAttachment: @escaping (PracticeAttachment) async -> Void = { _ in },
        onDeleteAttachment: ((PracticeAttachment) async -> Void)? = nil,
        onDelete: (() async -> Void)? = nil
    ) {
        self.record = record
        self.resolveMedia = resolveMedia
        self.onUpdateAttachment = onUpdateAttachment
        self.onDeleteAttachment = onDeleteAttachment
        self.onDelete = onDelete
        _attachments = State(initialValue: record.attachments)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "记录详情")
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(record.materialTitle)
                            .font(.title2.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text("\(record.score) 分")
                            .font(.headline.weight(.bold))
                            .foregroundStyle(AppTheme.orange)
                        Text(record.note)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                        if !record.reminder.isEmpty {
                            Text("下次提醒：\(record.reminder)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.blue)
                        }
                    }
                }
                if !attachments.isEmpty {
                    AppCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("媒体证据")
                                .font(.headline.weight(.heavy))
                            ForEach(attachments) { attachment in
                                MediaAttachmentView(
                                    attachment: attachment,
                                    embedded: true,
                                    onResolve: resolveMedia
                                )
                                HStack {
                                    Spacer()
                                    SmallPillButton(title: "管理\(attachmentTitle(attachment))") {
                                        managedAttachment = attachment
                                    }
                                }
                            }
                        }
                    }
                }
                HStack(spacing: 12) {
                    if let onDelete {
                        Button("删除记录", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                        .font(.headline.weight(.bold))
                        .foregroundStyle(AppTheme.error)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppTheme.error.opacity(0.10), in: Capsule())
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .navigationDestination(isPresented: Binding(
            get: { managedAttachment != nil },
            set: { if !$0 { managedAttachment = nil } }
        )) {
            if let attachment = managedAttachment {
                AttachmentDetailView(attachment: attachment) { updatedAttachment in
                    attachments = attachments.map { $0.id == updatedAttachment.id ? updatedAttachment : $0 }
                    await onUpdateAttachment(updatedAttachment)
                } onDelete: {
                    attachments.removeAll { $0.id == attachment.id }
                    await onDeleteAttachment?(attachment)
                    managedAttachment = nil
                }
            }
        }
        .rootTabBarVisibility(.hidden)
    }

    private func attachmentTitle(_ attachment: PracticeAttachment) -> String {
        switch attachment.type {
        case .image: "照片"
        case .video: "视频"
        case .audio: "音频"
        }
    }
}

private struct AttachmentDetailView: View {
    let attachment: PracticeAttachment
    let onUpdate: (PracticeAttachment) async -> Void
    let onDelete: (() async -> Void)?
    @Environment(\.dismiss) private var dismiss
    @StateObject private var audioPlayer = AudioPreviewController()
    @State private var videoPlayer = VideoPreviewController()
    @State private var playbackRate = "1x"
    @State private var markerTime = 0.0
    @State private var markerKind = "issue"
    @State private var markerNote = ""
    @State private var draftAttachment: PracticeAttachment

    init(
        attachment: PracticeAttachment,
        onUpdate: @escaping (PracticeAttachment) async -> Void = { _ in },
        onDelete: (() async -> Void)? = nil
    ) {
        self.attachment = attachment
        self.onUpdate = onUpdate
        self.onDelete = onDelete
        _draftAttachment = State(initialValue: attachment)
    }

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: attachmentTitle)
                switch draftAttachment.type {
                case .audio:
                    audioPreview
                case .video:
                    videoPreview
                case .image:
                    imagePreview
                }
                HStack(spacing: 12) {
                    if let onDelete {
                        Button("删除附件", role: .destructive) {
                            Task {
                                await onDelete()
                                dismiss()
                            }
                        }
                        .font(.headline.weight(.bold))
                        .foregroundStyle(AppTheme.error)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppTheme.error.opacity(0.10), in: Capsule())
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .onChange(of: playbackRate) { _, newValue in
            videoPlayer.apply(rateLabel: newValue)
        }
        .onDisappear {
            audioPlayer.stop()
            videoPlayer.stop()
        }
        .rootTabBarVisibility(.hidden)
    }

    private var imagePreview: some View {
        MediaAttachmentView(attachment: draftAttachment)
    }

    private var audioPreview: some View {
        MediaAttachmentView(attachment: draftAttachment)
    }

    private var videoPreview: some View {
        MediaAttachmentView(
            attachment: draftAttachment,
            onResolve: { fileID in
                await resolveAttachment(fileID: fileID)
            }
        )
    }

    private func resolveAttachment(fileID: String) async -> MediaPlaybackResource? {
        guard let url = MediaPreviewSupport.previewURL(from: fileID) else { return nil }
        return MediaPlaybackResource(fileID: fileID, url: url)
    }

    private var markerKinds: [(value: String, label: String)] {
        [
            ("good", "做得好"),
            ("issue", "待改进"),
            ("reminder", "下次重点"),
            ("neutral", "观察")
        ]
    }

    private func markerKindLabel(_ kind: String) -> String {
        markerKinds.first { $0.value == kind }?.label ?? "观察"
    }

    private func addMarker() {
        let cleanNote = markerNote.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanNote.isEmpty else { return }
        draftAttachment.markers.append(
            AttachmentMarker(time: markerTime, kind: markerKind, note: cleanNote)
        )
        markerNote = ""
        Task {
            await onUpdate(draftAttachment)
        }
    }

    private var attachmentTitle: String {
        switch attachment.type {
        case .image: "照片预览"
        case .video: "视频关键时刻"
        case .audio: "音频预览"
        }
    }
}

private struct VideoCompareView: View {
    let records: [PracticeRecord]
    let onSave: (ComparisonNote) async -> Void
    @Environment(\.adaptiveLayoutMode) private var adaptiveLayoutMode
    @Environment(\.dismiss) private var dismiss
    @State private var improvement = ""
    @State private var issue = ""
    @State private var nextFocus = ""
    @State private var leftPlayer = AVPlayer()
    @State private var rightPlayer = AVPlayer()

    var body: some View {
        AppPageShell(bottomInset: 24) {
            VStack(alignment: .leading, spacing: 18) {
                PageTitle(title: "双视频对比")
                let playerLayout = adaptiveLayoutMode == .split
                    ? AnyLayout(HStackLayout(spacing: 12))
                    : AnyLayout(VStackLayout(spacing: 12))
                playerLayout {
                    comparePlayer(title: records.first?.materialTitle ?? "视频 A", player: leftPlayer)
                    comparePlayer(title: records.dropFirst().first?.materialTitle ?? "视频 B", player: rightPlayer)
                }
                ForEach(records) { record in
                    AppCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("\(record.score) 分 · \(record.materialTitle)")
                                .font(.headline.weight(.heavy))
                                .foregroundStyle(AppTheme.textPrimary)
                            Text(record.note)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppTheme.textSecondary)
                        }
                    }
                }
                AppCard {
                    VStack(alignment: .leading, spacing: 12) {
                        AppTextEditor(text: $improvement, placeholder: "变化", minHeight: 72)
                        AppTextEditor(text: $issue, placeholder: "仍需改进", minHeight: 72)
                        AppTextEditor(text: $nextFocus, placeholder: "下次重点", minHeight: 72)
                    }
                }
                PrimaryButton(title: "保存对比复盘") {
                    save()
                }
            }
        }
        .onAppear { configurePlayers() }
        .rootTabBarVisibility(.hidden)
    }

    private func comparePlayer(title: String, player: AVPlayer) -> some View {
        AppCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(AppTheme.textPrimary)
                VideoPlayer(player: player)
                    .frame(height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                HStack {
                    SmallPillButton(title: "播放") { player.play() }
                    SmallPillButton(title: "暂停") { player.pause() }
                }
            }
        }
    }

    private func configurePlayers() {
        let urls = records.compactMap { record -> URL? in
            record.attachments.first(where: { $0.type == .video }).flatMap { MediaPreviewSupport.previewURL(from: $0.fileID) }
        }
        if let left = urls.first { leftPlayer = AVPlayer(url: left) }
        if let right = urls.dropFirst().first ?? urls.first { rightPlayer = AVPlayer(url: right) }
    }

    private func save() {
        let note = ComparisonNote(
            comparedRecordIds: records.map(\.id),
            improvement: improvement.trimmingCharacters(in: .whitespacesAndNewlines),
            issue: issue.trimmingCharacters(in: .whitespacesAndNewlines),
            nextFocus: nextFocus.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        guard !note.improvement.isEmpty || !note.issue.isEmpty || !note.nextFocus.isEmpty else { return }
        Task {
            await onSave(note)
            dismiss()
        }
    }
}

@MainActor
private final class VideoPreviewController: ObservableObject {
    private var player: AVPlayer?

    func player(for url: URL) -> AVPlayer {
        if let current = player, let asset = current.currentItem?.asset as? AVURLAsset, asset.url == url {
            return current
        }
        let next = MediaPreviewSupport.makePlayer(for: url)
        player = next
        return next
    }

    func attachResolvedResource(_ resource: MediaPlaybackResource) {
        if resource.url.isFileURL || ["http", "https"].contains(resource.url.scheme?.lowercased() ?? "") {
            player = AVPlayer(url: resource.url)
        }
    }

    func apply(rateLabel: String) {
        let rate: Float
        switch rateLabel {
        case "0.5x": rate = 0.5
        case "1x": rate = 1.0
        case "1.25x": rate = 1.25
        case "1.5x": rate = 1.5
        default: rate = 1.0
        }
        player?.rate = rate
    }

    func load(url: URL) {
        let next = MediaPreviewSupport.makePlayer(for: url)
        player = next
        next.play()
    }

    func stop() {
        player?.pause()
    }
}

@MainActor
private final class AudioPreviewController: ObservableObject {
    @Published private(set) var isPlaying = false
    @Published private(set) var statusText = "音频播放预览"
    private var player: AVAudioPlayer?

    func toggle(fileID: String) {
        if isPlaying {
            player?.pause()
            isPlaying = false
            statusText = "已暂停"
            return
        }
        guard let url = URL(string: fileID), url.isFileURL else {
            statusText = "没有可播放的本地音频地址"
            return
        }
        do {
            if player == nil || player?.url != url {
                player = try AVAudioPlayer(contentsOf: url)
            }
            player?.play()
            isPlaying = true
            statusText = "正在播放"
        } catch {
            statusText = "音频暂时无法播放"
        }
    }

    func stop() {
        player?.stop()
        isPlaying = false
    }
}
