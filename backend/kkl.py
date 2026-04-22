import json

import requests

from hike_info import HikeInfo

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
KKL_BASE_URL = "https://www.kkl.org.il"

DIFFICULTIES = {
    "basic": "קל",
    "accessible": "קל",
    "medium": "בינוני",
    "high": "קשה",
}

LENGTHS = {
    "": "0",
    "8-2": "8"
}

TAGS = {
    "מסלול מעגלי": "מעגלי",
    "חלק משביל ישראל": "מקטע משביל ישראל",

}


def get_from_props(props: list[dict], key: str) -> dict:
    return [prop for prop in props if prop.get("Key") == key][0]


def get_all_hikes():
    session = requests.Session()
    kkl_trips = session.get("https://www.kkl.org.il/travel/trips/", headers=HEADERS)
    all_tracks = json.loads(kkl_trips.text.split("const _items = ")[1].split(";\r\n")[0])
    all_tracks = (track for track in all_tracks if "/trips/" in track.get("Link"))

    all_hikes = [
        HikeInfo(
            name=track.get("Title"),
            coords=(track.get("lat"), track.get("lng")),
            length=float(LENGTHS.get(get_from_props(track.get("props"), "K_LENGTH").get("Data"),
                                     get_from_props(track.get("props"), "K_LENGTH").get("Data"))),
            source=KKL_BASE_URL + track.get("Link"),
            difficulty=DIFFICULTIES.get(get_from_props(track.get("props"), "K_DIFFICULTY").get("Data"), ""),
            tags=TAGS.get(get_from_props(track.get("props"), "K_POI").get("DataText").strip(),
                          get_from_props(track.get("props"), "K_POI").get("DataText").strip())
        )
        for track in all_tracks]

    return all_hikes


if __name__ == '__main__':
    print(len(get_all_hikes()))
    with open("kkl_hikes.json", "w", encoding='utf8') as f:
        data = [hike.model_dump() for hike in get_all_hikes() if hike]
        json.dump(data, f, indent=4, ensure_ascii=False)
