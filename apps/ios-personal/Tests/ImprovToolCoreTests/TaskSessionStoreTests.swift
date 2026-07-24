import XCTest
@testable import ImprovToolCore

@MainActor
final class TaskSessionStoreTests: XCTestCase {
    func testReferenceMaterialCannotStartPractice() {
        let (defaults, suiteName) = makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = TaskSessionStore(defaults: defaults)
        let material = Material(id: "path", title: "学习路径", desc: "", type: .path)

        XCTAssertThrowsError(try store.startMaterialSession(for: material)) { error in
            XCTAssertEqual(error as? TaskMutexError, .referenceMaterialCannotPractice)
        }
        XCTAssertNil(store.currentMaterial)
    }

    func testMaterialSessionBlocksRehearsalUntilFinished() throws {
        let (defaults, suiteName) = makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = TaskSessionStore(defaults: defaults)
        let material = Material(id: "game", title: "Zip Zap Zop", desc: "", type: .game)
        let rehearsal = Rehearsal(title: "今晚排练")

        try store.startMaterialSession(for: material)

        XCTAssertThrowsError(try store.startRehearsal(rehearsal)) { error in
            XCTAssertEqual(error as? TaskMutexError, .blockedByMaterial("进行中的素材练习"))
        }

        store.finishMaterialSession()
        XCTAssertNoThrow(try store.startRehearsal(rehearsal))
    }

    func testRehearsalBlocksMaterialSessionUntilFinished() throws {
        let (defaults, suiteName) = makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = TaskSessionStore(defaults: defaults)
        let rehearsal = Rehearsal(title: "今晚排练")
        let material = Material(id: "game", title: "Zip Zap Zop", desc: "", type: .game)

        try store.startRehearsal(rehearsal)

        XCTAssertThrowsError(try store.startMaterialSession(for: material)) { error in
            XCTAssertEqual(error as? TaskMutexError, .blockedByRehearsal("进行中的排练"))
        }

        store.finishRehearsal()
        XCTAssertNoThrow(try store.startMaterialSession(for: material))
    }

    func testPauseStatePersistsAcrossStoreRecreation() throws {
        let (defaults, suiteName) = makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let material = Material(id: "game", title: "Zip Zap Zop", desc: "", type: .game)
        let store = TaskSessionStore(defaults: defaults)
        try store.startMaterialSession(for: material)

        store.pauseOrResumeMaterialSession()
        let restored = TaskSessionStore(defaults: defaults)

        XCTAssertEqual(restored.currentMaterial?.materialId, material.id)
        XCTAssertEqual(restored.currentMaterial?.status, .paused)

        restored.pauseOrResumeMaterialSession()
        XCTAssertEqual(restored.currentMaterial?.status, .inProgress)
    }

    func testFinishingSessionsClearsPersistedState() throws {
        let (defaults, suiteName) = makeDefaults()
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let store = TaskSessionStore(defaults: defaults)
        let material = Material(id: "game", title: "Zip Zap Zop", desc: "", type: .game)
        try store.startMaterialSession(for: material)

        store.finishMaterialSession()
        let restored = TaskSessionStore(defaults: defaults)

        XCTAssertNil(restored.currentMaterial)
        XCTAssertNil(restored.currentRehearsal)
    }

    private func makeDefaults() -> (UserDefaults, String) {
        let suiteName = "improvtool.task-session-tests.\(UUID().uuidString)"
        return (UserDefaults(suiteName: suiteName)!, suiteName)
    }
}
