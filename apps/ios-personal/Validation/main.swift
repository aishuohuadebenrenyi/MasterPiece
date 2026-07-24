import Foundation
import ImprovToolCore

enum ValidationFailure: Error, CustomStringConvertible {
    case failed(String)

    var description: String {
        switch self {
        case .failed(let message):
            return message
        }
    }
}

func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() {
        throw ValidationFailure.failed(message)
    }
}

@MainActor
func validateTaskMutex() throws {
    let store = TaskSessionStore(defaults: isolatedDefaults("task-mutex"))
    let path = Material(id: "path", title: "学习路径", desc: "参考", type: .path)
    do {
        try store.startMaterialSession(for: path)
        throw ValidationFailure.failed("路径素材不应能开始训练")
    } catch TaskMutexError.referenceMaterialCannotPractice {
        try expect(store.currentMaterial == nil, "路径素材失败后不能留下 session")
    }

    try store.startRehearsal(Rehearsal(title: "今日排练"))
    let material = Material(id: "mat", title: "Zip Zap Zop", desc: "热身", type: .game)
    do {
        try store.startMaterialSession(for: material)
        throw ValidationFailure.failed("进行中排练应拦截单素材训练")
    } catch TaskMutexError.blockedByRehearsal("进行中的排练") {
    }

    store.finishRehearsal()
    try store.startMaterialSession(for: material)
    do {
        try store.startRehearsal(Rehearsal(title: "另一场排练"))
        throw ValidationFailure.failed("进行中素材训练应拦截排练")
    } catch TaskMutexError.blockedByMaterial("进行中的素材练习") {
    }
}

@MainActor
func validateSessionPersistence() throws {
    let defaults = isolatedDefaults("session-persistence")
    let store = TaskSessionStore(defaults: defaults)
    let material = Material(id: "persist-mat", title: "持久化练习", desc: "验证恢复", type: .game)
    try store.startMaterialSession(for: material)
    let restoredMaterialStore = TaskSessionStore(defaults: defaults)
    try expect(restoredMaterialStore.currentMaterial?.materialId == "persist-mat", "素材练习 session 未恢复")
    restoredMaterialStore.finishMaterialSession()

    let clearedStore = TaskSessionStore(defaults: defaults)
    try clearedStore.startRehearsal(Rehearsal(title: "持久化排练"))
    let restoredRehearsalStore = TaskSessionStore(defaults: defaults)
    try expect(restoredRehearsalStore.currentRehearsal?.title == "持久化排练", "排练 session 未恢复")
    restoredRehearsalStore.finishRehearsal()
}

@MainActor
func validateRepositoriesAndViewModels() async throws {
    let repository = MockAppRepository()
    let games = try await repository.listMaterials(filters: MaterialListFilters(type: .game))
    try expect(games.items.map(\.type) == [.game], "素材类型筛选失败")

    let hosting = try await repository.listMaterials(filters: MaterialListFilters(query: "主持"))
    try expect(hosting.items.contains { $0.title == "排练开场主持词" }, "素材搜索失败")

    let sessionStore = TaskSessionStore(defaults: isolatedDefaults("repositories"))
    let discover = DiscoverViewModel(materialRepository: repository, sessionStore: sessionStore)
    await discover.load()
    guard let character = discover.materials.first(where: { $0.id == "mat-character-30s" }) else {
        throw ValidationFailure.failed("缺少角色 mock 素材")
    }
    await discover.toggleSaved(character)
    try expect(discover.materials.first(where: { $0.id == character.id })?.saved == true, "收藏状态更新失败")
    let materialCreated = await discover.createMaterial(title: "测试素材", desc: "用于 iOS 校验", type: .technique)
    try expect(materialCreated, "素材创建请求失败")
    guard let created = discover.materials.first(where: { $0.title == "测试素材" }) else {
        throw ValidationFailure.failed("素材创建失败")
    }
    let materialUpdated = await discover.updateMaterial(created, title: "测试素材更新", desc: "已更新", type: .review)
    try expect(materialUpdated, "素材更新请求失败")
    try expect(discover.materials.first(where: { $0.id == created.id })?.type == .review, "素材更新失败")
    let materialDeleted = await discover.deleteMaterial(created)
    try expect(materialDeleted, "素材删除请求失败")
    try expect(!discover.materials.contains { $0.id == created.id }, "素材删除失败")

    let record = RecordViewModel(
        inspirationRepository: repository,
        materialRepository: repository,
        practiceRepository: repository,
        rehearsalRepository: repository,
        methodCardRepository: repository,
        mediaRepository: repository,
        sessionStore: sessionStore
    )
    record.quickText = "今天排练里可以尝试无声开场"
    record.addQuickAttachment(type: .image)
    record.addQuickAttachment(type: .audio)
    await record.saveQuickInspiration()
    try expect(record.quickText.isEmpty, "快速记录保存后应清空草稿")
    try expect(record.inspirations.contains { $0.desc == "今天排练里可以尝试无声开场" }, "快速记录未写入列表")
    try expect(record.inspirations.first?.attachments.count == 2, "快速记录附件未保存")
    try expect((record.inspirations.first?.attachments.first?.createdAt.timeIntervalSince1970 ?? 0) > 0, "附件缺少创建时间")
    try expect(record.todayInspirations.contains { $0.desc == "今天排练里可以尝试无声开场" }, "今日灵感统计未包含今天记录")

    try expect(record.startPractice(material: character, mode: .session), "普通练习会话建立失败")
    try expect(sessionStore.currentMaterial?.materialId == character.id, "普通练习未写入会话")
    sessionStore.finishMaterialSession()
    try expect(record.startPractice(material: character, mode: .immediateFeedback), "媒体练习入口失败")
    try expect(sessionStore.currentMaterial == nil, "媒体练习不应创建计时会话")

    let rehearsalStarted = await record.startRehearsal(teamName: "校验排练", duration: "90 分钟", goals: ["状态切换"], source: .recommended)
    try expect(rehearsalStarted, "推荐素材排练启动失败")
    try expect(record.todayRehearsals.contains { $0.teamName == "校验排练" }, "今日排练统计未包含今天排练")
    try expect(record.todayRehearsals.first(where: { $0.teamName == "校验排练" })?.source == .recommended, "排练来源未保存")
    try expect(record.todayRehearsals.first(where: { $0.teamName == "校验排练" })?.plan.count == 3, "推荐排练应包含 3 个素材")

    let feedback = PracticeFeedbackViewModel(practiceRepository: repository, methodCardRepository: repository, mediaRepository: repository, sessionStore: sessionStore)
    await feedback.save(material: Material(id: "mat", title: "Zip Zap Zop", desc: "热身", type: .game))
    try expect(feedback.message == "先写本次复盘", "空复盘应被校验拦截")
    feedback.note = "节奏有效，下次降低规则复杂度"
    feedback.attendance = "6"
    feedback.reminder = "下周复查"
    feedback.addAttachment(type: .video)
    await feedback.save(material: Material(id: "mat", title: "Zip Zap Zop", desc: "热身", type: .game), createMethodCard: true)
    let savedRecords = try await repository.listPracticeRecords(materialId: "mat")
    try expect(savedRecords.first?.attachments.first?.type == .video, "练习复盘附件未保存")
    try expect(savedRecords.first?.rehearsalTitle == sessionStore.currentRehearsal?.title, "练习复盘未关联当前排练")
    let cards = try await repository.listMethodCards()
    try expect(cards.contains { $0.sourceType == "practice" }, "保存并沉淀方法卡失败")

    let mine = MineViewModel(
        inspirationRepository: repository,
        practiceRepository: repository,
        rehearsalRepository: repository,
        methodCardRepository: repository,
        materialRepository: repository,
        profileRepository: repository,
        feedbackRepository: repository,
        accountRepository: repository,
        mediaRepository: repository
    )
    await mine.load()
    try expect(mine.practicedMaterialCount == Set(mine.practiceRecords.map(\.materialId)).count, "练过素材应按唯一素材统计")
    if let inspiration = mine.inspirations.first {
        var linkedDraft = inspiration
        linkedDraft.linkedMaterialId = character.id
        linkedDraft.linkedMaterialTitle = character.title
        linkedDraft.linkedRehearsalId = sessionStore.currentRehearsal?.id ?? ""
        linkedDraft.linkedRehearsalTitle = sessionStore.currentRehearsal?.title ?? ""
        let inspirationUpdated = await mine.updateInspiration(linkedDraft)
        try expect(inspirationUpdated, "灵感关联编辑失败")
        let saved = mine.inspirations.first { $0.id == inspiration.id }
        try expect(saved?.linkedMaterialId == character.id && !saved!.linkedRehearsalId.isEmpty, "灵感编辑丢失关联字段")
    }
    _ = await mine.updateProfile(displayName: "测试主理人", troupeName: "测试剧团")
    try expect(mine.profile.displayName == "测试主理人", "个人资料更新失败")
    mine.feedbackText = "这是一个用于校验的反馈内容"
    _ = await mine.submitFeedback()
    try expect(mine.feedbackText.isEmpty, "反馈提交后应清空正文")
    if let practiceRecord = mine.practiceRecords.first(where: { $0.materialId == "mat" }) {
        let deleted = await mine.deletePracticeRecord(practiceRecord)
        try expect(deleted && !mine.practiceRecords.contains { $0.id == practiceRecord.id }, "练习记录删除失败")
    }
    if let rehearsal = mine.rehearsals.first(where: { $0.title == "校验排练" }) {
        let deleted = await mine.deleteRehearsal(rehearsal)
        try expect(deleted && !mine.rehearsals.contains { $0.id == rehearsal.id }, "排练记录删除失败")
    }
    _ = await mine.deleteAccount()
    try expect(mine.inspirations.isEmpty && mine.practiceRecords.isEmpty && mine.methodCards.isEmpty, "账号删除未清空 Mock 私有数据")
}

func isolatedDefaults(_ name: String) -> UserDefaults {
    let suiteName = "improvtool.validation.\(name).\(UUID().uuidString)"
    guard let defaults = UserDefaults(suiteName: suiteName) else {
        return .standard
    }
    defaults.removePersistentDomain(forName: suiteName)
    return defaults
}

@main
struct ValidationMain {
    static func main() async {
        do {
            try await MainActor.run {
                try validateTaskMutex()
                try validateSessionPersistence()
            }
            try await validateRepositoriesAndViewModels()
            print("ImprovToolCoreValidation passed")
        } catch {
            print("ImprovToolCoreValidation failed: \(error)")
            Foundation.exit(1)
        }
    }
}
