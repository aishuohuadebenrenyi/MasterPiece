import Foundation

public enum MaterialSourceFilter: String, CaseIterable, Equatable, Sendable {
    case all
    case owned
}

public struct MaterialListFilters: Equatable, Sendable {
    public var query: String
    public var type: MaterialType?
    public var ability: String?
    public var scene: String?
    public var onlySaved: Bool
    public var onlyPlayed: Bool
    public var source: MaterialSourceFilter
    public var limit: Int
    public var offset: Int

    public init(
        query: String = "",
        type: MaterialType? = nil,
        ability: String? = nil,
        scene: String? = nil,
        onlySaved: Bool = false,
        onlyPlayed: Bool = false,
        source: MaterialSourceFilter = .all,
        limit: Int = 50,
        offset: Int = 0
    ) {
        self.query = query
        self.type = type
        self.ability = ability
        self.scene = scene
        self.onlySaved = onlySaved
        self.onlyPlayed = onlyPlayed
        self.source = source
        self.limit = limit
        self.offset = offset
    }
}

public struct FacetOption: Equatable, Codable, Sendable, Identifiable {
    public var id: String { value }
    public var value: String
    public var label: String
    public var count: Int
    public var selected: Bool

    public init(value: String, label: String? = nil, count: Int, selected: Bool = false) {
        self.value = value
        self.label = label ?? value
        self.count = count
        self.selected = selected
    }
}

public struct MaterialListResult: Equatable, Sendable {
    public var items: [Material]
    public var total: Int
    public var availableTotal: Int
    public var categoryCounts: [MaterialType: Int]
    public var abilityFacets: [FacetOption]
    public var sceneFacets: [FacetOption]
    public var hasMore: Bool
    public var nextOffset: Int?

    public init(
        items: [Material],
        total: Int,
        availableTotal: Int,
        categoryCounts: [MaterialType: Int] = [:],
        abilityFacets: [FacetOption] = [],
        sceneFacets: [FacetOption] = [],
        hasMore: Bool,
        nextOffset: Int? = nil
    ) {
        self.items = items
        self.total = total
        self.availableTotal = availableTotal
        self.categoryCounts = categoryCounts
        self.abilityFacets = abilityFacets
        self.sceneFacets = sceneFacets
        self.hasMore = hasMore
        self.nextOffset = nextOffset
    }
    public static let empty = MaterialListResult(items: [], total: 0, availableTotal: 0, hasMore: false)
}

public struct WriteContext: Equatable, Sendable {
    public var requestId: String
    public var idempotencyKey: String
    public var expectedRevision: String?

    public init(requestId: String = UUID().uuidString, idempotencyKey: String = UUID().uuidString, expectedRevision: String? = nil) {
        self.requestId = requestId
        self.idempotencyKey = idempotencyKey
        self.expectedRevision = expectedRevision
    }
}

public struct PracticeCompletionPayload: Equatable, Sendable {
    public var practiceRecord: PracticeRecord
    public var rehearsalPatch: RehearsalMaterialStatusUpdate?
    public var methodCard: MethodCard?

    public init(practiceRecord: PracticeRecord, rehearsalPatch: RehearsalMaterialStatusUpdate? = nil, methodCard: MethodCard? = nil) {
        self.practiceRecord = practiceRecord
        self.rehearsalPatch = rehearsalPatch
        self.methodCard = methodCard
    }
}

public struct PracticeCompletionResult: Equatable, Sendable {
    public var practiceRecord: PracticeRecord
    public var rehearsal: Rehearsal?
    public var methodCard: MethodCard?

    public init(practiceRecord: PracticeRecord, rehearsal: Rehearsal? = nil, methodCard: MethodCard? = nil) {
        self.practiceRecord = practiceRecord
        self.rehearsal = rehearsal
        self.methodCard = methodCard
    }
}

public struct RehearsalMaterialStatusUpdate: Equatable, Sendable {
    public var rehearsalId: String
    public var materialId: String
    public var status: TaskStatus
    public var keep: String
    public var tryNext: String
    public var rehearsalStatus: TaskStatus?

    public init(rehearsalId: String, materialId: String, status: TaskStatus, keep: String = "", tryNext: String = "", rehearsalStatus: TaskStatus? = nil) {
        self.rehearsalId = rehearsalId
        self.materialId = materialId
        self.status = status
        self.keep = keep
        self.tryNext = tryNext
        self.rehearsalStatus = rehearsalStatus
    }
}

public struct RehearsalCompletionPayload: Equatable, Sendable {
    public var rehearsalId: String
    public var patch: Rehearsal
    public var methodCard: MethodCard?

    public init(rehearsalId: String, patch: Rehearsal, methodCard: MethodCard? = nil) {
        self.rehearsalId = rehearsalId
        self.patch = patch
        self.methodCard = methodCard
    }
}

public struct MediaPlaybackResource: Equatable, Sendable {
    public var fileID: String
    public var url: URL
    public var expiresAt: Date?

    public init(fileID: String, url: URL, expiresAt: Date? = nil) {
        self.fileID = fileID
        self.url = url
        self.expiresAt = expiresAt
    }
}

public protocol MaterialRepository: Sendable {
    func listMaterials(filters: MaterialListFilters) async throws -> MaterialListResult
    func getMaterial(id: String) async throws -> Material?
    func randomMaterial(filters: MaterialListFilters, excluding id: String?) async throws -> Material?
    func createMaterial(_ material: Material, context: WriteContext) async throws -> Material
    func updateMaterial(_ material: Material, context: WriteContext) async throws -> Material
    func deleteMaterial(id: String, context: WriteContext) async throws
    func updateMaterialState(id: String, saved: Bool?, played: Bool?, context: WriteContext) async throws -> Material
}

public protocol InspirationRepository: Sendable {
    func listInspirations() async throws -> [Inspiration]
    func createInspiration(_ inspiration: Inspiration, context: WriteContext) async throws -> Inspiration
    func updateInspiration(_ inspiration: Inspiration, context: WriteContext) async throws -> Inspiration
    func deleteInspiration(id: String, context: WriteContext) async throws
}

public protocol PracticeRecordRepository: Sendable {
    func listPracticeRecords(materialId: String?) async throws -> [PracticeRecord]
    func createPracticeRecord(_ record: PracticeRecord, context: WriteContext) async throws -> PracticeRecord
    func updatePracticeRecord(_ record: PracticeRecord, context: WriteContext) async throws -> PracticeRecord
    func deletePracticeRecord(id: String, context: WriteContext) async throws
    func completePractice(_ payload: PracticeCompletionPayload, context: WriteContext) async throws -> PracticeCompletionResult
}

public protocol RehearsalRepository: Sendable {
    func listRehearsals() async throws -> [Rehearsal]
    func createRehearsal(_ rehearsal: Rehearsal, context: WriteContext) async throws -> Rehearsal
    func updateRehearsal(_ rehearsal: Rehearsal, context: WriteContext) async throws -> Rehearsal
    func deleteRehearsal(id: String, context: WriteContext) async throws
    func updateRehearsalMaterialStatus(_ payload: RehearsalMaterialStatusUpdate, context: WriteContext) async throws -> Rehearsal
    func completeRehearsal(_ payload: RehearsalCompletionPayload, context: WriteContext) async throws -> Rehearsal
}

public protocol MethodCardRepository: Sendable {
    func listMethodCards() async throws -> [MethodCard]
    func createMethodCard(_ card: MethodCard, context: WriteContext) async throws -> MethodCard
    func updateMethodCard(_ card: MethodCard, context: WriteContext) async throws -> MethodCard
    func deleteMethodCard(id: String, context: WriteContext) async throws
}

public protocol ProfileRepository: Sendable {
    func getProfile() async throws -> Profile
    func updateProfile(_ profile: Profile, context: WriteContext) async throws -> Profile
}

public protocol FeedbackRepository: Sendable {
    func createFeedback(_ feedback: Feedback, context: WriteContext) async throws -> Feedback
}

public protocol AccountRepository: Sendable {
    func deleteAccount(context: WriteContext) async throws -> AccountDeletionSummary
}

public protocol AppRepository: MaterialRepository, InspirationRepository, PracticeRecordRepository, RehearsalRepository, MethodCardRepository, ProfileRepository, FeedbackRepository, AccountRepository {}

public protocol MediaUploadRepository: Sendable {
    func uploadAttachment(localURL: URL, type: AttachmentType, scope: String) async throws -> PracticeAttachment
}

public protocol MediaPlaybackResourceRepository: Sendable {
    func resolveMedia(fileID: String) async throws -> MediaPlaybackResource
}

public protocol ContentSafetyRepository: Sendable {
    func checkText(_ values: [String], scene: String) async throws
    func checkMedia(fileID: String, type: AttachmentType, scene: String) async throws
}

public extension MaterialRepository {
    func createMaterial(_ material: Material) async throws -> Material { try await createMaterial(material, context: WriteContext()) }
    func updateMaterial(_ material: Material) async throws -> Material { try await updateMaterial(material, context: WriteContext()) }
    func deleteMaterial(id: String) async throws { try await deleteMaterial(id: id, context: WriteContext()) }
    func updateMaterialState(id: String, saved: Bool?, played: Bool?) async throws -> Material {
        try await updateMaterialState(id: id, saved: saved, played: played, context: WriteContext())
    }
}

public extension InspirationRepository {
    func createInspiration(_ inspiration: Inspiration) async throws -> Inspiration { try await createInspiration(inspiration, context: WriteContext()) }
    func updateInspiration(_ inspiration: Inspiration) async throws -> Inspiration { try await updateInspiration(inspiration, context: WriteContext()) }
    func deleteInspiration(id: String) async throws { try await deleteInspiration(id: id, context: WriteContext()) }
}

public extension PracticeRecordRepository {
    func createPracticeRecord(_ record: PracticeRecord) async throws -> PracticeRecord { try await createPracticeRecord(record, context: WriteContext()) }
    func updatePracticeRecord(_ record: PracticeRecord) async throws -> PracticeRecord { try await updatePracticeRecord(record, context: WriteContext()) }
    func deletePracticeRecord(id: String) async throws { try await deletePracticeRecord(id: id, context: WriteContext()) }
}

public extension RehearsalRepository {
    func createRehearsal(_ rehearsal: Rehearsal) async throws -> Rehearsal { try await createRehearsal(rehearsal, context: WriteContext()) }
    func updateRehearsal(_ rehearsal: Rehearsal) async throws -> Rehearsal { try await updateRehearsal(rehearsal, context: WriteContext()) }
    func deleteRehearsal(id: String) async throws { try await deleteRehearsal(id: id, context: WriteContext()) }
}

public extension MethodCardRepository {
    func createMethodCard(_ card: MethodCard) async throws -> MethodCard { try await createMethodCard(card, context: WriteContext()) }
    func updateMethodCard(_ card: MethodCard) async throws -> MethodCard { try await updateMethodCard(card, context: WriteContext()) }
    func deleteMethodCard(id: String) async throws { try await deleteMethodCard(id: id, context: WriteContext()) }
}

public extension ProfileRepository {
    func updateProfile(_ profile: Profile) async throws -> Profile { try await updateProfile(profile, context: WriteContext()) }
}

public extension FeedbackRepository {
    func createFeedback(_ feedback: Feedback) async throws -> Feedback { try await createFeedback(feedback, context: WriteContext()) }
}

public extension AccountRepository {
    func deleteAccount() async throws -> AccountDeletionSummary { try await deleteAccount(context: WriteContext()) }
}
