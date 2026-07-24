import Foundation
import Combine

public enum AdaptiveLayoutMode: Equatable, Sendable {
    case compact
    case split

    public static func resolve(isPad: Bool, usesRegularWidth: Bool) -> AdaptiveLayoutMode {
        isPad && usesRegularWidth ? .split : .compact
    }
}

public enum ViewState: Equatable, Sendable {
    case idle
    case loading
    case loaded
    case empty(String)
    case failed(String)
}

private func loadAllMaterials(from repository: any MaterialRepository) async throws -> [Material] {
    var filters = MaterialListFilters(limit: 100)
    var materials: [Material] = []
    var loadedIDs = Set<String>()

    while true {
        let result = try await repository.listMaterials(filters: filters)
        let nextItems = result.items.filter { loadedIDs.insert($0.id).inserted }
        materials.append(contentsOf: nextItems)

        guard result.hasMore,
              let nextOffset = result.nextOffset,
              nextOffset > filters.offset
        else { return materials }
        filters.offset = nextOffset
    }
}

@MainActor
public final class DiscoverViewModel: ObservableObject {
    @Published public private(set) var materials: [Material] = []
    @Published public private(set) var allMaterials: [Material] = []
    @Published public private(set) var selectedMaterial: Material?
    @Published public private(set) var selectedPracticeRecords: [PracticeRecord] = []
    @Published public var filters = MaterialListFilters()
    @Published public private(set) var state: ViewState = .idle
    @Published public private(set) var total = 0
    @Published public private(set) var availableTotal = 0
    @Published public private(set) var categoryCounts: [MaterialType: Int] = [:]
    @Published public private(set) var abilityFacets: [FacetOption] = []
    @Published public private(set) var sceneFacets: [FacetOption] = []
    @Published public private(set) var hasMore = false
    @Published public private(set) var isLoadingMore = false
    @Published public var message: String?

    private let materialRepository: any MaterialRepository
    private let practiceRepository: (any PracticeRecordRepository)?
    private let sessionStore: TaskSessionStore
    private var searchTask: Task<Void, Never>?

    public init(materialRepository: any MaterialRepository, practiceRepository: (any PracticeRecordRepository)? = nil, sessionStore: TaskSessionStore) {
        self.materialRepository = materialRepository
        self.practiceRepository = practiceRepository
        self.sessionStore = sessionStore
    }

    public func load() async {
        state = .loading
        var request = filters
        request.offset = 0
        request.limit = max(request.limit, 100)
        do {
            let result = try await materialRepository.listMaterials(filters: request)
            apply(result, replacing: true)
        } catch is CancellationError {
            return
        } catch {
            state = .failed("素材加载失败，请重试")
        }
    }

    public func loadMoreIfNeeded(current material: Material) async {
        guard hasMore, !isLoadingMore,
              materials.suffix(5).contains(where: { $0.id == material.id })
        else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        var request = filters
        request.offset = materials.count
        do {
            let result = try await materialRepository.listMaterials(filters: request)
            apply(result, replacing: false)
        } catch is CancellationError {
            return
        } catch {
            message = "更多素材加载失败，请重试"
        }
    }

    public var resultTotal: Int { total }

    public var activeFilterCount: Int {
        [
            filters.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0 : 1,
            filters.type == nil ? 0 : 1,
            filters.ability == nil ? 0 : 1,
            filters.scene == nil ? 0 : 1,
            filters.onlySaved ? 1 : 0,
            filters.onlyPlayed ? 1 : 0
        ].reduce(0, +)
    }

    public var availableTypes: [MaterialType] {
        var next = filters
        next.type = nil
        let candidates = filteredMaterials(using: next)
        return MaterialType.allCases.filter { type in
            type == filters.type || candidates.contains { $0.type == type }
        }
    }

    public var availableAbilities: [String] {
        if !abilityFacets.isEmpty { return abilityFacets.filter { $0.count > 0 || $0.selected }.map(\.value) }
        var next = filters
        next.ability = nil
        return availableValues(selected: filters.ability, materials: filteredMaterials(using: next)) { material in material.abilities + material.tags }
    }

    public var availableScenes: [String] {
        if !sceneFacets.isEmpty { return sceneFacets.filter { $0.count > 0 || $0.selected }.map(\.value) }
        var next = filters
        next.scene = nil
        return availableValues(selected: filters.scene, materials: filteredMaterials(using: next)) { material in material.scenes + material.tags }
    }

    public func previewResultCount(type: MaterialType? = nil, ability: String? = nil, scene: String? = nil, onlySaved: Bool? = nil, onlyPlayed: Bool? = nil) -> Int {
        var next = filters
        if let type { next.type = type }
        if let ability { next.ability = ability }
        if let scene { next.scene = scene }
        if let onlySaved { next.onlySaved = onlySaved }
        if let onlyPlayed { next.onlyPlayed = onlyPlayed }
        return filteredMaterials(using: next).count
    }

    public func resultCount(for draft: MaterialListFilters) -> Int {
        filteredMaterials(using: draft).count
    }

    public func applyFilters(_ draft: MaterialListFilters) async {
        searchTask?.cancel()
        filters = draft
        if draft.offset == 0 {
            materials = []
        }
        await load()
    }

    public func scheduleQuery(_ query: String) {
        searchTask?.cancel()
        searchTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .milliseconds(350))
                guard !Task.isCancelled else { return }
                await self?.applyQuery(query)
            } catch {}
        }
    }

    public func applyQuery(_ query: String) async {
        filters.query = query
        await load()
    }

    public func applyType(_ type: MaterialType?) async {
        filters.type = type
        await load()
    }

    public func applyAbility(_ ability: String?) async {
        filters.ability = ability
        await load()
    }

    public func applyScene(_ scene: String?) async {
        filters.scene = scene
        await load()
    }

    public func applySaved(_ enabled: Bool) async {
        filters.onlySaved = enabled
        await load()
    }

    public func applyPlayed(_ enabled: Bool) async {
        filters.onlyPlayed = enabled
        await load()
    }

    public func applySource(_ source: MaterialSourceFilter) async {
        filters.source = source
        materials = []
        await load()
    }

    public func clearFilters() async {
        let query = filters.query
        filters = MaterialListFilters(query: query, source: filters.source)
        materials = []
        await load()
    }

    public func clearStatusFilters() async {
        filters.onlySaved = false
        filters.onlyPlayed = false
        await load()
    }

    public func resetSearchAndFilters() async {
        filters = MaterialListFilters(source: filters.source)
        materials = []
        await load()
    }

    public func toggleSaved(_ material: Material) async {
        do {
            let updated = try await materialRepository.updateMaterialState(id: material.id, saved: !material.saved, played: nil, context: WriteContext())
            replace(updated)
        } catch {
            message = "收藏状态保存失败"
        }
    }

    public func togglePlayed(_ material: Material) async {
        do {
            let updated = try await materialRepository.updateMaterialState(id: material.id, saved: nil, played: !material.played, context: WriteContext())
            replace(updated)
        } catch {
            message = "练过状态保存失败"
        }
    }

    public func randomMaterial() async {
        do {
            selectedMaterial = try await materialRepository.randomMaterial(filters: filters, excluding: selectedMaterial?.id)
            if selectedMaterial == nil { message = "当前没有可训练的素材" }
        } catch {
            message = "抽取素材失败，请重试"
        }
    }

    public func startPractice(_ material: Material) {
        do {
            try sessionStore.startMaterialSession(for: material)
            message = "已开始：\(material.title)"
        } catch {
            message = error.localizedDescription
        }
    }

    public var currentMaterialSession: MaterialSession? {
        sessionStore.currentMaterial
    }

    public func pauseOrResumeMaterialSession() {
        sessionStore.pauseOrResumeMaterialSession()
    }

    public func loadPracticeRecords(materialId: String) async {
        do {
            selectedPracticeRecords = try await practiceRepository?.listPracticeRecords(materialId: materialId) ?? []
        } catch {
            selectedPracticeRecords = []
            message = "练习记录加载失败"
        }
    }

    public func relatedMaterial(for material: Material) -> Material? {
        guard !material.relatedMaterialId.isEmpty else { return nil }
        return allMaterials.first { $0.id == material.relatedMaterialId }
    }

    public func updatePracticeRecord(_ record: PracticeRecord) async -> PracticeRecord? {
        do {
            guard let practiceRepository else { return nil }
            let updated = try await practiceRepository.updatePracticeRecord(record, context: WriteContext())
            selectedPracticeRecords = selectedPracticeRecords.map { $0.id == updated.id ? updated : $0 }
            message = "练习记录已更新"
            return updated
        } catch {
            message = "练习记录更新失败"
            return nil
        }
    }

    public func createMaterial(title: String, desc: String, type: MaterialType, tags: [String] = ["自建"], abilities: [String] = [], scenes: [String] = ["个人空间"], steps: [String] = [], tips: String = "", variant: String = "", issue: String = "", relatedMaterialId: String = "") async -> Bool {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDesc = desc.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, !cleanDesc.isEmpty else {
            message = "素材标题和描述必填"
            return false
        }
        do {
            let material = Material(id: UUID().uuidString, title: cleanTitle, desc: cleanDesc, type: type, tags: tags, abilities: abilities, scenes: scenes, steps: steps, tips: tips, variant: variant, issue: issue, relatedMaterialId: relatedMaterialId)
            let saved = try await materialRepository.createMaterial(material, context: WriteContext())
            allMaterials.insert(saved, at: 0)
            refreshFilteredState()
            message = "素材已加入素材库"
            return true
        } catch {
            message = "素材保存失败"
            return false
        }
    }

    public func updateMaterial(_ material: Material, title: String, desc: String, type: MaterialType, tags: [String]? = nil, abilities: [String]? = nil, scenes: [String]? = nil, steps: [String]? = nil, tips: String? = nil, variant: String? = nil, issue: String? = nil, relatedMaterialId: String? = nil) async -> Bool {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDesc = desc.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, !cleanDesc.isEmpty else {
            message = "素材标题和描述必填"
            return false
        }
        var next = material
        next.title = cleanTitle
        next.desc = cleanDesc
        next.type = type
        next.tags = tags ?? next.tags
        next.abilities = abilities ?? next.abilities
        next.scenes = scenes ?? next.scenes
        next.steps = steps ?? next.steps
        next.tips = tips ?? next.tips
        next.variant = variant ?? next.variant
        next.issue = issue ?? next.issue
        next.relatedMaterialId = relatedMaterialId ?? next.relatedMaterialId
        next.referenceOnly = type == .path
        do {
            let saved = try await materialRepository.updateMaterial(next, context: WriteContext())
            allMaterials = allMaterials.map { $0.id == saved.id ? saved : $0 }
            replace(saved)
            message = "素材已更新"
            return true
        } catch {
            message = "素材更新失败"
            return false
        }
    }

    public func deleteMaterial(_ material: Material) async -> Bool {
        do {
            try await materialRepository.deleteMaterial(id: material.id, context: WriteContext())
            allMaterials.removeAll { $0.id == material.id }
            refreshFilteredState()
            selectedMaterial = nil
            message = "素材已删除"
            return true
        } catch {
            message = "素材删除失败"
            return false
        }
    }

    private func apply(_ result: MaterialListResult, replacing: Bool) {
        if replacing {
            materials = result.items
            allMaterials = result.items
        } else {
            let existing = Set(materials.map(\.id))
            let additions = result.items.filter { !existing.contains($0.id) }
            materials.append(contentsOf: additions)
            allMaterials = materials
        }
        total = result.total
        availableTotal = result.availableTotal
        categoryCounts = result.categoryCounts
        abilityFacets = result.abilityFacets
        sceneFacets = result.sceneFacets
        hasMore = result.hasMore
        filters.offset = result.nextOffset ?? materials.count
        if availableTotal == 0 {
            state = .empty("还没有素材，先添加第一张卡片。")
        } else if materials.isEmpty {
            state = .empty("没有匹配素材")
        } else {
            state = .loaded
        }
    }

    private func replace(_ material: Material) {
        allMaterials = allMaterials.map { $0.id == material.id ? material : $0 }
        refreshFilteredState()
        if selectedMaterial?.id == material.id {
            selectedMaterial = material
        }
    }

    private func refreshFilteredState() {
        materials = filteredMaterials(using: filters)
        if allMaterials.isEmpty {
            state = .empty("还没有素材，先添加第一张卡片。")
        } else if materials.isEmpty {
            state = .empty("没有匹配素材")
        } else {
            state = .loaded
        }
    }

    private func filteredMaterials(using filters: MaterialListFilters) -> [Material] {
        allMaterials.filter { material in
            if let type = filters.type, material.type != type { return false }
            if let ability = filters.ability, !material.abilities.contains(ability) && !material.tags.contains(ability) { return false }
            if let scene = filters.scene, !material.scenes.contains(scene) && !material.tags.contains(scene) { return false }
            if filters.onlySaved, !material.saved { return false }
            if filters.onlyPlayed, !material.played { return false }
            if filters.source == .owned, !material.isOwnedByCurrentUser { return false }
            let query = filters.query.trimmingCharacters(in: .whitespacesAndNewlines)
            if query.isEmpty { return true }
            let haystack = ([material.title, material.desc] + material.tags + material.abilities + material.scenes).joined(separator: " ")
            return haystack.localizedCaseInsensitiveContains(query)
        }
    }

    private func availableValues(selected: String?, materials: [Material], extract: (Material) -> [String]) -> [String] {
        let values = materials.flatMap(extract)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return Array(Set(values + [selected].compactMap { $0 })).sorted()
    }
}

@MainActor
public final class RecordViewModel: ObservableObject {
    @Published public private(set) var inspirations: [Inspiration] = []
    @Published public private(set) var rehearsals: [Rehearsal] = []
    @Published public private(set) var practiceRecords: [PracticeRecord] = []
    @Published public private(set) var materials: [Material] = []
    @Published public private(set) var methodCards: [MethodCard] = []
    @Published public var quickText = ""
    @Published public var quickAttachments: [PracticeAttachment] = []
    @Published public var message: String?
    @Published public private(set) var state: ViewState = .idle
    @Published public private(set) var isSaving = false
    @Published public private(set) var isUploadingMedia = false

    private let inspirationRepository: any InspirationRepository
    private let materialRepository: any MaterialRepository
    private let practiceRepository: any PracticeRecordRepository
    private let rehearsalRepository: any RehearsalRepository
    private let methodCardRepository: any MethodCardRepository
    private let mediaRepository: any MediaUploadRepository
    private let sessionStore: TaskSessionStore

    public init(
        inspirationRepository: any InspirationRepository,
        materialRepository: any MaterialRepository,
        practiceRepository: any PracticeRecordRepository,
        rehearsalRepository: any RehearsalRepository,
        methodCardRepository: any MethodCardRepository,
        mediaRepository: any MediaUploadRepository,
        sessionStore: TaskSessionStore
    ) {
        self.inspirationRepository = inspirationRepository
        self.materialRepository = materialRepository
        self.practiceRepository = practiceRepository
        self.rehearsalRepository = rehearsalRepository
        self.methodCardRepository = methodCardRepository
        self.mediaRepository = mediaRepository
        self.sessionStore = sessionStore
    }

    public func load() async {
        state = .loading
        do {
            async let nextInspirations = inspirationRepository.listInspirations()
            async let nextMaterials = loadAllMaterials(from: materialRepository)
            async let nextRecords = practiceRepository.listPracticeRecords(materialId: nil)
            async let nextRehearsals = rehearsalRepository.listRehearsals()
            async let nextMethodCards = methodCardRepository.listMethodCards()
            inspirations = try await nextInspirations
            materials = try await nextMaterials
            practiceRecords = try await nextRecords
            rehearsals = try await nextRehearsals
            methodCards = try await nextMethodCards
            state = .loaded
        } catch {
            state = .failed("记录加载失败，请重试")
        }
    }

    @discardableResult
    public func saveQuickInspiration() async -> Bool {
        let text = quickText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            message = "先写一点内容"
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            let inspiration = Inspiration(title: Self.localRecordTitle(), desc: text, meta: ["快速记录", "未归档", "待整理"], attachments: quickAttachments)
            let saved = try await inspirationRepository.createInspiration(inspiration, context: WriteContext())
            inspirations.insert(saved, at: 0)
            quickText = ""
            quickAttachments = []
            message = "已保存到待整理"
            return true
        } catch {
            message = "保存失败，草稿已保留"
            return false
        }
    }

    @discardableResult
    public func saveQuickMedia(localURL: URL, type: AttachmentType, duration: TimeInterval? = nil) async -> Bool {
        guard !isUploadingMedia else { return false }
        isUploadingMedia = true
        defer { isUploadingMedia = false }
        do {
            var attachment = try await mediaRepository.uploadAttachment(localURL: localURL, type: type, scope: "inspiration.attachment")
            if attachment.duration == nil { attachment.duration = duration }
            let text = quickText.trimmingCharacters(in: .whitespacesAndNewlines)
            let fallback = type == .video ? "视频记录" : type == .audio ? "录音记录" : "照片记录"
            let inspiration = Inspiration(
                title: Self.localRecordTitle(),
                desc: text.isEmpty ? fallback : text,
                meta: [attachmentLabel(type), "未归档", "待整理"],
                attachments: [attachment]
            )
            let saved = try await inspirationRepository.createInspiration(inspiration)
            inspirations.insert(saved, at: 0)
            quickText = ""
            message = "已保存到待整理"
            return true
        } catch {
            message = "附件保存失败，当前输入已保留"
            return false
        }
    }

    public func addQuickAttachment(type: AttachmentType, fileID: String? = nil, duration: TimeInterval? = nil) {
        let fileExtension: String
        switch type {
        case .image: fileExtension = "jpg"
        case .video: fileExtension = "mp4"
        case .audio: fileExtension = "m4a"
        }
        quickAttachments.append(
            PracticeAttachment(
                id: UUID().uuidString,
                type: type,
                fileID: fileID ?? "mock://quick-\(type.rawValue)-\(quickAttachments.count + 1).\(fileExtension)",
                duration: type == .audio ? (duration ?? 12) : nil
            )
        )
        message = "已添加\(attachmentLabel(type))"
    }

    public func removeQuickAttachment(id: String) {
        quickAttachments.removeAll { $0.id == id }
    }

    private func attachmentLabel(_ type: AttachmentType) -> String {
        switch type {
        case .image: "照片"
        case .video: "视频"
        case .audio: "录音"
        }
    }

    @discardableResult
    public func startPractice(material: Material, mode: PracticeStartMode = .session) -> Bool {
        guard mode == .session else { return true }
        do {
            try sessionStore.startMaterialSession(for: material)
            message = "已开始：\(material.title)"
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }

    @discardableResult
    public func startRehearsal(teamName: String, duration: String = "90", goals: [String] = [], source: RehearsalSource = .recommended) async -> Bool {
        let trimmed = teamName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanGoals = goals
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if materials.isEmpty {
            materials = (try? await loadAllMaterials(from: materialRepository)) ?? []
        }
        let trainable = materials.filter { !$0.referenceOnly }
        let candidates: [Material]
        switch source {
        case .recommended:
            candidates = Array(trainable.shuffled().prefix(3))
        case .saved:
            candidates = Array(trainable.filter(\.saved).shuffled().prefix(3))
        case .blank:
            candidates = []
        }
        guard source != .saved || !candidates.isEmpty else {
            message = "先去发现页收藏素材"
            return false
        }
        let cleanDuration = duration.trimmingCharacters(in: .whitespacesAndNewlines)
        let durationText = cleanDuration.isEmpty ? "90 分钟" : cleanDuration.contains("分钟") ? cleanDuration : "\(cleanDuration) 分钟"
        let finalTeamName = trimmed.isEmpty ? Self.defaultRehearsalName() : trimmed
        let rehearsal = Rehearsal(
            title: finalTeamName,
            desc: cleanGoals.isEmpty ? "先开始再补充目标" : cleanGoals.joined(separator: " → "),
            teamName: finalTeamName,
            duration: durationText,
            goals: cleanGoals,
            source: source,
            plan: candidates.map { material in
                RehearsalPlanItem(
                    materialId: material.id,
                    materialTitle: material.title
                )
            }
        )
        isSaving = true
        defer { isSaving = false }
        var sessionStarted = false
        do {
            try sessionStore.startRehearsal(rehearsal)
            sessionStarted = true
            let saved = try await rehearsalRepository.createRehearsal(rehearsal, context: WriteContext())
            sessionStore.updateCurrentRehearsal(saved)
            rehearsals.insert(saved, at: 0)
            message = "排练已开始"
            return true
        } catch {
            if sessionStarted { sessionStore.finishRehearsal() }
            message = error.localizedDescription
            return false
        }
    }

    public func updatePracticeRecord(_ record: PracticeRecord) async -> PracticeRecord? {
        do {
            let updated = try await practiceRepository.updatePracticeRecord(record)
            practiceRecords = practiceRecords.map { $0.id == updated.id ? updated : $0 }
            message = "练习记录已更新"
            return updated
        } catch {
            message = "练习记录更新失败"
            return nil
        }
    }

    public func deletePracticeRecord(_ record: PracticeRecord) async -> Bool {
        do {
            try await practiceRepository.deletePracticeRecord(id: record.id, context: WriteContext())
            practiceRecords.removeAll { $0.id == record.id }
            message = "练习记录已删除"
            return true
        } catch {
            message = "练习记录删除失败"
            return false
        }
    }

    public var todayInspirations: [Inspiration] {
        inspirations.filter { Calendar.current.isDateInToday($0.createdAt) }
    }

    public var todayRehearsals: [Rehearsal] {
        rehearsals.filter { Calendar.current.isDateInToday($0.createdAt) }
    }

    public var recommendedMaterial: Material? {
        materials.first { !$0.referenceOnly }
    }

    private static func localRecordTitle() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日记录"
        return formatter.string(from: Date())
    }

    private static func defaultRehearsalName() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM-dd"
        return "我的排练 \(formatter.string(from: Date()))"
    }
}

@MainActor
public final class PracticeFeedbackViewModel: ObservableObject {
    @Published public var score = 7
    @Published public var note = ""
    @Published public var attendance = ""
    @Published public var reminder = ""
    @Published public var attachments: [PracticeAttachment] = []
    @Published public private(set) var historicalRehearsals: [Rehearsal] = []
    @Published public var linkedHistoricalRehearsalId = ""
    @Published public var message: String?
    @Published public private(set) var historicalState: ViewState = .idle
    @Published public private(set) var isSaving = false
    @Published public private(set) var isUploadingAttachment = false

    private let practiceRepository: any PracticeRecordRepository
    private let methodCardRepository: any MethodCardRepository
    private let rehearsalRepository: (any RehearsalRepository)?
    private let mediaRepository: any MediaUploadRepository
    private let sessionStore: TaskSessionStore

    public init(practiceRepository: any PracticeRecordRepository, methodCardRepository: any MethodCardRepository, rehearsalRepository: (any RehearsalRepository)? = nil, mediaRepository: any MediaUploadRepository, sessionStore: TaskSessionStore) {
        self.practiceRepository = practiceRepository
        self.methodCardRepository = methodCardRepository
        self.rehearsalRepository = rehearsalRepository
        self.mediaRepository = mediaRepository
        self.sessionStore = sessionStore
    }

    public func loadHistoricalRehearsals() async {
        historicalState = .loading
        do {
            historicalRehearsals = try await rehearsalRepository?.listRehearsals() ?? []
            historicalState = .loaded
        } catch {
            historicalRehearsals = []
            historicalState = .failed("排练加载失败，可单独保存")
        }
    }

    @discardableResult
    public func save(material: Material, createMethodCard: Bool = false) async -> Bool {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            message = "先写本次复盘"
            return false
        }
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            let linkedRehearsal = selectedLinkedRehearsal
            let record = PracticeRecord(
                materialId: material.id,
                materialTitle: material.title,
                rehearsalId: linkedRehearsal?.id ?? "",
                rehearsalTitle: linkedRehearsal?.title ?? "",
                score: score,
                note: trimmed,
                attachments: attachments,
                reminder: reminder,
                duration: activeMaterialDurationText ?? "0 秒",
                meta: attendance.isEmpty ? [] : ["\(attendance)人"]
            )
            let rehearsalPatch = linkedRehearsal.map {
                RehearsalMaterialStatusUpdate(
                    rehearsalId: $0.id,
                    materialId: material.id,
                    status: .completed,
                    keep: score >= 7 ? trimmed : "",
                    tryNext: score < 7 ? trimmed : ""
                )
            }
            let methodCard = createMethodCard ? MethodCard(title: material.title, desc: trimmed, sourceType: "practice") : nil
            _ = try await practiceRepository.completePractice(
                PracticeCompletionPayload(practiceRecord: record, rehearsalPatch: rehearsalPatch, methodCard: methodCard),
                context: WriteContext()
            )
            sessionStore.finishMaterialSession()
            note = ""
            attendance = ""
            reminder = ""
            attachments = []
            linkedHistoricalRehearsalId = ""
            message = "练习复盘已保存"
            return true
        } catch {
            message = "保存失败，草稿已保留"
            return false
        }
    }

    @discardableResult
    public func uploadAttachment(localURL: URL, type: AttachmentType, duration: TimeInterval? = nil) async -> Bool {
        guard !isUploadingAttachment else { return false }
        isUploadingAttachment = true
        defer { isUploadingAttachment = false }
        do {
            var attachment = try await mediaRepository.uploadAttachment(localURL: localURL, type: type, scope: "practice.attachment")
            if attachment.duration == nil { attachment.duration = duration }
            attachments.append(attachment)
            message = "已添加附件"
            return true
        } catch {
            message = "附件添加失败，请重试"
            return false
        }
    }

    public func addAttachment(type: AttachmentType, fileID: String? = nil, duration: TimeInterval? = nil) {
        let fileExtension: String
        switch type {
        case .image: fileExtension = "jpg"
        case .video: fileExtension = "mp4"
        case .audio: fileExtension = "m4a"
        }
        attachments.append(
            PracticeAttachment(
                id: UUID().uuidString,
                type: type,
                fileID: fileID ?? "mock://practice-\(type.rawValue)-\(attachments.count + 1).\(fileExtension)",
                duration: type == .audio ? (duration ?? 18) : nil
            )
        )
    }

    public func removeAttachment(id: String) {
        attachments.removeAll { $0.id == id }
    }

    public var activeRehearsalTitle: String? {
        sessionStore.currentRehearsal?.title
    }

    public var selectedLinkedRehearsal: Rehearsal? {
        if let current = sessionStore.currentRehearsal { return current }
        return historicalRehearsals.first { $0.id == linkedHistoricalRehearsalId }
    }

    public var activeMaterialDurationText: String? {
        guard let session = sessionStore.currentMaterial else { return nil }
        let seconds = max(0, Int(Date().timeIntervalSince(session.startTime)))
        if seconds < 60 { return "\(seconds) 秒" }
        return "\(seconds / 60) 分 \(seconds % 60) 秒"
    }
}

@MainActor
public final class RehearsalViewModel: ObservableObject {
    @Published public var rehearsal: Rehearsal?
    @Published public private(set) var materials: [Material] = []
    @Published public private(set) var linkedInspirations: [Inspiration] = []
    @Published public private(set) var state: ViewState = .idle
    @Published public private(set) var isSaving = false
    @Published public private(set) var lastCompletedRehearsal: Rehearsal?
    @Published public var quickNote = ""
    @Published public var message: String?

    private let rehearsalRepository: any RehearsalRepository
    private let materialRepository: any MaterialRepository
    private let inspirationRepository: any InspirationRepository
    private let methodCardRepository: any MethodCardRepository
    private let sessionStore: TaskSessionStore

    public init(rehearsalRepository: any RehearsalRepository, materialRepository: any MaterialRepository, inspirationRepository: any InspirationRepository, methodCardRepository: any MethodCardRepository, sessionStore: TaskSessionStore) {
        self.rehearsalRepository = rehearsalRepository
        self.materialRepository = materialRepository
        self.inspirationRepository = inspirationRepository
        self.methodCardRepository = methodCardRepository
        self.sessionStore = sessionStore
        self.rehearsal = sessionStore.currentRehearsal
    }

    public func refreshFromSession() async {
        state = .loading
        rehearsal = sessionStore.currentRehearsal
        do {
            async let nextMaterials = loadAllMaterials(from: materialRepository)
            async let nextInspirations = inspirationRepository.listInspirations()
            materials = try await nextMaterials.filter { !$0.referenceOnly }
            let allInspirations = try await nextInspirations
            linkedInspirations = allInspirations.filter { $0.linkedRehearsalId == rehearsal?.id }
            state = rehearsal == nil ? .empty("当前没有进行中的排练") : .loaded
        } catch {
            state = .failed("排练内容加载失败，请重试")
        }
    }

    public func updatePlan(materialId: String, status: TaskStatus? = nil, keep: String? = nil, tryNext: String? = nil) async {
        guard let currentRehearsal = rehearsal,
              let current = currentRehearsal.plan.first(where: { $0.materialId == materialId }),
              !isSaving
        else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let saved = try await rehearsalRepository.updateRehearsalMaterialStatus(
                RehearsalMaterialStatusUpdate(
                    rehearsalId: currentRehearsal.id,
                    materialId: materialId,
                    status: status ?? current.status,
                    keep: keep ?? current.keep,
                    tryNext: tryNext ?? current.tryNext,
                    rehearsalStatus: currentRehearsal.status
                ),
                context: WriteContext()
            )
            rehearsal = saved
            sessionStore.updateCurrentRehearsal(saved)
        } catch {
            message = "素材状态保存失败，草稿已保留"
        }
    }

    public func complete(keep: String, tryNext: String, reminder: String = "", createMethodCard: Bool) async -> Rehearsal? {
        guard var next = rehearsal, !isSaving else { return nil }
        next.status = .completed
        next.reviewKeep = keep
        next.reviewTry = tryNext
        next.reviewReminder = reminder
        isSaving = true
        defer { isSaving = false }
        do {
            let methodCard = createMethodCard
                ? MethodCard(title: next.title, desc: "\(keep)\n\(tryNext)", sourceType: "rehearsal")
                : nil
            let saved = try await rehearsalRepository.completeRehearsal(
                RehearsalCompletionPayload(rehearsalId: next.id, patch: next, methodCard: methodCard),
                context: WriteContext()
            )
            lastCompletedRehearsal = saved
            sessionStore.finishRehearsal()
            rehearsal = nil
            message = "排练复盘已保存"
            return saved
        } catch {
            message = "排练完成失败，复盘草稿已保留"
            return nil
        }
    }

    public func updateRehearsalInfo(title: String, duration: String, goals: [String]) async {
        guard var next = rehearsal else { return }
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        next.title = cleanTitle.isEmpty ? next.title : cleanTitle
        next.duration = duration
        next.goals = goals.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        await save(next)
    }

    public func pauseOrResume() async -> Bool {
        guard var next = rehearsal, !isSaving else { return false }
        next.status = next.status == .paused ? .inProgress : .paused
        return await save(next)
    }

    public func addMaterialToPlan(materialId: String) async {
        guard var next = rehearsal else { return }
        guard !next.plan.contains(where: { $0.materialId == materialId }) else {
            message = "素材已在排练计划中"
            return
        }
        next.plan.append(RehearsalPlanItem(materialId: materialId, materialTitle: materialTitle(for: materialId)))
        await save(next)
    }

    public func saveLinkedInspiration() async -> Bool {
        let text = quickNote.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let rehearsal, !text.isEmpty else {
            message = "先写下灵感"
            return false
        }
        do {
            let inspiration = Inspiration(
                title: "排练速记",
                desc: text,
                meta: ["灵感", "排练"],
                linkedRehearsalId: rehearsal.id,
                linkedRehearsalTitle: rehearsal.title
            )
            let saved = try await inspirationRepository.createInspiration(inspiration)
            linkedInspirations.insert(saved, at: 0)
            quickNote = ""
            message = "灵感已保存"
            return true
        } catch {
            message = "灵感保存失败，输入已保留"
            return false
        }
    }

    public func materialTitle(for materialId: String) -> String {
        materials.first(where: { $0.id == materialId })?.title ?? materialId
    }

    public func material(for materialId: String) -> Material? {
        materials.first { $0.id == materialId }
    }

    public func cyclePlanStatus(materialId: String) async {
        guard let current = rehearsal?.plan.first(where: { $0.materialId == materialId }) else { return }
        let next: TaskStatus
        switch current.status {
        case .notStarted: next = .inProgress
        case .inProgress: next = .completed
        case .completed: next = .notStarted
        case .paused: next = .inProgress
        }
        await updatePlan(materialId: materialId, status: next)
    }

    @discardableResult
    private func save(_ next: Rehearsal) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        do {
            let saved = try await rehearsalRepository.updateRehearsal(next, context: WriteContext())
            rehearsal = saved
            if saved.status != .completed {
                sessionStore.updateCurrentRehearsal(saved)
            }
            return true
        } catch {
            message = "保存失败，草稿已保留"
            return false
        }
    }
}

@MainActor
public final class MineViewModel: ObservableObject {
    @Published public private(set) var inspirations: [Inspiration] = []
    @Published public private(set) var practiceRecords: [PracticeRecord] = []
    @Published public private(set) var rehearsals: [Rehearsal] = []
    @Published public private(set) var methodCards: [MethodCard] = []
    @Published public private(set) var materials: [Material] = []
    @Published public private(set) var profile = Profile()
    @Published public private(set) var state: ViewState = .idle
    @Published public private(set) var isSavingProfile = false
    @Published public private(set) var isUploadingProfile = false
    @Published public private(set) var isSubmittingFeedback = false
    @Published public private(set) var isDeletingAccount = false
    @Published public var feedbackText = ""
    @Published public var feedbackCategory = "suggestion"
    @Published public var feedbackContact = ""
    @Published public var message: String?

    private let inspirationRepository: any InspirationRepository
    private let practiceRepository: any PracticeRecordRepository
    private let rehearsalRepository: any RehearsalRepository
    private let methodCardRepository: any MethodCardRepository
    private let materialRepository: any MaterialRepository
    private let profileRepository: any ProfileRepository
    private let feedbackRepository: any FeedbackRepository
    private let accountRepository: any AccountRepository
    private let mediaRepository: any MediaUploadRepository

    public init(
        inspirationRepository: any InspirationRepository,
        practiceRepository: any PracticeRecordRepository,
        rehearsalRepository: any RehearsalRepository,
        methodCardRepository: any MethodCardRepository,
        materialRepository: any MaterialRepository,
        profileRepository: any ProfileRepository,
        feedbackRepository: any FeedbackRepository,
        accountRepository: any AccountRepository,
        mediaRepository: any MediaUploadRepository
    ) {
        self.inspirationRepository = inspirationRepository
        self.practiceRepository = practiceRepository
        self.rehearsalRepository = rehearsalRepository
        self.methodCardRepository = methodCardRepository
        self.materialRepository = materialRepository
        self.profileRepository = profileRepository
        self.feedbackRepository = feedbackRepository
        self.accountRepository = accountRepository
        self.mediaRepository = mediaRepository
    }

    public func load() async {
        state = .loading
        do {
            async let nextProfile = profileRepository.getProfile()
            async let nextInspirations = inspirationRepository.listInspirations()
            async let nextRecords = practiceRepository.listPracticeRecords(materialId: nil)
            async let nextRehearsals = rehearsalRepository.listRehearsals()
            async let nextCards = methodCardRepository.listMethodCards()
            async let nextMaterials = loadAllMaterials(from: materialRepository)
            profile = try await nextProfile
            inspirations = try await nextInspirations
            practiceRecords = try await nextRecords
            rehearsals = try await nextRehearsals
            methodCards = try await nextCards
            materials = try await nextMaterials
            state = .loaded
        } catch {
            state = .failed("资产加载失败，请重试")
        }
    }

    public var pendingInspirations: [Inspiration] {
        inspirations.filter { $0.meta.contains("待整理") }
    }

    public var pendingRecordCount: Int {
        pendingInspirations.count + practiceRecords.count + rehearsals.filter { $0.status == .completed }.count
    }

    public var practicedMaterialCount: Int {
        Set(practiceRecords.map(\.materialId)).count
    }

    public func submitFeedback() async -> Bool {
        let text = feedbackText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 10 else {
            message = "反馈至少 10 个字"
            return false
        }
        guard text.count <= 500 else {
            message = "反馈最多 500 个字"
            return false
        }
        guard !isSubmittingFeedback else { return false }
        isSubmittingFeedback = true
        defer { isSubmittingFeedback = false }
        do {
            _ = try await feedbackRepository.createFeedback(
                Feedback(category: feedbackCategory, content: text, contact: feedbackContact, sourcePage: "mine"),
                context: WriteContext()
            )
            feedbackText = ""
            feedbackContact = ""
            message = "反馈已提交"
            return true
        } catch {
            message = "反馈提交失败"
            return false
        }
    }

    public func updateProfile(displayName: String, troupeName: String, avatarUrl: String? = nil) async -> Bool {
        let cleanName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else {
            message = "名字不能为空"
            return false
        }
        guard !isSavingProfile else { return false }
        isSavingProfile = true
        defer { isSavingProfile = false }
        do {
            profile = try await profileRepository.updateProfile(Profile(displayName: cleanName, avatarUrl: avatarUrl ?? profile.avatarUrl, troupeName: troupeName), context: WriteContext())
            message = "个人资料已更新"
            return true
        } catch {
            message = "个人资料保存失败"
            return false
        }
    }

    public func uploadProfileImage(localURL: URL) async -> String? {
        guard !isUploadingProfile else { return nil }
        isUploadingProfile = true
        defer { isUploadingProfile = false }
        do {
            let attachment = try await mediaRepository.uploadAttachment(localURL: localURL, type: .image, scope: "profile.avatar")
            return attachment.fileID
        } catch {
            message = "头像上传失败，请重试"
            return nil
        }
    }

    public func createMethodCard(title: String, desc: String, sourceType: String = "manual") async {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDesc = desc.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, !cleanDesc.isEmpty else {
            message = "方法卡标题和内容必填"
            return
        }
        do {
            let card = try await methodCardRepository.createMethodCard(MethodCard(title: cleanTitle, desc: cleanDesc, sourceType: sourceType), context: WriteContext())
            methodCards.insert(card, at: 0)
            message = "方法卡已保存"
        } catch {
            message = "方法卡保存失败"
        }
    }

    public func updateMethodCard(_ card: MethodCard, title: String, desc: String) async {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDesc = desc.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, !cleanDesc.isEmpty else {
            message = "方法卡标题和内容必填"
            return
        }
        do {
            let updated = try await methodCardRepository.updateMethodCard(MethodCard(id: card.id, title: cleanTitle, desc: cleanDesc, sourceType: card.sourceType, createdAt: card.createdAt), context: WriteContext())
            methodCards = methodCards.map { $0.id == updated.id ? updated : $0 }
            message = "方法卡已更新"
        } catch {
            message = "方法卡保存失败"
        }
    }

    public func deleteMethodCard(_ card: MethodCard) async {
        do {
            try await methodCardRepository.deleteMethodCard(id: card.id, context: WriteContext())
            methodCards.removeAll { $0.id == card.id }
            message = "方法卡已删除"
        } catch {
            message = "方法卡删除失败"
        }
    }

    public func updateInspiration(_ inspiration: Inspiration, title: String, desc: String, meta: [String]? = nil) async {
        let cleanTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDesc = desc.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, !cleanDesc.isEmpty else {
            message = "灵感标题和内容必填"
            return
        }
        do {
            let updated = try await inspirationRepository.updateInspiration(
                Inspiration(
                    id: inspiration.id,
                    title: cleanTitle,
                    desc: cleanDesc,
                    meta: meta ?? inspiration.meta,
                    linkedMaterialId: inspiration.linkedMaterialId,
                    linkedMaterialTitle: inspiration.linkedMaterialTitle,
                    linkedRehearsalId: inspiration.linkedRehearsalId,
                    linkedRehearsalTitle: inspiration.linkedRehearsalTitle,
                    attachments: inspiration.attachments,
                    createdAt: inspiration.createdAt
                ),
                context: WriteContext()
            )
            inspirations = inspirations.map { $0.id == updated.id ? updated : $0 }
            message = "灵感已更新"
        } catch {
            message = "灵感保存失败"
        }
    }

    public func updateInspiration(_ draft: Inspiration) async -> Bool {
        let cleanTitle = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanDesc = draft.desc.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTitle.isEmpty, !cleanDesc.isEmpty else {
            message = "灵感标题和内容必填"
            return false
        }
        var normalized = draft
        normalized.title = cleanTitle
        normalized.desc = cleanDesc
        do {
            let updated = try await inspirationRepository.updateInspiration(normalized, context: WriteContext())
            inspirations = inspirations.map { $0.id == updated.id ? updated : $0 }
            message = "灵感已更新"
            return true
        } catch {
            message = "灵感保存失败"
            return false
        }
    }

    public func deleteInspiration(_ inspiration: Inspiration) async {
        do {
            try await inspirationRepository.deleteInspiration(id: inspiration.id, context: WriteContext())
            inspirations.removeAll { $0.id == inspiration.id }
            message = "灵感已删除"
        } catch {
            message = "灵感删除失败"
        }
    }

    public func updatePracticeRecord(_ record: PracticeRecord) async -> PracticeRecord? {
        do {
            let updated = try await practiceRepository.updatePracticeRecord(record)
            practiceRecords = practiceRecords.map { $0.id == updated.id ? updated : $0 }
            message = "练习记录已更新"
            return updated
        } catch {
            message = "练习记录更新失败"
            return nil
        }
    }

    public func deletePracticeRecord(_ record: PracticeRecord) async -> Bool {
        do {
            try await practiceRepository.deletePracticeRecord(id: record.id)
            practiceRecords.removeAll { $0.id == record.id }
            message = "练习记录已删除"
            return true
        } catch {
            message = "练习记录删除失败"
            return false
        }
    }

    public func deleteRehearsal(_ rehearsal: Rehearsal) async -> Bool {
        do {
            try await rehearsalRepository.deleteRehearsal(id: rehearsal.id, context: WriteContext())
            rehearsals.removeAll { $0.id == rehearsal.id }
            message = "排练记录已删除"
            return true
        } catch {
            message = "排练记录删除失败"
            return false
        }
    }

    public func deleteAccount() async -> Bool {
        guard !isDeletingAccount else { return false }
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        do {
            let summary = try await accountRepository.deleteAccount(context: WriteContext())
            inspirations = []
            practiceRecords = []
            rehearsals = []
            methodCards = []
            profile = Profile()
            message = "已删除 \(summary.deletedInspirations + summary.deletedPracticeRecords + summary.deletedRehearsals + summary.deletedMethodCards) 条私有数据"
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }
}
