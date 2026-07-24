import Foundation
import Combine

public enum TaskTarget: Sendable {
    case rehearsal
    case material
}

public enum TaskMutexError: LocalizedError, Equatable, Sendable {
    case blockedByRehearsal(String)
    case blockedByMaterial(String)
    case referenceMaterialCannotPractice

    public var errorDescription: String? {
        switch self {
        case .blockedByRehearsal(let label):
            return "当前有\(label)，请先结束后再继续"
        case .blockedByMaterial(let label):
            return "当前有\(label)，请先结束后再继续"
        case .referenceMaterialCannotPractice:
            return "路径素材只支持查看和收藏，不能进入训练"
        }
    }
}

@MainActor
public final class TaskSessionStore: ObservableObject {
    @Published public private(set) var currentRehearsal: Rehearsal?
    @Published public private(set) var currentMaterial: MaterialSession?

    private let defaults: UserDefaults
    private let rehearsalKey = "improvtool.currentRehearsal"
    private let materialKey = "improvtool.currentMaterial"

    public init(currentRehearsal: Rehearsal? = nil, currentMaterial: MaterialSession? = nil, defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.currentRehearsal = currentRehearsal ?? Self.restore(Rehearsal.self, key: rehearsalKey, defaults: defaults)
        self.currentMaterial = currentMaterial ?? Self.restore(MaterialSession.self, key: materialKey, defaults: defaults)
    }

    public func startMaterialSession(for material: Material) throws {
        if material.referenceOnly || material.type == .path {
            throw TaskMutexError.referenceMaterialCannotPractice
        }
        if let rehearsal = currentRehearsal {
            throw TaskMutexError.blockedByRehearsal(label(for: rehearsal))
        }
        if let materialSession = currentMaterial {
            throw TaskMutexError.blockedByMaterial(label(for: materialSession))
        }
        currentMaterial = MaterialSession(materialId: material.id, title: material.title)
        persist()
    }

    public func finishMaterialSession() {
        currentMaterial = nil
        persist()
    }

    public func pauseOrResumeMaterialSession() {
        guard var materialSession = currentMaterial else { return }
        materialSession.status = materialSession.status == .paused ? .inProgress : .paused
        currentMaterial = materialSession
        persist()
    }

    public func startRehearsal(_ rehearsal: Rehearsal) throws {
        if let materialSession = currentMaterial {
            throw TaskMutexError.blockedByMaterial(label(for: materialSession))
        }
        if let rehearsal = currentRehearsal {
            throw TaskMutexError.blockedByRehearsal(label(for: rehearsal))
        }
        currentRehearsal = rehearsal
        persist()
    }

    public func updateCurrentRehearsal(_ rehearsal: Rehearsal) {
        currentRehearsal = rehearsal
        persist()
    }

    public func finishRehearsal() {
        currentRehearsal = nil
        persist()
    }

    private func label(for rehearsal: Rehearsal) -> String {
        rehearsal.status == .paused ? "暂停中的排练" : "进行中的排练"
    }

    private func label(for session: MaterialSession) -> String {
        session.status == .paused ? "暂停中的素材练习" : "进行中的素材练习"
    }

    private func persist() {
        Self.save(currentRehearsal, key: rehearsalKey, defaults: defaults)
        Self.save(currentMaterial, key: materialKey, defaults: defaults)
    }

    private static func save<T: Encodable>(_ value: T?, key: String, defaults: UserDefaults) {
        guard let value, let data = try? JSONEncoder().encode(value) else {
            defaults.removeObject(forKey: key)
            return
        }
        defaults.set(data, forKey: key)
    }

    private static func restore<T: Decodable>(_ type: T.Type, key: String, defaults: UserDefaults) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
