import SwiftUI
import AVFAudio
import AVKit
import PhotosUI
import UniformTypeIdentifiers
import UIKit
import ImageIO

struct MediaPreviewSupport {
    static func previewURL(from fileID: String) -> URL? {
        if let url = URL(string: fileID), ["http", "https", "file"].contains(url.scheme?.lowercased() ?? "") {
            return url
        }
        if fileID.hasPrefix("mock://") || fileID.hasPrefix("local://") {
            return URL(string: fileID)
        }
        return nil
    }

    static func previewImage(from url: URL, maxPixelSize: CGFloat = 2_048) async -> UIImage? {
        guard url.isFileURL else { return nil }
        let result = await Task.detached(priority: .utility) {
            let options = [kCGImageSourceShouldCache: false] as CFDictionary
            guard let source = CGImageSourceCreateWithURL(url as CFURL, options) else {
                return SendableImage(value: nil)
            }
            let thumbnailOptions = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
            ] as CFDictionary
            let image = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions).map(UIImage.init(cgImage:))
            return SendableImage(value: image)
        }.value
        return result.value
    }

    static func makePlayer(for url: URL) -> AVPlayer {
        AVPlayer(url: url)
    }
}

private struct SendableImage: @unchecked Sendable {
    let value: UIImage?
}

struct MediaAttachmentView: View {
    let attachment: PracticeAttachment
    var title: String? = nil
    var embedded = false
    var onResolve: ((String) async -> MediaPlaybackResource?)? = nil
    @State private var resolvedURL: URL?
    @State private var localImage: UIImage?
    @State private var videoPlayer: AVPlayer?
    @State private var resolving = false
    @State private var resolutionFailed = false

    var body: some View {
        Group {
            if embedded {
                content
            } else {
                AppCard { content }
            }
        }
        .task(id: attachment.fileID) { await resolveIfNeeded() }
        .onDisappear {
            videoPlayer?.pause()
            videoPlayer = nil
        }
    }

    private var content: some View {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: iconName)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(tint)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title ?? defaultTitle)
                            .font(.headline.weight(.heavy))
                            .foregroundStyle(AppTheme.textPrimary)
                        Text(metaText)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.textSecondary)
                    }
                    Spacer()
                    if resolving {
                        ProgressView().scaleEffect(0.8)
                    } else if resolutionFailed {
                        Button("重试") {
                            Task { await resolveIfNeeded(force: true) }
                        }
                            .font(.caption.weight(.bold))
                    }
                }
                mediaBody
            }
    }

    @ViewBuilder
    private var mediaBody: some View {
        switch attachment.type {
        case .image:
            if let image = localImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            } else if let url = resolvedURL, !url.isFileURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else if phase.error != nil {
                        unavailablePreview(title: "图片加载失败")
                    } else {
                        ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            } else {
                unavailablePreview(title: "图片暂不可预览")
            }
        case .video:
            if videoPlayer != nil {
                VideoPlayer(player: videoPlayer)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                unavailablePreview(title: "视频暂不可播放")
            }
        case .audio:
            if let url = resolvedURL {
                AudioRemotePreviewBar(url: url, duration: attachment.duration)
            } else {
                unavailablePreview(title: "音频暂不可播放")
            }
        }
    }

    private func unavailablePreview(title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(AppTheme.inputBackground, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var defaultTitle: String {
        switch attachment.type { case .image: "照片"; case .video: "视频"; case .audio: "音频" }
    }

    private var metaText: String {
        switch attachment.type {
        case .image: "图片资源"
        case .video: attachment.markers.isEmpty ? "视频资源" : "\(attachment.markers.count) 个关键时刻"
        case .audio: attachment.duration.map { "\(Int($0)) 秒" } ?? "音频资源"
        }
    }

    private var iconName: String {
        switch attachment.type { case .image: "photo"; case .video: "play.rectangle.fill"; case .audio: "waveform" }
    }

    private var tint: Color {
        switch attachment.type { case .image: AppTheme.blue; case .video: AppTheme.orange; case .audio: AppTheme.teal }
    }

    private func resolveIfNeeded(force: Bool = false) async {
        guard force || resolvedURL == nil else { return }
        resolutionFailed = false
        guard let url = MediaPreviewSupport.previewURL(from: attachment.fileID) else {
            guard let onResolve else {
                resolutionFailed = true
                return
            }
            resolving = true
            defer { resolving = false }
            if let resource = await onResolve(attachment.fileID) {
                await applyResolvedURL(resource.url)
            } else {
                resolutionFailed = true
            }
            return
        }
        await applyResolvedURL(url)
    }

    private func applyResolvedURL(_ url: URL) async {
        resolvedURL = url
        switch attachment.type {
        case .image:
            localImage = await MediaPreviewSupport.previewImage(from: url)
        case .video:
            videoPlayer?.pause()
            videoPlayer = MediaPreviewSupport.makePlayer(for: url)
        case .audio:
            break
        }
    }
}

struct AudioRemotePreviewBar: View {
    let url: URL
    var duration: TimeInterval? = nil
    @State private var player: AVPlayer?
    @State private var isPlaying = false

    var body: some View {
        HStack(spacing: 12) {
            SmallPillButton(title: isPlaying ? "暂停" : "播放") {
                if player == nil { player = MediaPreviewSupport.makePlayer(for: url) }
                guard let player else { return }
                if isPlaying { player.pause() } else { player.play() }
                isPlaying.toggle()
            }
            if let duration {
                Text("\(Int(duration)) 秒")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.textSecondary)
            }
        }
    }
}
