// The words on one page picture of the captured book, each with its box and how far it leans.
//
// The book sets some words of its notes in italics, and neither the capture nor the text read off
// the pictures says which. A slanted word leans: its upright strokes stand straightest once the
// picture is sheared by about ten degrees, where a roman word's stand straightest at none. So for
// each word Apple's text reader finds, this shears the word's ink through -20 to 30 degrees and
// keeps the angle at which the columns of ink are sharpest (the largest sum of squared column
// counts). See docs/issues/italics-from-page-pictures.md for how well that tells the two apart.
//
// Each picture is a two-page spread, read one half at a time so a line never runs across the
// gutter. Boxes are fractions of the whole picture, measured from its top-left corner. The output
// holds the book's words, so it is written only beside the pictures, in the books repository's
// ignored work folder, never into this one.
//
//   swiftc -O page-words.swift -o page-words && ./page-words page_0052.png > page_0052.json
import Foundation
import Vision
import AppKit
struct Word: Codable { let line: Int; let text: String; let x: Double; let y: Double; let w: Double; let h: Double; let slant: Double }
let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(2) }
let W = Double(cg.width), H = Double(cg.height)
var out: [Word] = []
let IW = cg.width, IH = cg.height
var gray = [UInt8](repeating: 255, count: IW * IH)
let ctx = CGContext(data: &gray, width: IW, height: IH, bitsPerComponent: 8, bytesPerRow: IW, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: IW, height: IH))
// The shear (degrees, top leaning right is positive) that makes the word's strokes most upright.
// -99 when the box holds too little ink to say (a dot, a box off the picture).
func slantOf(x: Double, y: Double, w: Double, h: Double) -> Double {
  let pad = h * H * 0.2
  let x0 = max(0, Int(x * W - pad)), x1 = min(IW - 1, Int((x + w) * W + pad))
  let y0 = max(0, Int(y * H)), y1 = min(IH - 1, Int((y + h) * H))
  if x1 <= x0 || y1 <= y0 { return -99 }
  var ink: [(Double, Double)] = []
  for yy in y0...y1 { for xx in x0...x1 where gray[yy * IW + xx] < 110 { ink.append((Double(xx), Double(yy))) } }
  if ink.count < 20 { return -99 }
  let yc = Double(y0 + y1) / 2
  var best = 0.0, bestScore = -1.0
  for deg in stride(from: -20.0, through: 30.0, by: 1.0) {
    let t = tan(deg * .pi / 180)
    var hist = [Double](repeating: 0, count: (x1 - x0) + Int(Double(y1 - y0) * 0.7) + 4)
    let off = Double(y1 - y0) * 0.35 + 2
    for (px, py) in ink { let c = Int(px - Double(x0) + (py - yc) * t + off); if c >= 0 && c < hist.count { hist[c] += 1 } }
    let score = hist.reduce(0) { $0 + $1 * $1 }
    if score > bestScore { bestScore = score; best = deg }
  }
  return best
}
var lineNo = 0
for x0 in [0.0, 0.5] {
  let crop = cg.cropping(to: CGRect(x: x0 * W, y: 0, width: W / 2, height: H))!
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = false
  req.recognitionLanguages = ["en"]
  try! VNImageRequestHandler(cgImage: crop, options: [:]).perform([req])
  for obs in (req.results ?? []) {
    guard let cand = obs.topCandidates(1).first else { continue }
    lineNo += 1
    let s = cand.string
    var i = s.startIndex
    while i < s.endIndex {
      while i < s.endIndex && s[i] == " " { i = s.index(after: i) }
      var j = i
      while j < s.endIndex && s[j] != " " { j = s.index(after: j) }
      if i < j, let r = try? cand.boundingBox(for: i..<j) {
        let b = r.boundingBox
        let wx = x0 + b.minX * 0.5, wy = 1 - b.maxY, ww = b.width * 0.5, wh = b.height
        out.append(Word(line: lineNo, text: String(s[i..<j]), x: wx, y: wy, w: ww, h: wh, slant: slantOf(x: wx, y: wy, w: ww, h: wh)))
      }
      i = j
    }
  }
}
let enc = JSONEncoder()
FileHandle.standardOutput.write(try! enc.encode(out))
