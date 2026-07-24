// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "ImprovToolIOS",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "ImprovToolCore", targets: ["ImprovToolCore"]),
        .executable(name: "ImprovToolCoreValidation", targets: ["ImprovToolCoreValidation"])
    ],
    targets: [
        .target(
            name: "ImprovToolCore",
            path: "Sources/ImprovToolCore"
        ),
        .executableTarget(
            name: "ImprovToolCoreValidation",
            dependencies: ["ImprovToolCore"],
            path: "Validation"
        ),
        .testTarget(
            name: "ImprovToolCoreTests",
            dependencies: ["ImprovToolCore"],
            path: "Tests/ImprovToolCoreTests"
        )
    ]
)
