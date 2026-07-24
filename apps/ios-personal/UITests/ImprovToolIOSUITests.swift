import XCTest

@MainActor
final class ImprovToolIOSUITests: XCTestCase {
    override nonisolated func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchApp(tab: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        if let tab {
            app.launchArguments.append("--ui-tab=\(tab)")
        }
        app.launchEnvironment = [
            "IMPROV_RUNTIME_MODE": "mock",
            "IMPROV_ALLOW_MOCK_FALLBACK": "1"
        ]
        app.launch()
        return app
    }

    func testSearchMaterialAndReachTrainingAction() {
        let app = launchApp()
        openTab("发现", identifier: "tab.discover", in: app)
        app.buttons["Zip Zap Zop"].firstMatch.tap()
        XCTAssertTrue(app.buttons["开始训练"].waitForExistence(timeout: 3))
    }

    func testRandomDrawEntryIsReachable() {
        let app = launchApp()
        openTab("发现", identifier: "tab.discover", in: app)
        let random = app.buttons["discover.random"]
        XCTAssertTrue(random.waitForExistence(timeout: 3))
        random.tap()
        XCTAssertTrue(app.staticTexts["随机抽卡"].waitForExistence(timeout: 3))
    }

    func testSaveTextInspiration() {
        let app = launchApp(tab: "记录")
        let editor = app.textViews["record.quickText"].firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 3))
        editor.tap()
        editor.typeText("UI 自动化灵感")
        let save = app.buttons["record.save"]
        XCTAssertTrue(save.isEnabled)
        save.tap()
    }

    func testRehearsalEntryIsReachable() {
        let app = launchApp(tab: "记录")
        let rehearsal = app.buttons["record.rehearsal"].firstMatch
        XCTAssertTrue(rehearsal.waitForExistence(timeout: 3))
        rehearsal.tap()
        XCTAssertTrue(app.staticTexts["快速开启排练"].waitForExistence(timeout: 3))
    }

    func testMineHistoryEntryIsReachable() {
        let app = launchApp(tab: "我的")
        let history = app.buttons["mine.asset.素材练习记录"]
        XCTAssertTrue(history.waitForExistence(timeout: 3))
        history.tap()
        XCTAssertTrue(app.staticTexts["练习记录"].waitForExistence(timeout: 3))
    }

    func testLaunchPerformance() {
        let options = XCTMeasureOptions()
        options.iterationCount = 3
        measure(
            metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)],
            options: options
        ) {
            let app = launchApp()
            app.terminate()
        }
    }

    func testCaptureStoreScreenshots() {
        var app = launchApp()

        capture("01-discover", app: app)
        app.buttons["Zip Zap Zop"].firstMatch.tap()
        XCTAssertTrue(app.buttons["开始训练"].waitForExistence(timeout: 3))
        capture("02-material-detail", app: app)
        app.terminate()
        app = launchApp(tab: "记录")
        capture("03-record", app: app)

        app.terminate()
        app = launchApp(tab: "我的")
        capture("04-mine", app: app)
        if app.buttons["设置"].firstMatch.waitForExistence(timeout: 3) {
            app.buttons["设置"].firstMatch.tap()
            capture("05-settings", app: app)
        }
    }

    private func openTab(_ label: String, identifier: String, in app: XCUIApplication) {
        let identifiedTab = app.buttons[identifier].firstMatch
        if identifiedTab.waitForExistence(timeout: 2) {
            identifiedTab.tap()
            return
        }

        let labelledTab = app.buttons[label].firstMatch
        XCTAssertTrue(labelledTab.waitForExistence(timeout: 3))
        labelledTab.tap()
    }

    private func capture(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
