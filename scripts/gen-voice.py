"""
Sinh giọng đọc nam của Chú Tư cho mọi câu cố định → src/assets/voice.generated.ts (MP3 base64).

Máy iPhone chỉ có giọng tiếng Việt nữ ("Linh"), nên lời Chú Tư được thu sẵn:
  1. Đọc bằng mô hình Piper vi_VN-vais1000-medium (sherpa-onnx, rõ tiếng, giọng nữ);
  2. Đổi sang giọng nam bằng vocoder WORLD: hạ cao độ × 0,5, dời formant × 0,82
     (cao độ trung bình ~120 Hz, nhận dạng giọng nói vẫn đúng ~88% như giọng gốc).

Cần (một lần):
  python3 -m venv .venv && .venv/bin/pip install sherpa-onnx pyworld lameenc numpy
  curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-vi_VN-vais1000-medium.tar.bz2 | tar xj -C <thư mục mô hình>
Chạy:
  npx tsx scripts/voice-lines.ts > /tmp/lines.json
  .venv/bin/python scripts/gen-voice.py /tmp/lines.json <thư mục mô hình>/vits-piper-vi_VN-vais1000-medium
"""
import base64, json, sys
import lameenc, numpy as np, pyworld as pw, sherpa_onnx

SPEED = 1.2  # tốc độ đọc
F0_SCALE = 0.5  # hạ cao độ
FORMANT_SCALE = 0.82  # dời formant (giọng người lớn, nam)
OUT_RATE = 22050


def load(d):
    name = d.rstrip('/').split('/')[-1].replace('vits-piper-', '')
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(model=f'{d}/{name}.onnx', tokens=f'{d}/tokens.txt', data_dir=f'{d}/espeak-ng-data')
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=4)))


def to_male(x, sr):
    x = x.astype(np.float64)
    f0, t = pw.harvest(x, sr, f0_floor=60, f0_ceil=500, frame_period=5)
    sp = pw.cheaptrick(x, f0, t, sr)
    ap = pw.d4c(x, f0, t, sr)
    n = sp.shape[1]
    src = np.arange(n)
    idx = np.clip(src / FORMANT_SCALE, 0, n - 1)
    sp2 = np.array([np.interp(idx, src, row) for row in sp])
    ap2 = np.array([np.interp(idx, src, row) for row in ap])
    y = pw.synthesize(f0 * F0_SCALE, sp2, ap2, sr, frame_period=5)
    return y / max(1e-6, np.abs(y).max()) * 0.9


def mp3(y, sr):
    enc = lameenc.Encoder()
    enc.set_bit_rate(32)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    return enc.encode(pcm) + enc.flush()


def main():
    lines = json.load(open(sys.argv[1]))
    tts = load(sys.argv[2])
    out = {}
    total = 0
    for i, text in enumerate(lines):
        g = tts.generate(text, sid=0, speed=SPEED)
        data = mp3(to_male(np.array(g.samples, dtype=np.float32), g.sample_rate), g.sample_rate)
        total += len(data)
        out[text] = base64.b64encode(data).decode()
        print(f'{i + 1}/{len(lines)} {len(data) // 1024}KB {text[:50]}', file=sys.stderr)
    with open('src/assets/voice.generated.ts', 'w') as f:
        f.write('/* eslint-disable */\n')
        f.write('// Tự sinh bởi scripts/gen-voice.py — không sửa tay. Giọng nam của Chú Tư (MP3 base64), khoá = speechText(câu).\n')
        f.write('export const VOICE: Record<string, string> = ')
        json.dump(out, f, ensure_ascii=False, indent=0)
        f.write(';\n')
    print(f'{len(out)} câu, {total // 1024} KB', file=sys.stderr)


if __name__ == '__main__':
    main()
