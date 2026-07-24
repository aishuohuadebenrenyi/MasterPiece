import XCTest
@testable import ImprovToolCore

final class AdaptiveLayoutModeTests: XCTestCase {
    func testPhoneAlwaysUsesCompactLayout() {
        XCTAssertEqual(AdaptiveLayoutMode.resolve(isPad: false, usesRegularWidth: true), .compact)
    }

    func testPadFollowsCurrentHorizontalSizeClass() {
        XCTAssertEqual(AdaptiveLayoutMode.resolve(isPad: true, usesRegularWidth: false), .compact)
        XCTAssertEqual(AdaptiveLayoutMode.resolve(isPad: true, usesRegularWidth: true), .split)
    }
}
