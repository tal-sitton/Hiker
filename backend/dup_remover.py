import json

from hike_info import HikeInfo

with open('hikes.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

hikes = [HikeInfo(**item) for item in data]

ids = []

output = []
for hike in hikes:
    if "tiuli" in hike.source:
        id = hike.source.split("https://www.tiuli.com/tracks/")[1].split("/")[0]
        if id in ids:
            print(f"Duplicate hike found: {hike.source}")
            continue
        else:
            ids.append(id)
    output.append(hike)

with open('hikes2.json', 'w', encoding='utf-8') as f:
    json.dump([hike.model_dump() for hike in output], f, ensure_ascii=False, indent=4)
