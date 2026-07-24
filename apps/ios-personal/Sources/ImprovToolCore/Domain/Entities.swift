import Foundation

public enum MaterialType: String, CaseIterable, Codable, Sendable {
    case game = "游戏"
    case character = "角色"
    case talent = "才艺"
    case format = "格式"
    case hosting = "主理"
    case technique = "技巧"
    case review = "复盘"
    case path = "路径"
}

public enum TaskStatus: String, Codable, Sendable {
    case notStarted = "未开始"
    case inProgress = "进行中"
    case paused = "暂停中"
    case completed = "已完成"
}

public enum AttachmentType: String, Codable, Sendable {
    case image
    case video
    case audio
}

public enum PracticeStartMode: String, Codable, Sendable {
    case session
    case immediateFeedback
}

public enum RehearsalSource: String, Codable, CaseIterable, Sendable {
    case recommended
    case saved
    case blank
}

public struct Material: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var title: String
    public var desc: String
    public var type: MaterialType
    public var tags: [String]
    public var abilities: [String]
    public var scenes: [String]
    public var steps: [String]
    public var tips: String
    public var variant: String
    public var issue: String
    public var relatedMaterialId: String
    public var referenceOnly: Bool
    public var isOwnedByCurrentUser: Bool
    public var saved: Bool
    public var played: Bool
    public var playedCount: Int

    public init(
        id: String,
        title: String,
        desc: String,
        type: MaterialType,
        tags: [String] = [],
        abilities: [String] = [],
        scenes: [String] = [],
        steps: [String] = [],
        tips: String = "",
        variant: String = "",
        issue: String = "",
        relatedMaterialId: String = "",
        referenceOnly: Bool? = nil,
        isOwnedByCurrentUser: Bool = false,
        saved: Bool = false,
        played: Bool = false,
        playedCount: Int = 0
    ) {
        self.id = id
        self.title = title
        self.desc = desc
        self.type = type
        self.tags = tags
        self.abilities = abilities
        self.scenes = scenes
        self.steps = steps
        self.tips = tips
        self.variant = variant
        self.issue = issue
        self.relatedMaterialId = relatedMaterialId
        self.referenceOnly = referenceOnly ?? (type == .path)
        self.isOwnedByCurrentUser = isOwnedByCurrentUser
        self.saved = saved
        self.played = played
        self.playedCount = playedCount
    }
}

public struct PracticeAttachment: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var type: AttachmentType
    public var fileID: String
    public var thumbFileID: String
    public var duration: TimeInterval?
    public var size: Int?
    public var markers: [AttachmentMarker]
    public var createdAt: Date

    public init(
        id: String,
        type: AttachmentType,
        fileID: String,
        thumbFileID: String = "",
        duration: TimeInterval? = nil,
        size: Int? = nil,
        markers: [AttachmentMarker] = [],
        createdAt: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.fileID = fileID
        self.thumbFileID = thumbFileID
        self.duration = duration
        self.size = size
        self.markers = markers
        self.createdAt = createdAt
    }
}

public struct AttachmentMarker: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var time: TimeInterval
    public var kind: String
    public var note: String
    public var createdAt: Date

    public init(id: String = UUID().uuidString, time: TimeInterval = 0, kind: String = "neutral", note: String, createdAt: Date = Date()) {
        self.id = id
        self.time = time
        self.kind = kind
        self.note = note
        self.createdAt = createdAt
    }
}

public struct Inspiration: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var title: String
    public var desc: String
    public var meta: [String]
    public var linkedMaterialId: String
    public var linkedMaterialTitle: String
    public var linkedRehearsalId: String
    public var linkedRehearsalTitle: String
    public var attachments: [PracticeAttachment]
    public var createdAt: Date

    public init(id: String = UUID().uuidString, title: String, desc: String, meta: [String] = [], linkedMaterialId: String = "", linkedMaterialTitle: String = "", linkedRehearsalId: String = "", linkedRehearsalTitle: String = "", attachments: [PracticeAttachment] = [], createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.desc = desc
        self.meta = meta
        self.linkedMaterialId = linkedMaterialId
        self.linkedMaterialTitle = linkedMaterialTitle
        self.linkedRehearsalId = linkedRehearsalId
        self.linkedRehearsalTitle = linkedRehearsalTitle
        self.attachments = attachments
        self.createdAt = createdAt
    }
}

public struct PracticeRecord: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var materialId: String
    public var materialTitle: String
    public var rehearsalId: String
    public var rehearsalTitle: String
    public var score: Int
    public var note: String
    public var attachments: [PracticeAttachment]
    public var comparisonNotes: [ComparisonNote]
    public var reminder: String
    public var duration: String
    public var meta: [String]
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        materialId: String,
        materialTitle: String,
        rehearsalId: String = "",
        rehearsalTitle: String = "",
        score: Int,
        note: String,
        attachments: [PracticeAttachment] = [],
        comparisonNotes: [ComparisonNote] = [],
        reminder: String = "",
        duration: String = "",
        meta: [String] = [],
        createdAt: Date = Date()
    ) {
        self.id = id
        self.materialId = materialId
        self.materialTitle = materialTitle
        self.rehearsalId = rehearsalId
        self.rehearsalTitle = rehearsalTitle
        self.score = score
        self.note = note
        self.attachments = attachments
        self.comparisonNotes = comparisonNotes
        self.reminder = reminder
        self.duration = duration
        self.meta = meta
        self.createdAt = createdAt
    }
}

public struct ComparisonNote: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var comparedRecordIds: [String]
    public var improvement: String
    public var issue: String
    public var nextFocus: String
    public var createdAt: Date

    public init(id: String = UUID().uuidString, comparedRecordIds: [String], improvement: String, issue: String, nextFocus: String, createdAt: Date = Date()) {
        self.id = id
        self.comparedRecordIds = comparedRecordIds
        self.improvement = improvement
        self.issue = issue
        self.nextFocus = nextFocus
        self.createdAt = createdAt
    }
}

public struct RehearsalPlanItem: Identifiable, Equatable, Codable, Sendable {
    public var id: String { materialId }
    public var materialId: String
    public var materialTitle: String
    public var status: TaskStatus
    public var keep: String
    public var tryNext: String

    public init(materialId: String, materialTitle: String = "", status: TaskStatus = .notStarted, keep: String = "", tryNext: String = "") {
        self.materialId = materialId
        self.materialTitle = materialTitle
        self.status = status
        self.keep = keep
        self.tryNext = tryNext
    }
}

public struct Rehearsal: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var title: String
    public var desc: String
    public var teamName: String
    public var duration: String
    public var goals: [String]
    public var source: RehearsalSource
    public var status: TaskStatus
    public var plan: [RehearsalPlanItem]
    public var reviewKeep: String
    public var reviewTry: String
    public var reviewReminder: String
    public var createdAt: Date

    public init(id: String = UUID().uuidString, title: String, desc: String = "", teamName: String = "", duration: String = "60 分钟", goals: [String] = [], source: RehearsalSource = .recommended, status: TaskStatus = .inProgress, plan: [RehearsalPlanItem] = [], reviewKeep: String = "", reviewTry: String = "", reviewReminder: String = "", createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.desc = desc
        self.teamName = teamName
        self.duration = duration
        self.goals = goals
        self.source = source
        self.status = status
        self.plan = plan
        self.reviewKeep = reviewKeep
        self.reviewTry = reviewTry
        self.reviewReminder = reviewReminder
        self.createdAt = createdAt
    }
}

public struct MethodCard: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var title: String
    public var desc: String
    public var sourceType: String
    public var createdAt: Date

    public init(id: String = UUID().uuidString, title: String, desc: String, sourceType: String = "", createdAt: Date = Date()) {
        self.id = id
        self.title = title
        self.desc = desc
        self.sourceType = sourceType
        self.createdAt = createdAt
    }
}

public struct MaterialSession: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var materialId: String
    public var title: String
    public var startTime: Date
    public var status: TaskStatus

    public init(id: String = UUID().uuidString, materialId: String, title: String, startTime: Date = Date(), status: TaskStatus = .inProgress) {
        self.id = id
        self.materialId = materialId
        self.title = title
        self.startTime = startTime
        self.status = status
    }
}

public struct Profile: Equatable, Codable, Sendable {
    public var displayName: String
    public var avatarUrl: String
    public var troupeName: String

    public init(displayName: String = "即兴主理人", avatarUrl: String = "", troupeName: String = "") {
        self.displayName = displayName
        self.avatarUrl = avatarUrl
        self.troupeName = troupeName
    }
}

public struct Feedback: Identifiable, Equatable, Codable, Sendable {
    public var id: String
    public var category: String
    public var content: String
    public var contact: String
    public var sourcePage: String
    public var appVersion: String

    public init(id: String = UUID().uuidString, category: String, content: String, contact: String = "", sourcePage: String = "", appVersion: String = "iOS") {
        self.id = id
        self.category = category
        self.content = content
        self.contact = contact
        self.sourcePage = sourcePage
        self.appVersion = appVersion
    }
}

public struct AccountDeletionSummary: Equatable, Codable, Sendable {
    public var deletedInspirations: Int
    public var deletedPracticeRecords: Int
    public var deletedRehearsals: Int
    public var deletedMethodCards: Int

    public init(deletedInspirations: Int, deletedPracticeRecords: Int, deletedRehearsals: Int, deletedMethodCards: Int) {
        self.deletedInspirations = deletedInspirations
        self.deletedPracticeRecords = deletedPracticeRecords
        self.deletedRehearsals = deletedRehearsals
        self.deletedMethodCards = deletedMethodCards
    }
}
