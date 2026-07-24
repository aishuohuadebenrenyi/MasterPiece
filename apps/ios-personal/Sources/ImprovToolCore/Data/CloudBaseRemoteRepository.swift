import Foundation

public struct CloudBaseConfiguration: Sendable {
    public var endpoint: URL
    public var userId: String
    public var sessionToken: String

    public init(endpoint: URL, userId: String, sessionToken: String) {
        self.endpoint = endpoint
        self.userId = userId
        self.sessionToken = sessionToken
    }

    public init(endpoint: URL, session: CloudBaseSession) {
        self.endpoint = endpoint
        self.userId = session.userId
        self.sessionToken = session.sessionToken
    }

    public static let endpointKey = "IMPROV_CLOUDBASE_API_ENDPOINT"

    public static func loadEndpoint(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL? {
        let endpointValue = environment[endpointKey]
            ?? Bundle.main.object(forInfoDictionaryKey: endpointKey) as? String
        guard let endpointText = endpointValue?.trimmingCharacters(in: .whitespacesAndNewlines),
              !endpointText.isEmpty
        else { return nil }
        return URL(string: endpointText)
    }

    public static func isSecureEndpoint(_ endpoint: URL?) -> Bool {
        endpoint?.scheme?.lowercased() == "https"
    }
}

public struct CloudBaseSession: Equatable, Codable, Sendable {
    public var userId: String
    public var sessionToken: String
    public var expiresAt: Date?

    public init(userId: String, sessionToken: String, expiresAt: Date? = nil) {
        self.userId = userId
        self.sessionToken = sessionToken
        self.expiresAt = expiresAt
    }

    public var isExpired: Bool {
        expiresAt.map { $0 <= Date() } ?? false
    }
}

public enum CloudBaseNetwork {
    public static func makeSession() -> URLSession {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 90
        configuration.waitsForConnectivity = true
        return URLSession(configuration: configuration)
    }
}

public actor CloudBaseSessionClient {
    private let endpoint: URL
    private let session: URLSession

    public init(endpoint: URL, session: URLSession = CloudBaseNetwork.makeSession()) {
        self.endpoint = endpoint
        self.session = session
    }

    public func exchangeAppleIdentity(userId: String, identityToken: String, fullName: String? = nil) async throws -> CloudBaseSession {
        let requestId = "improv_ios_auth_apple_\(Int(Date().timeIntervalSince1970))"
        let body: JSONValue = .object([
            "action": .string("auth.apple"),
            "requestId": .string(requestId),
            "payload": .object([
                "appleUserId": .string(userId),
                "identityToken": .string(identityToken),
                "fullName": fullName.map(JSONValue.string) ?? .null
            ])
        ])
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ios", forHTTPHeaderField: "X-Improv-Client")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw CloudBaseAPIError.transport
        }
        let decoded = try JSONDecoder().decode(JSONValue.self, from: data)
        guard let object = decoded.objectValue else { throw CloudBaseAPIError.emptyData("auth.apple") }
        guard object["code"]?.intValue == 0 else {
            throw CloudBaseAPIError.actionFailed(
                object["message"]?.stringValue ?? "登录失败",
                object["code"]?.intValue ?? -1,
                object["requestId"]?.stringValue
            )
        }
        guard let dataObject = object["data"]?.objectValue,
              let sessionToken = dataObject["sessionToken"]?.stringValue,
              let returnedUserId = dataObject["userId"]?.stringValue
        else { throw CloudBaseAPIError.emptyData("sessionToken") }
        return CloudBaseSession(
            userId: returnedUserId,
            sessionToken: sessionToken,
            expiresAt: dataObject["expiresAt"]?.doubleValue.map { Date(timeIntervalSince1970: $0) }
        )
    }
}

public actor CloudBaseRemoteRepository: AppRepository, MediaUploadRepository, MediaPlaybackResourceRepository, ContentSafetyRepository {
    private let client: CloudBaseAPIClient

    public init(configuration: CloudBaseConfiguration) {
        client = CloudBaseAPIClient(configuration: configuration)
    }

    public func listMaterials(filters: MaterialListFilters = MaterialListFilters()) async throws -> MaterialListResult {
        let payload: [String: JSONValue] = [
            "query": .string(filters.query),
            "type": filters.type.map { .string($0.rawValue) } ?? .string("all"),
            "ability": filters.ability.map(JSONValue.string) ?? .string("all"),
            "scene": filters.scene.map(JSONValue.string) ?? .string("all"),
            "status": .string(statusFilter(saved: filters.onlySaved, played: filters.onlyPlayed)),
            "source": .string(filters.source.rawValue),
            "limit": .number(Double(filters.limit)),
            "offset": .number(Double(filters.offset))
        ]
        let data = try await client.call("material.list", payload: payload)
        let items = data["items"]?.arrayValue?.compactMap(Material.init(json:)) ?? []
        let total = data["total"]?.intValue ?? items.count
        let nextOffset = data["nextOffset"]?.intValue ?? (filters.offset + items.count)
        return MaterialListResult(
            items: items,
            total: total,
            availableTotal: data["availableTotal"]?.intValue ?? total,
            categoryCounts: parseCategoryCounts(data["categoryCounts"]),
            abilityFacets: parseFacets(data["facets"]?.objectValue?["abilities"], selected: filters.ability),
            sceneFacets: parseFacets(data["facets"]?.objectValue?["scenes"], selected: filters.scene),
            hasMore: data["hasMore"]?.boolValue ?? (nextOffset < total),
            nextOffset: data["hasMore"]?.boolValue == false ? nil : nextOffset
        )
    }

    public func getMaterial(id: String) async throws -> Material? {
        let data = try await client.call("material.get", payload: ["id": .string(id)])
        guard let item = data["item"] else { return nil }
        return Material(json: item)
    }

    public func randomMaterial(filters: MaterialListFilters, excluding id: String?) async throws -> Material? {
        var payload: [String: JSONValue] = [
            "query": .string(filters.query),
            "type": filters.type.map { .string($0.rawValue) } ?? .string("all"),
            "ability": filters.ability.map(JSONValue.string) ?? .string("all"),
            "scene": filters.scene.map(JSONValue.string) ?? .string("all"),
            "status": .string(statusFilter(saved: filters.onlySaved, played: filters.onlyPlayed)),
            "source": .string(filters.source.rawValue)
        ]
        if let id { payload["excludeId"] = .string(id) }
        let data = try await client.call("material.random", payload: payload)
        guard let item = data["item"], item != .null else { return nil }
        return Material(json: item)
    }

    public func createMaterial(_ material: Material, context: WriteContext) async throws -> Material {
        try await checkText([material.title, material.desc, material.tips, material.variant, material.issue] + material.tags + material.abilities + material.scenes + material.steps, scene: "material")
        let data = try await client.call("material.create", payload: material.jsonPayload, context: context)
        return try requireItem(data, as: Material.self)
    }

    public func updateMaterial(_ material: Material, context: WriteContext) async throws -> Material {
        try await checkText([material.title, material.desc, material.tips, material.variant, material.issue] + material.tags + material.abilities + material.scenes + material.steps, scene: "material")
        let data = try await client.call("material.update", payload: material.jsonPayload, context: context)
        return try requireItem(data, as: Material.self)
    }

    public func deleteMaterial(id: String, context: WriteContext) async throws {
        _ = try await client.call("material.delete", payload: ["id": .string(id)], context: context)
    }

    public func updateMaterialState(id: String, saved: Bool?, played: Bool?, context: WriteContext) async throws -> Material {
        var payload: [String: JSONValue] = ["materialId": .string(id)]
        if let saved { payload["saved"] = .bool(saved) }
        if let played { payload["played"] = .bool(played) }
        _ = try await client.call("material.updateState", payload: payload, context: context)
        guard let material = try await getMaterial(id: id) else { throw CloudBaseAPIError.emptyData("material.get") }
        return material
    }

    public func listInspirations() async throws -> [Inspiration] {
        try await listOwned("inspiration.list", as: Inspiration.self)
    }

    public func createInspiration(_ inspiration: Inspiration, context: WriteContext) async throws -> Inspiration {
        try await checkText([inspiration.title, inspiration.desc] + inspiration.meta, scene: "inspiration")
        try await checkAttachments(inspiration.attachments, scene: "inspiration")
        let data = try await client.call("inspiration.create", payload: inspiration.jsonPayload, context: context)
        return try requireItem(data, as: Inspiration.self)
    }

    public func updateInspiration(_ inspiration: Inspiration, context: WriteContext) async throws -> Inspiration {
        try await checkText([inspiration.title, inspiration.desc] + inspiration.meta, scene: "inspiration")
        try await checkAttachments(inspiration.attachments, scene: "inspiration")
        let data = try await client.call("inspiration.update", payload: inspiration.jsonPayload, context: context)
        return try requireItem(data, as: Inspiration.self)
    }

    public func deleteInspiration(id: String, context: WriteContext) async throws {
        _ = try await client.call("inspiration.delete", payload: ["id": .string(id)], context: context)
    }

    public func listPracticeRecords(materialId: String?) async throws -> [PracticeRecord] {
        var payload: [String: JSONValue] = ["limit": .number(100), "offset": .number(0)]
        if let materialId, !materialId.isEmpty {
            payload["materialId"] = .string(materialId)
        }
        let data = try await client.call("practiceRecord.list", payload: payload)
        return data["items"]?.arrayValue?.compactMap(PracticeRecord.init(json:)) ?? []
    }

    public func createPracticeRecord(_ record: PracticeRecord, context: WriteContext) async throws -> PracticeRecord {
        try await checkText([record.materialTitle, record.rehearsalTitle, record.note, record.reminder] + record.meta, scene: "practiceRecord")
        try await checkAttachments(record.attachments, scene: "practiceRecord")
        let data = try await client.call("practiceRecord.create", payload: record.jsonPayload, context: context)
        return try requireItem(data, as: PracticeRecord.self)
    }

    public func updatePracticeRecord(_ record: PracticeRecord, context: WriteContext) async throws -> PracticeRecord {
        try await checkText([record.materialTitle, record.rehearsalTitle, record.note, record.reminder] + record.meta, scene: "practiceRecord")
        try await checkAttachments(record.attachments, scene: "practiceRecord")
        let data = try await client.call("practiceRecord.update", payload: record.jsonPayload, context: context)
        return try requireItem(data, as: PracticeRecord.self)
    }

    public func deletePracticeRecord(id: String, context: WriteContext) async throws {
        _ = try await client.call("practiceRecord.delete", payload: ["id": .string(id)], context: context)
    }

    public func completePractice(_ payload: PracticeCompletionPayload, context: WriteContext) async throws -> PracticeCompletionResult {
        try await checkText(
            [payload.practiceRecord.materialTitle, payload.practiceRecord.rehearsalTitle, payload.practiceRecord.note, payload.practiceRecord.reminder] + payload.practiceRecord.meta,
            scene: "practiceRecord"
        )
        try await checkAttachments(payload.practiceRecord.attachments, scene: "practiceRecord")
        var body: [String: JSONValue] = ["practiceRecord": .object(payload.practiceRecord.jsonPayload)]
        if let patch = payload.rehearsalPatch { body["rehearsalPatch"] = .object(patch.jsonPayload) }
        if let card = payload.methodCard { body["methodCard"] = .object(card.jsonPayload) }
        let data = try await client.call("practice.complete", payload: body, context: context)
        guard let record = data["practiceRecord"].flatMap(PracticeRecord.init(json:)) else {
            throw CloudBaseAPIError.emptyData("practice.complete.practiceRecord")
        }
        return PracticeCompletionResult(
            practiceRecord: record,
            rehearsal: data["rehearsal"].flatMap(Rehearsal.init(json:)),
            methodCard: data["methodCard"].flatMap(MethodCard.init(json:))
        )
    }

    public func listRehearsals() async throws -> [Rehearsal] {
        try await listOwned("rehearsal.list", as: Rehearsal.self)
    }

    public func createRehearsal(_ rehearsal: Rehearsal, context: WriteContext) async throws -> Rehearsal {
        try await checkText(rehearsal.textValuesForSecurity, scene: "rehearsal")
        let data = try await client.call("rehearsal.create", payload: rehearsal.jsonPayload, context: context)
        return try requireItem(data, as: Rehearsal.self)
    }

    public func updateRehearsal(_ rehearsal: Rehearsal, context: WriteContext) async throws -> Rehearsal {
        try await checkText(rehearsal.textValuesForSecurity, scene: "rehearsal")
        let data = try await client.call("rehearsal.update", payload: rehearsal.jsonPayload, context: context)
        return try requireItem(data, as: Rehearsal.self)
    }

    public func deleteRehearsal(id: String, context: WriteContext) async throws {
        _ = try await client.call("rehearsal.delete", payload: ["id": .string(id)], context: context)
    }

    public func updateRehearsalMaterialStatus(_ payload: RehearsalMaterialStatusUpdate, context: WriteContext) async throws -> Rehearsal {
        try await checkText([payload.keep, payload.tryNext], scene: "rehearsal.materialStatus")
        let data = try await client.call("rehearsal.updateMaterialStatus", payload: payload.jsonPayload, context: context)
        return try requireItem(data, as: Rehearsal.self)
    }

    public func completeRehearsal(_ payload: RehearsalCompletionPayload, context: WriteContext) async throws -> Rehearsal {
        try await checkText(payload.patch.textValuesForSecurity, scene: "rehearsal")
        var body: [String: JSONValue] = [
            "id": .string(payload.rehearsalId),
            "patch": .object(payload.patch.jsonPayload)
        ]
        if let card = payload.methodCard { body["methodCard"] = .object(card.jsonPayload) }
        let data = try await client.call("rehearsal.complete", payload: body, context: context)
        if let rehearsal = data["rehearsal"].flatMap(Rehearsal.init(json:)) { return rehearsal }
        return try requireItem(data, as: Rehearsal.self)
    }

    public func listMethodCards() async throws -> [MethodCard] {
        try await listOwned("methodCard.list", as: MethodCard.self)
    }

    public func createMethodCard(_ card: MethodCard, context: WriteContext) async throws -> MethodCard {
        try await checkText([card.title, card.desc, card.sourceType], scene: "methodCard")
        let data = try await client.call("methodCard.create", payload: card.jsonPayload, context: context)
        return try requireItem(data, as: MethodCard.self)
    }

    public func updateMethodCard(_ card: MethodCard, context: WriteContext) async throws -> MethodCard {
        try await checkText([card.title, card.desc, card.sourceType], scene: "methodCard")
        let data = try await client.call("methodCard.update", payload: card.jsonPayload, context: context)
        return try requireItem(data, as: MethodCard.self)
    }

    public func deleteMethodCard(id: String, context: WriteContext) async throws {
        _ = try await client.call("methodCard.delete", payload: ["id": .string(id)], context: context)
    }

    public func getProfile() async throws -> Profile {
        let data = try await client.call("profile.get")
        return Profile(json: data["item"] ?? .object(data)) ?? Profile()
    }

    public func updateProfile(_ profile: Profile, context: WriteContext) async throws -> Profile {
        try await checkText([profile.displayName, profile.troupeName], scene: "profile")
        if !profile.avatarUrl.isEmpty {
            try await checkMedia(fileID: profile.avatarUrl, type: .image, scene: "profile.avatar")
        }
        let data = try await client.call("profile.update", payload: profile.jsonPayload, context: context)
        return Profile(json: data["item"] ?? .object(data)) ?? profile
    }

    public func createFeedback(_ feedback: Feedback, context: WriteContext) async throws -> Feedback {
        try await checkText([feedback.content, feedback.contact], scene: "feedback")
        _ = try await client.call("feedback.create", payload: feedback.jsonPayload, context: context)
        return feedback
    }

    public func deleteAccount(context: WriteContext) async throws -> AccountDeletionSummary {
        let data = try await client.call("account.delete", context: context)
        return AccountDeletionSummary(
            deletedInspirations: data["deletedInspirations"]?.intValue ?? 0,
            deletedPracticeRecords: data["deletedPracticeRecords"]?.intValue ?? 0,
            deletedRehearsals: data["deletedRehearsals"]?.intValue ?? 0,
            deletedMethodCards: data["deletedMethodCards"]?.intValue ?? 0
        )
    }

    public func uploadAttachment(localURL: URL, type: AttachmentType, scope: String) async throws -> PracticeAttachment {
        let data = try await client.upload(localURL: localURL, type: type, scope: scope)
        if data["uploadSupported"]?.boolValue == false {
            throw CloudBaseAPIError.actionFailed(
                data["message"]?.stringValue ?? "媒体上传未配置",
                501,
                nil
            )
        }
        guard let fileID = data["fileID"]?.stringValue else { throw CloudBaseAPIError.emptyData("media.upload") }
        let thumbFileID = data["thumbFileID"]?.stringValue ?? ""
        let resolved = try? await resolveMedia(fileID: fileID)
        let attachment = PracticeAttachment(
            id: data["id"]?.stringValue ?? UUID().uuidString,
            type: type,
            fileID: fileID,
            thumbFileID: thumbFileID,
            duration: data["duration"]?.doubleValue,
            size: data["size"]?.intValue
        )
        if resolved == nil && !fileID.hasPrefix("mock://") && !fileID.hasPrefix("local://") {
            try await checkMedia(fileID: fileID, type: type, scene: scope)
        }
        return attachment
    }

    public func resolveMedia(fileID: String) async throws -> MediaPlaybackResource {
        if let url = URL(string: fileID), ["http", "https", "file"].contains(url.scheme?.lowercased() ?? "") {
            return MediaPlaybackResource(fileID: fileID, url: url)
        }
        let data = try await client.call("media.resolve", payload: ["fileID": .string(fileID)])
        guard let text = data["url"]?.stringValue, let url = URL(string: text) else {
            throw CloudBaseAPIError.emptyData("media.resolve")
        }
        return MediaPlaybackResource(
            fileID: fileID,
            url: url,
            expiresAt: data["expiresAt"]?.doubleValue.map { Date(timeIntervalSince1970: $0) }
        )
    }

    public func checkText(_ values: [String], scene: String) async throws {
        _ = try await client.call("security.checkText", payload: [
            "values": .array(values.map(JSONValue.string)),
            "scene": .string(scene)
        ])
    }

    public func checkMedia(fileID: String, type: AttachmentType, scene: String) async throws {
        _ = try await client.call("security.checkMedia", payload: [
            "fileID": .string(fileID),
            "type": .string(type.rawValue),
            "scene": .string(scene)
        ])
    }

    private func listOwned<T>(_ action: String, as type: T.Type) async throws -> [T] where T: JSONInitializable {
        let data = try await client.call(action, payload: ["limit": .number(100), "offset": .number(0)])
        return data["items"]?.arrayValue?.compactMap(T.init(json:)) ?? []
    }

    private func requireItem<T>(_ data: [String: JSONValue], as type: T.Type) throws -> T where T: JSONInitializable {
        guard let item = data["item"].flatMap(T.init(json:)) else { throw CloudBaseAPIError.emptyData("item") }
        return item
    }

    private func statusFilter(saved: Bool, played: Bool) -> String {
        if saved { return "saved" }
        if played { return "played" }
        return "all"
    }

    private func parseCategoryCounts(_ value: JSONValue?) -> [MaterialType: Int] {
        guard let object = value?.objectValue else { return [:] }
        return object.reduce(into: [:]) { result, entry in
            if let type = MaterialType(rawValue: entry.key), let count = entry.value.intValue {
                result[type] = count
            }
        }
    }

    private func parseFacets(_ value: JSONValue?, selected: String?) -> [FacetOption] {
        if let items = value?.arrayValue {
            return items.compactMap { item in
                if let object = item.objectValue,
                   let facetValue = object["value"]?.stringValue {
                    return FacetOption(
                        value: facetValue,
                        label: object["label"]?.stringValue,
                        count: object["count"]?.intValue ?? 0,
                        selected: facetValue == selected
                    )
                }
                if let facetValue = item.stringValue {
                    return FacetOption(value: facetValue, count: 0, selected: facetValue == selected)
                }
                return nil
            }
        }
        if let object = value?.objectValue {
            return object.map { FacetOption(value: $0.key, count: $0.value.intValue ?? 0, selected: $0.key == selected) }
                .sorted { $0.label < $1.label }
        }
        return []
    }

    private func checkAttachments(_ attachments: [PracticeAttachment], scene: String) async throws {
        for attachment in attachments where !attachment.fileID.hasPrefix("mock://") && !attachment.fileID.hasPrefix("local://") {
            try await checkMedia(fileID: attachment.fileID, type: attachment.type, scene: scene)
            try await checkText(attachment.markers.map(\.note), scene: "\(scene).marker")
        }
    }
}

public actor CloudBaseAPIClient {
    private let configuration: CloudBaseConfiguration
    private let session: URLSession

    public init(configuration: CloudBaseConfiguration, session: URLSession = CloudBaseNetwork.makeSession()) {
        self.configuration = configuration
        self.session = session
    }

    public func call(_ action: String, payload: [String: JSONValue] = [:], context: WriteContext? = nil) async throws -> [String: JSONValue] {
        let requestId = context?.requestId ?? "improv_ios_\(action.replacingOccurrences(of: ".", with: "_"))_\(UUID().uuidString)"
        let body: JSONValue = .object([
            "action": .string(action),
            "requestId": .string(requestId),
            "payload": .object(payload),
            "client": .object([
                "platform": .string("ios"),
                "userId": .string(configuration.userId),
                "sessionToken": .string(configuration.sessionToken),
                "idempotencyKey": context.map { .string($0.idempotencyKey) } ?? .null,
                "expectedRevision": context?.expectedRevision.map(JSONValue.string) ?? .null
            ])
        ])
        let response = try await postJSON(configuration.endpoint, body: body)
        guard response["code"]?.intValue == 0 else {
            throw CloudBaseAPIError.actionFailed(
                response["message"]?.stringValue ?? "服务暂不可用",
                response["code"]?.intValue ?? -1,
                response["requestId"]?.stringValue
            )
        }
        return response["data"]?.objectValue ?? [:]
    }

    public func upload(localURL: URL, type: AttachmentType, scope: String) async throws -> [String: JSONValue] {
        var data = try await call("media.prepareUpload", payload: [
            "fileName": .string(localURL.lastPathComponent),
            "type": .string(type.rawValue),
            "scope": .string(scope)
        ])
        guard data["uploadSupported"]?.boolValue != false else { return data }
        guard let uploadURLText = data["uploadUrl"]?.stringValue,
              let uploadURL = URL(string: uploadURLText),
              let fileID = data["fileID"]?.stringValue
        else { throw CloudBaseAPIError.emptyData("media.prepareUpload") }

        var request = URLRequest(url: uploadURL)
        request.httpMethod = data["method"]?.stringValue ?? "PUT"
        let headers = data["headers"]?.objectValue ?? [:]
        for (key, value) in headers {
            if let headerValue = value.stringValue {
                request.setValue(headerValue, forHTTPHeaderField: key)
            }
        }
        if request.value(forHTTPHeaderField: "Content-Type") == nil {
            request.setValue(type.defaultContentType, forHTTPHeaderField: "Content-Type")
        }
        let (_, response) = try await session.upload(for: request, fromFile: localURL)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw CloudBaseAPIError.transport
        }
        data["fileID"] = .string(fileID)
        if let fileSize = try? localURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
            data["size"] = .number(Double(fileSize))
        }
        return data
    }

    private func postJSON(_ url: URL, body: JSONValue) async throws -> [String: JSONValue] {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ios", forHTTPHeaderField: "X-Improv-Client")
        request.setValue(configuration.userId, forHTTPHeaderField: "X-Improv-User-Id")
        request.setValue(configuration.sessionToken, forHTTPHeaderField: "X-Improv-Session-Token")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw CloudBaseAPIError.transport
        }
        let decoded = try JSONDecoder().decode(JSONValue.self, from: data)
        guard let object = decoded.objectValue else { throw CloudBaseAPIError.emptyData("response") }
        return object
    }
}

public enum CloudBaseAPIError: Error, Equatable, LocalizedError {
    case transport
    case actionFailed(String, Int, String?)
    case emptyData(String)

    public var errorDescription: String? {
        switch self {
        case .transport: "网络异常，请重试"
        case .actionFailed(let message, _, _): message
        case .emptyData(let action): "\(action) 返回数据为空"
        }
    }
}

public enum JSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var intValue: Int? {
        switch self {
        case .number(let value): Int(value)
        case .string(let value): Int(value)
        default: nil
        }
    }

    var doubleValue: Double? {
        switch self {
        case .number(let value): value
        case .string(let value): Double(value)
        default: nil
        }
    }

    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }
}

protocol JSONInitializable {
    init?(json: JSONValue)
}

extension Material: JSONInitializable {
    init?(json: JSONValue) {
        guard let object = json.objectValue,
              let id = object.string("id"),
              let title = object.string("title"),
              let typeText = object.string("type"),
              let type = MaterialType(rawValue: typeText)
        else { return nil }
        self.init(
            id: id,
            title: title,
            desc: object.string("desc") ?? "",
            type: type,
            tags: object.stringArray("tags"),
            abilities: object.stringArray("abilities"),
            scenes: object.stringArray("scenes"),
            steps: object.stringArray("steps"),
            tips: object.string("tips") ?? "",
            variant: object.string("variant") ?? "",
            issue: object.string("issue") ?? "",
            relatedMaterialId: object.string("relatedMaterialId") ?? "",
            referenceOnly: object.bool("referenceOnly"),
            isOwnedByCurrentUser: object.bool("isOwnedByCurrentUser") ?? false,
            saved: object.bool("saved") ?? false,
            played: object.bool("played") ?? false,
            playedCount: object.int("playedCount") ?? 0
        )
    }

    var jsonPayload: [String: JSONValue] {
        [
            "id": .string(id),
            "title": .string(title),
            "desc": .string(desc),
            "type": .string(type.rawValue),
            "tags": .array(tags.map(JSONValue.string)),
            "abilities": .array(abilities.map(JSONValue.string)),
            "scenes": .array(scenes.map(JSONValue.string)),
            "steps": .array(steps.map(JSONValue.string)),
            "tips": .string(tips),
            "variant": .string(variant),
            "issue": .string(issue),
            "relatedMaterialId": .string(relatedMaterialId),
            "referenceOnly": .bool(referenceOnly)
        ]
    }
}

extension Inspiration: JSONInitializable {
    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            title: object.string("title") ?? "",
            desc: object.string("desc") ?? "",
            meta: object.stringArray("meta"),
            linkedMaterialId: object.string("linkedMaterialId") ?? "",
            linkedMaterialTitle: object.string("linkedMaterialTitle") ?? "",
            linkedRehearsalId: object.string("linkedRehearsalId") ?? "",
            linkedRehearsalTitle: object.string("linkedRehearsalTitle") ?? "",
            attachments: object.attachmentArray("attachments"),
            createdAt: object.date("createdAt") ?? Date()
        )
    }

    var jsonPayload: [String: JSONValue] {
        [
            "id": .string(id),
            "title": .string(title),
            "desc": .string(desc),
            "meta": .array(meta.map(JSONValue.string)),
            "linkedMaterialId": .string(linkedMaterialId),
            "linkedMaterialTitle": .string(linkedMaterialTitle),
            "linkedRehearsalId": .string(linkedRehearsalId),
            "linkedRehearsalTitle": .string(linkedRehearsalTitle),
            "attachments": .array(attachments.map(\.jsonValue))
        ]
    }
}

extension PracticeRecord: JSONInitializable {
    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            materialId: object.string("materialId") ?? "",
            materialTitle: object.string("materialTitle") ?? "",
            rehearsalId: object.string("rehearsalId") ?? "",
            rehearsalTitle: object.string("rehearsalTitle") ?? "",
            score: object.int("score") ?? 0,
            note: object.string("note") ?? object.string("desc") ?? "",
            attachments: object.attachmentArray("attachments"),
            comparisonNotes: object.comparisonArray("comparisonNotes"),
            reminder: object.string("reminder") ?? "",
            duration: object.string("duration") ?? "",
            meta: object.stringArray("meta"),
            createdAt: object.date("createdAt") ?? Date()
        )
    }

    var jsonPayload: [String: JSONValue] {
        [
            "id": .string(id),
            "materialId": .string(materialId),
            "materialTitle": .string(materialTitle),
            "rehearsalId": .string(rehearsalId),
            "rehearsalTitle": .string(rehearsalTitle),
            "score": .number(Double(score)),
            "note": .string(note),
            "attachments": .array(attachments.map(\.jsonValue)),
            "comparisonNotes": .array(comparisonNotes.map(\.jsonValue)),
            "reminder": .string(reminder),
            "duration": .string(duration),
            "meta": .array(meta.map(JSONValue.string))
        ]
    }
}

extension Rehearsal: JSONInitializable {
    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            title: object.string("title") ?? "今日排练",
            desc: object.string("desc") ?? "",
            teamName: object.string("teamName") ?? "",
            duration: object.string("duration") ?? "60 分钟",
            goals: object.stringArray("goals"),
            source: object.string("source").flatMap(RehearsalSource.init(rawValue:)) ?? .recommended,
            status: object.string("status").flatMap(TaskStatus.init(rawValue:)) ?? .inProgress,
            plan: object.planArray("plan"),
            reviewKeep: object.string("reviewKeep") ?? "",
            reviewTry: object.string("reviewTry") ?? "",
            reviewReminder: object.string("reviewReminder") ?? "",
            createdAt: object.date("createdAt") ?? Date()
        )
    }

    var jsonPayload: [String: JSONValue] {
        [
            "id": .string(id),
            "title": .string(title),
            "desc": .string(desc),
            "teamName": .string(teamName),
            "duration": .string(duration),
            "goals": .array(goals.map(JSONValue.string)),
            "source": .string(source.rawValue),
            "status": .string(status.rawValue),
            "plan": .array(plan.map(\.jsonValue)),
            "reviewKeep": .string(reviewKeep),
            "reviewTry": .string(reviewTry),
            "reviewReminder": .string(reviewReminder)
        ]
    }
}

extension MethodCard: JSONInitializable {
    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            title: object.string("title") ?? "",
            desc: object.string("desc") ?? "",
            sourceType: object.string("sourceType") ?? "",
            createdAt: object.date("createdAt") ?? Date()
        )
    }

    var jsonPayload: [String: JSONValue] {
        ["id": .string(id), "title": .string(title), "desc": .string(desc), "sourceType": .string(sourceType)]
    }
}

extension Profile {
    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            displayName: object.string("displayName") ?? "即兴主理人",
            avatarUrl: object.string("avatarUrl") ?? "",
            troupeName: object.string("troupeName") ?? "个人私密训练空间"
        )
    }

    var jsonPayload: [String: JSONValue] {
        ["displayName": .string(displayName), "troupeName": .string(troupeName), "avatarUrl": .string(avatarUrl)]
    }
}

extension Feedback {
    var jsonPayload: [String: JSONValue] {
        [
            "category": .string(category),
            "content": .string(content),
            "contact": .string(contact),
            "sourcePage": .string(sourcePage),
            "appVersion": .string(appVersion)
        ]
    }
}

private extension PracticeAttachment {
    var jsonValue: JSONValue {
        .object([
            "id": .string(id),
            "type": .string(type.rawValue),
            "fileID": .string(fileID),
            "thumbFileID": thumbFileID.isEmpty ? .null : .string(thumbFileID),
            "duration": duration.map(JSONValue.number) ?? .null,
            "size": size.map { .number(Double($0)) } ?? .null,
            "markers": .array(markers.map(\.jsonValue)),
            "createdAt": .number(createdAt.timeIntervalSince1970)
        ])
    }

    init?(json: JSONValue) {
        guard let object = json.objectValue,
              let typeText = object.string("type"),
              let type = AttachmentType(rawValue: typeText)
        else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            type: type,
            fileID: object.string("fileID") ?? "",
            thumbFileID: object.string("thumbFileID") ?? "",
            duration: object.double("duration"),
            size: object.int("size"),
            markers: object.markerArray("markers"),
            createdAt: object.date("createdAt") ?? Date()
        )
    }
}

private extension AttachmentMarker {
    var jsonValue: JSONValue {
        .object([
            "id": .string(id),
            "time": .number(time),
            "kind": .string(kind),
            "note": .string(note)
        ])
    }

    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            time: object.double("time") ?? 0,
            kind: object.string("kind") ?? "neutral",
            note: object.string("note") ?? "",
            createdAt: object.date("createdAt") ?? Date()
        )
    }
}

private extension RehearsalMaterialStatusUpdate {
    var jsonPayload: [String: JSONValue] {
        [
            "rehearsalId": .string(rehearsalId),
            "materialId": .string(materialId),
            "status": .string(status.rawValue),
            "keep": .string(keep),
            "try": .string(tryNext),
            "rehearsalStatus": rehearsalStatus.map { .string($0.rawValue) } ?? .null
        ]
    }
}

private extension Rehearsal {
    var textValuesForSecurity: [String] {
        [title, desc, teamName, duration, reviewKeep, reviewTry, reviewReminder]
            + goals
            + plan.flatMap { [$0.materialTitle, $0.keep, $0.tryNext] }
    }
}

private extension AttachmentType {
    var defaultContentType: String {
        switch self {
        case .image: "image/jpeg"
        case .video: "video/mp4"
        case .audio: "audio/mp4"
        }
    }
}

private extension ComparisonNote {
    var jsonValue: JSONValue {
        .object([
            "id": .string(id),
            "comparedRecordIds": .array(comparedRecordIds.map(JSONValue.string)),
            "improvement": .string(improvement),
            "issue": .string(issue),
            "nextFocus": .string(nextFocus)
        ])
    }

    init?(json: JSONValue) {
        guard let object = json.objectValue else { return nil }
        self.init(
            id: object.string("id") ?? UUID().uuidString,
            comparedRecordIds: object.stringArray("comparedRecordIds"),
            improvement: object.string("improvement") ?? "",
            issue: object.string("issue") ?? "",
            nextFocus: object.string("nextFocus") ?? "",
            createdAt: object.date("createdAt") ?? Date()
        )
    }
}

private extension RehearsalPlanItem {
    var jsonValue: JSONValue {
        .object([
            "materialId": .string(materialId),
            "materialTitle": .string(materialTitle),
            "status": .string(status.rawValue),
            "keep": .string(keep),
            "tryNext": .string(tryNext)
        ])
    }

    init?(json: JSONValue) {
        guard let object = json.objectValue,
              let materialId = object.string("materialId")
        else { return nil }
        self.init(
            materialId: materialId,
            materialTitle: object.string("materialTitle") ?? "",
            status: object.string("status").flatMap(TaskStatus.init(rawValue:)) ?? .notStarted,
            keep: object.string("keep") ?? "",
            tryNext: object.string("tryNext") ?? ""
        )
    }
}

private extension Dictionary where Key == String, Value == JSONValue {
    func string(_ key: String) -> String? { self[key]?.stringValue }
    func int(_ key: String) -> Int? { self[key]?.intValue }
    func double(_ key: String) -> Double? { self[key]?.doubleValue }
    func bool(_ key: String) -> Bool? { self[key]?.boolValue }

    func stringArray(_ key: String) -> [String] {
        self[key]?.arrayValue?.compactMap(\.stringValue) ?? []
    }

    func attachmentArray(_ key: String) -> [PracticeAttachment] {
        self[key]?.arrayValue?.compactMap(PracticeAttachment.init(json:)) ?? []
    }

    func markerArray(_ key: String) -> [AttachmentMarker] {
        self[key]?.arrayValue?.compactMap(AttachmentMarker.init(json:)) ?? []
    }

    func comparisonArray(_ key: String) -> [ComparisonNote] {
        self[key]?.arrayValue?.compactMap(ComparisonNote.init(json:)) ?? []
    }

    func planArray(_ key: String) -> [RehearsalPlanItem] {
        self[key]?.arrayValue?.compactMap(RehearsalPlanItem.init(json:)) ?? []
    }

    func date(_ key: String) -> Date? {
        guard let value = self[key] else { return nil }
        if let seconds = value.doubleValue { return Date(timeIntervalSince1970: seconds / (seconds > 10_000_000_000 ? 1000 : 1)) }
        guard let text = value.stringValue else { return nil }
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: text)
    }
}
