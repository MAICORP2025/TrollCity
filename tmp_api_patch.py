from pathlib import Path
path = Path('src/lib/api.ts')
text = path.read_text(encoding='utf-8')
old =  livekit: \\n    token: '/livekit-token',   // dY`^ Correct path for STREAM token\\n  ,\\n
if old not in text:
    raise SystemExit('old snippet not found')
addition =  broadcastSeats: \\n    list: '/broadcast-seats',\\n    action: '/broadcast-seats',\\n  ,\\n
text = text.replace(old, old + addition, 1)
path.write_text(text, encoding='utf-8')
