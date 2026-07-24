import Foundation

public actor MockAppRepository: AppRepository, MediaUploadRepository, MediaPlaybackResourceRepository {
    private var materials: [Material]
    private var inspirations: [Inspiration]
    private var practiceRecords: [PracticeRecord]
    private var rehearsals: [Rehearsal]
    private var methodCards: [MethodCard]
    private var profile: Profile
    private var feedbackItems: [Feedback]

    public init(
        materials: [Material] = MockSeed.materials,
        inspirations: [Inspiration] = MockSeed.inspirations,
        practiceRecords: [PracticeRecord] = MockSeed.practiceRecords,
        rehearsals: [Rehearsal] = [],
        methodCards: [MethodCard] = MockSeed.methodCards,
        profile: Profile = Profile(),
        feedbackItems: [Feedback] = []
    ) {
        self.materials = materials
        self.inspirations = inspirations
        self.practiceRecords = practiceRecords
        self.rehearsals = rehearsals
        self.methodCards = methodCards
        self.profile = profile
        self.feedbackItems = feedbackItems
    }

    public func listMaterials(filters: MaterialListFilters = MaterialListFilters()) async throws -> MaterialListResult {
        let filtered = materials.filter { material in
            if filters.source == .owned, !material.isOwnedByCurrentUser { return false }
            if let type = filters.type, material.type != type { return false }
            if let ability = filters.ability, !material.abilities.contains(ability) && !material.tags.contains(ability) { return false }
            if let scene = filters.scene, !material.scenes.contains(scene) && !material.tags.contains(scene) { return false }
            if filters.onlySaved, !material.saved { return false }
            if filters.onlyPlayed, !material.played { return false }
            let query = filters.query.trimmingCharacters(in: .whitespacesAndNewlines)
            if query.isEmpty { return true }
            let haystack = ([material.title, material.desc] + material.tags + material.abilities + material.scenes).joined(separator: " ")
            return haystack.localizedCaseInsensitiveContains(query)
        }
        let offset = max(0, filters.offset)
        let limit = max(1, filters.limit)
        let pageItems = Array(filtered.dropFirst(offset).prefix(limit))
        let nextOffset = offset + pageItems.count
        let categoryCounts = Dictionary(grouping: materials, by: \.type).mapValues(\.count)
        return MaterialListResult(
            items: pageItems,
            total: filtered.count,
            availableTotal: materials.count,
            categoryCounts: categoryCounts,
            abilityFacets: facets(from: materials.flatMap { $0.abilities + $0.tags }, selected: filters.ability),
            sceneFacets: facets(from: materials.flatMap { $0.scenes + $0.tags }, selected: filters.scene),
            hasMore: nextOffset < filtered.count,
            nextOffset: nextOffset < filtered.count ? nextOffset : nil
        )
    }

    public func getMaterial(id: String) async throws -> Material? {
        materials.first { $0.id == id }
    }

    public func randomMaterial(filters: MaterialListFilters, excluding id: String?) async throws -> Material? {
        let result = try await listMaterials(filters: MaterialListFilters(
            query: filters.query,
            type: filters.type,
            ability: filters.ability,
            scene: filters.scene,
            onlySaved: filters.onlySaved,
            onlyPlayed: filters.onlyPlayed,
            source: filters.source,
            limit: max(materials.count, 1),
            offset: 0
        ))
        let trainable = result.items.filter { !$0.referenceOnly }
        let withoutPrevious = trainable.filter { $0.id != id }
        return (withoutPrevious.isEmpty ? trainable : withoutPrevious).randomElement()
    }

    public func createMaterial(_ material: Material, context: WriteContext) async throws -> Material {
        let next = material.id.isEmpty ? Material(
            id: UUID().uuidString,
            title: material.title,
            desc: material.desc,
            type: material.type,
            tags: material.tags,
            abilities: material.abilities,
            scenes: material.scenes,
            steps: material.steps,
            tips: material.tips,
            variant: material.variant,
            issue: material.issue,
            relatedMaterialId: material.relatedMaterialId,
            referenceOnly: material.referenceOnly,
            isOwnedByCurrentUser: true,
            saved: material.saved,
            played: material.played,
            playedCount: material.playedCount
        ) : material
        materials.insert(next, at: 0)
        return next
    }

    public func updateMaterial(_ material: Material, context: WriteContext) async throws -> Material {
        guard let index = materials.firstIndex(where: { $0.id == material.id }) else {
            throw MockRepositoryError.notFound
        }
        var updated = material
        updated.isOwnedByCurrentUser = true
        materials[index] = updated
        return updated
    }

    public func deleteMaterial(id: String, context: WriteContext) async throws {
        materials.removeAll { $0.id == id }
    }

    public func updateMaterialState(id: String, saved: Bool?, played: Bool?, context: WriteContext) async throws -> Material {
        guard let index = materials.firstIndex(where: { $0.id == id }) else {
            throw MockRepositoryError.notFound
        }
        if let saved {
            materials[index].saved = saved
        }
        if let played {
            materials[index].played = played
            materials[index].playedCount = max(played ? 1 : 0, materials[index].playedCount + (played ? 1 : -1))
        }
        return materials[index]
    }

    public func listInspirations() async throws -> [Inspiration] {
        inspirations
    }

    public func createInspiration(_ inspiration: Inspiration, context: WriteContext) async throws -> Inspiration {
        inspirations.insert(inspiration, at: 0)
        return inspiration
    }

    public func updateInspiration(_ inspiration: Inspiration, context: WriteContext) async throws -> Inspiration {
        guard let index = inspirations.firstIndex(where: { $0.id == inspiration.id }) else {
            throw MockRepositoryError.notFound
        }
        inspirations[index] = inspiration
        return inspiration
    }

    public func deleteInspiration(id: String, context: WriteContext) async throws {
        inspirations.removeAll { $0.id == id }
    }

    public func listPracticeRecords(materialId: String?) async throws -> [PracticeRecord] {
        practiceRecords.filter { record in
            materialId == nil || record.materialId == materialId
        }
    }

    public func createPracticeRecord(_ record: PracticeRecord, context: WriteContext) async throws -> PracticeRecord {
        practiceRecords.insert(record, at: 0)
        return record
    }

    public func updatePracticeRecord(_ record: PracticeRecord, context: WriteContext) async throws -> PracticeRecord {
        guard let index = practiceRecords.firstIndex(where: { $0.id == record.id }) else {
            throw MockRepositoryError.notFound
        }
        practiceRecords[index] = record
        return record
    }

    public func deletePracticeRecord(id: String, context: WriteContext) async throws {
        practiceRecords.removeAll { $0.id == id }
    }

    public func completePractice(_ payload: PracticeCompletionPayload, context: WriteContext) async throws -> PracticeCompletionResult {
        let saved = try await updateOrInsertPracticeRecord(payload.practiceRecord)
        var updatedRehearsal: Rehearsal?
        if let rehearsalPatch = payload.rehearsalPatch {
            updatedRehearsal = try await updateRehearsalMaterialStatus(rehearsalPatch, context: context)
        }
        var savedMethodCard: MethodCard?
        if let methodCard = payload.methodCard {
            savedMethodCard = try await createMethodCard(methodCard, context: context)
        }
        return PracticeCompletionResult(practiceRecord: saved, rehearsal: updatedRehearsal, methodCard: savedMethodCard)
    }

    public func listRehearsals() async throws -> [Rehearsal] {
        rehearsals
    }

    public func createRehearsal(_ rehearsal: Rehearsal, context: WriteContext) async throws -> Rehearsal {
        rehearsals.insert(rehearsal, at: 0)
        return rehearsal
    }

    public func updateRehearsal(_ rehearsal: Rehearsal, context: WriteContext) async throws -> Rehearsal {
        if let index = rehearsals.firstIndex(where: { $0.id == rehearsal.id }) {
            rehearsals[index] = rehearsal
        } else {
            rehearsals.insert(rehearsal, at: 0)
        }
        return rehearsal
    }

    public func deleteRehearsal(id: String, context: WriteContext) async throws {
        rehearsals.removeAll { $0.id == id }
    }

    public func updateRehearsalMaterialStatus(_ payload: RehearsalMaterialStatusUpdate, context: WriteContext) async throws -> Rehearsal {
        guard let index = rehearsals.firstIndex(where: { $0.id == payload.rehearsalId }) else {
            throw MockRepositoryError.notFound
        }
        var rehearsal = rehearsals[index]
        rehearsal.plan = rehearsal.plan.map { item in
            guard item.materialId == payload.materialId else { return item }
            return RehearsalPlanItem(
                materialId: item.materialId,
                materialTitle: item.materialTitle,
                status: payload.status,
                keep: payload.keep,
                tryNext: payload.tryNext
            )
        }
        if let rehearsalStatus = payload.rehearsalStatus {
            rehearsal.status = rehearsalStatus
        }
        rehearsals[index] = rehearsal
        return rehearsal
    }

    public func completeRehearsal(_ payload: RehearsalCompletionPayload, context: WriteContext) async throws -> Rehearsal {
        var completed = payload.patch
        completed.id = payload.rehearsalId
        completed.status = .completed
        let saved = try await updateRehearsal(completed, context: context)
        if let methodCard = payload.methodCard {
            _ = try await createMethodCard(methodCard, context: context)
        }
        return saved
    }

    public func listMethodCards() async throws -> [MethodCard] {
        methodCards
    }

    public func createMethodCard(_ card: MethodCard, context: WriteContext) async throws -> MethodCard {
        methodCards.insert(card, at: 0)
        return card
    }

    public func updateMethodCard(_ card: MethodCard, context: WriteContext) async throws -> MethodCard {
        guard let index = methodCards.firstIndex(where: { $0.id == card.id }) else {
            throw MockRepositoryError.notFound
        }
        methodCards[index] = card
        return card
    }

    public func deleteMethodCard(id: String, context: WriteContext) async throws {
        methodCards.removeAll { $0.id == id }
    }

    public func getProfile() async throws -> Profile {
        profile
    }

    public func updateProfile(_ profile: Profile, context: WriteContext) async throws -> Profile {
        self.profile = profile
        return profile
    }

    public func createFeedback(_ feedback: Feedback, context: WriteContext) async throws -> Feedback {
        feedbackItems.insert(feedback, at: 0)
        return feedback
    }

    public func deleteAccount(context: WriteContext) async throws -> AccountDeletionSummary {
        let summary = AccountDeletionSummary(
            deletedInspirations: inspirations.count,
            deletedPracticeRecords: practiceRecords.count,
            deletedRehearsals: rehearsals.count,
            deletedMethodCards: methodCards.count
        )
        inspirations.removeAll()
        practiceRecords.removeAll()
        rehearsals.removeAll()
        methodCards.removeAll()
        profile = Profile()
        return summary
    }

    public func uploadAttachment(localURL: URL, type: AttachmentType, scope: String) async throws -> PracticeAttachment {
        PracticeAttachment(id: UUID().uuidString, type: type, fileID: localURL.absoluteString)
    }

    public func resolveMedia(fileID: String) async throws -> MediaPlaybackResource {
        MediaPlaybackResource(fileID: fileID, url: URL(string: fileID.replacingOccurrences(of: "mock://", with: "https://example.invalid/")) ?? URL(string: "https://example.invalid")!)
    }

    private func updateOrInsertPracticeRecord(_ record: PracticeRecord) async throws -> PracticeRecord {
        if let index = practiceRecords.firstIndex(where: { $0.id == record.id }) {
            practiceRecords[index] = record
        } else {
            practiceRecords.insert(record, at: 0)
        }
        return record
    }

    private func facets(from values: [String], selected: String?) -> [FacetOption] {
        Dictionary(grouping: values.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }, by: \.self)
            .map { FacetOption(value: $0.key, count: $0.value.count, selected: $0.key == selected) }
            .sorted { lhs, rhs in
                if lhs.count == rhs.count { return lhs.label < rhs.label }
                return lhs.count > rhs.count
            }
    }
}

public enum MockRepositoryError: Error, Equatable {
    case notFound
}

public enum MockSeed {
    public static let materials: [Material] = [
        Material(
            id: "mat-game-zip",
            title: "Zip Zap Zop",
            desc: "用声音和眼神传递能量，适合热身和建立注意力。",
            type: .game,
            tags: ["热身", "注意力"],
            abilities: ["积极聆听", "反应"],
            scenes: ["排练", "临场速查"],
            steps: ["围成圆圈", "用 Zip/Zap/Zop 传递", "逐步加快节奏"],
            tips: "保持眼神确认，不要抢拍。",
            saved: true
        ),
        Material(
            id: "mat-character-30s",
            title: "30 秒建立角色",
            desc: "快速用身体、声音和关系建立人物。",
            type: .character,
            tags: ["角色", "身体"],
            abilities: ["角色塑造"],
            scenes: ["训练", "备课"]
        ),
        Material(
            id: "mat-hosting-opening",
            title: "排练开场主持词",
            desc: "帮助主理人快速建立安全感和今日目标。",
            type: .hosting,
            tags: ["主理", "开场"],
            abilities: ["控场"],
            scenes: ["备课", "排练"]
        ),
        Material(
            id: "mat-owned-warmup",
            title: "我的呼吸热身",
            desc: "我为小组开场准备的三分钟呼吸练习。",
            type: .technique,
            tags: ["自建", "热身"],
            abilities: ["自发性"],
            scenes: ["排练"],
            isOwnedByCurrentUser: true
        ),
        Material(
            id: "mat-path-actor-map",
            title: "演员学习路径地图",
            desc: "入门到高阶的训练路径参考。",
            type: .path,
            tags: ["学习地图"],
            abilities: ["路径规划"],
            scenes: ["复盘", "备课"],
            steps: ["基础热身", "身体与声音", "角色关系", "叙事结构", "格式与主理"]
        )
    ]

    public static let inspirations: [Inspiration] = [
        Inspiration(title: "把观众词拆成身体动作", desc: "下次热身可以试试先不说话，只用动作回应。", meta: ["待整理", "训练线索"])
    ]

    public static let practiceRecords: [PracticeRecord] = [
        PracticeRecord(
            materialId: "mat-game-zip",
            materialTitle: "Zip Zap Zop",
            score: 8,
            note: "节奏起来后能量很好，下次注意新人的安全感。",
            attachments: [
                PracticeAttachment(
                    id: "att-zip-video-1",
                    type: .video,
                    fileID: "mock://practice-zip-1.mp4",
                    duration: 42,
                    markers: [
                        AttachmentMarker(time: 12, kind: "good", note: "传递节奏开始稳定。")
                    ]
                )
            ],
            createdAt: Date(timeIntervalSinceNow: -86_400)
        ),
        PracticeRecord(
            materialId: "mat-game-zip",
            materialTitle: "Zip Zap Zop",
            score: 6,
            note: "有两次抢拍，下一轮先放慢再加速。",
            attachments: [
                PracticeAttachment(id: "att-zip-video-2", type: .video, fileID: "mock://practice-zip-2.mp4", duration: 36),
                PracticeAttachment(id: "att-zip-audio-1", type: .audio, fileID: "mock://practice-zip-note.m4a", duration: 18)
            ],
            createdAt: Date(timeIntervalSinceNow: -172_800)
        )
    ]

    public static let methodCards: [MethodCard] = [
        MethodCard(title: "热身先降门槛", desc: "先让动作变小、规则变少，再逐步加速。", sourceType: "practice")
    ]
}
