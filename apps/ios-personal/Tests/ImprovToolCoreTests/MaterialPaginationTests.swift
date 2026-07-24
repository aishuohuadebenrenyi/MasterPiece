import XCTest
@testable import ImprovToolCore

@MainActor
final class MaterialPaginationTests: XCTestCase {
    func testSecureEndpointAndExpiredSessionRules() {
        XCTAssertTrue(CloudBaseConfiguration.isSecureEndpoint(URL(string: "https://api.example.com")))
        XCTAssertFalse(CloudBaseConfiguration.isSecureEndpoint(URL(string: "http://api.example.com")))
        XCTAssertFalse(CloudBaseConfiguration.isSecureEndpoint(nil))

        XCTAssertTrue(CloudBaseSession(userId: "user", sessionToken: "token", expiresAt: .distantPast).isExpired)
        XCTAssertFalse(CloudBaseSession(userId: "user", sessionToken: "token", expiresAt: .distantFuture).isExpired)
        XCTAssertFalse(CloudBaseSession(userId: "user", sessionToken: "token").isExpired)
    }

    func testRecordLoadUsesEveryMaterialPage() async {
        let materials = (0..<101).map { index in
            Material(
                id: "material-\(index)",
                title: "素材 \(index)",
                desc: "分页回归测试",
                type: .game
            )
        }
        let repository = MockAppRepository(materials: materials)
        let defaults = UserDefaults(suiteName: "improvtool.tests.\(UUID().uuidString)")!
        let viewModel = RecordViewModel(
            inspirationRepository: repository,
            materialRepository: repository,
            practiceRepository: repository,
            rehearsalRepository: repository,
            methodCardRepository: repository,
            mediaRepository: repository,
            sessionStore: TaskSessionStore(defaults: defaults)
        )

        await viewModel.load()

        XCTAssertEqual(viewModel.materials.count, 101)
        XCTAssertEqual(viewModel.materials.last?.id, "material-100")
    }
}
