/** In ra (JSON) mọi câu cố định Chú Tư đọc — đầu vào cho scripts/gen-voice.py. */
import { voiceLines } from '../src/game/voice';

process.stdout.write(JSON.stringify(voiceLines(), null, 1));
