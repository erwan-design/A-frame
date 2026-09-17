// Encode une suite de PNG en MP4 H.264 avec AVFoundation, puis relit le
// fichier produit pour en vérifier la durée, la taille, et en extraire des
// images — pour juger le rendu après compression, pas avant.
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import CoreVideo
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 4 else { print("usage: encode <images> <sortie.mp4> <dossier-controle>"); exit(2) }
let framesDir = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let checkDir = URL(fileURLWithPath: args[3])
let fps: Int32 = Int32(ProcessInfo.processInfo.environment["FPS"] ?? "60") ?? 60
let bitrate = Int(ProcessInfo.processInfo.environment["BITRATE"] ?? "20000000") ?? 20_000_000

let files = try FileManager.default.contentsOfDirectory(at: framesDir, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard let first = files.first,
      let src0 = CGImageSourceCreateWithURL(first as CFURL, nil),
      let img0 = CGImageSourceCreateImageAtIndex(src0, 0, nil) else { print("aucune image"); exit(1) }
let width = img0.width, height = img0.height

try? FileManager.default.removeItem(at: outURL)
let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2
    ],
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitrate,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: Int(fps),
        AVVideoExpectedSourceFrameRateKey: Int(fps)
    ]
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
guard writer.canAdd(input) else { print("entrée refusée"); exit(1) }
writer.add(input)
guard writer.startWriting() else { print("échec : \(String(describing: writer.error))"); exit(1) }
writer.startSession(atSourceTime: .zero)

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
for (i, url) in files.enumerated() {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil),
          let pool = adaptor.pixelBufferPool else { print("image \(i) illisible"); exit(1) }
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
    guard let buffer = pb else { print("pas de tampon"); exit(1) }
    CVPixelBufferLockBaseAddress(buffer, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
                        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: srgb,
                        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.interpolationQuality = .none
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
    guard adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps)) else {
        print("échec à l'image \(i) : \(String(describing: writer.error))"); exit(1)
    }
}
input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: CMTimeValue(files.count), timescale: fps))
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else { print("échec : \(String(describing: writer.error))"); exit(1) }

// ─── relecture ───
let asset = AVURLAsset(url: outURL)
let sem = DispatchSemaphore(value: 0)
Task {
    do {
        let duration = try await asset.load(.duration)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let size = try await track.load(.naturalSize)
        let rate = try await track.load(.nominalFrameRate)
        let bytes = (try FileManager.default.attributesOfItem(atPath: outURL.path)[.size] as? NSNumber)?.intValue ?? 0
        print(String(format: "fichier : %.2f s, %dx%d, %.0f i/s, %.1f Mo", duration.seconds,
                     Int(size.width), Int(size.height), rate, Double(bytes) / 1_048_576))

        let gen = AVAssetImageGenerator(asset: asset)
        gen.requestedTimeToleranceBefore = .zero
        gen.requestedTimeToleranceAfter = .zero
        try FileManager.default.createDirectory(at: checkDir, withIntermediateDirectories: true)
        for t in [1.8, 3.6, 8.5, 9.9] {
            let (cg, _) = try await gen.image(at: CMTime(seconds: t, preferredTimescale: 600))
            let dest = checkDir.appendingPathComponent(String(format: "decode-%.1f.png", t))
            let d = CGImageDestinationCreateWithURL(dest as CFURL, UTType.png.identifier as CFString, 1, nil)!
            CGImageDestinationAddImage(d, cg, nil)
            CGImageDestinationFinalize(d)
        }
        print("images de contrôle extraites du MP4")
    } catch {
        print("relecture impossible : \(error)")
    }
    sem.signal()
}
sem.wait()
