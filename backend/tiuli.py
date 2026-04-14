import itertools
import json
import re
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup
from pydantic import BaseModel
from rich.progress import Progress

from hike_info import HikeInfo

MADOR_NAME_NEEDED = 'tracks'


class MarkerInfo(BaseModel):
    name: str
    coords: tuple[float, float]  # [latitude, longitude]
    url: str
    mador_name: str


def sanitize_hebrew(text: str) -> str:
    return re.search(r'[\- א-ת]+', text).group(0).strip()


def get_all_markers(session: requests.Session) -> list[MarkerInfo]:
    raw_text = session.get("https://www.tiuli.com/map/around-me").text
    raw_text = raw_text.split("var markers = ")[1].split(";")[0]
    markers = json.loads(raw_text)
    return [MarkerInfo(name=marker.get('title'),
                       coords=(marker.get('lat'), marker.get('lon')),
                       url=marker.get('url'),
                       mador_name=marker.get('mador_name'))
            for marker in markers if marker.get("group_name") != "mcdonalds"]


def get_all_tracks(all_markers: list[MarkerInfo]) -> list[MarkerInfo]:
    return list(filter(lambda marker: marker.mador_name == MADOR_NAME_NEEDED, all_markers))


def gather_hike_info(session: requests.Session, marker_info: MarkerInfo) -> HikeInfo | None:
    raw_html = session.get(marker_info.url).text
    bs = BeautifulSoup(raw_html, 'html.parser')
    if "dimension_project = 'טיולי שטח: טיולי 4x4 ל-SUV אמיתי'" in raw_html:
        return None
    base_features = bs.find('div', class_='features-list-item')
    base_features = base_features.find_all("span")[4].text
    difficulty = sanitize_hebrew(base_features.split(" ")[0])
    length_km = re.search(r'\d+(\.\d+)?', base_features)
    length_km = float(length_km.group(0)) if length_km else 0

    features = [sanitize_hebrew(feature) for feature in
                raw_html.split("dimension_feature =")[1].split(";")[0].split("|")]
    return HikeInfo(name=marker_info.name, coords=(marker_info.coords[0], marker_info.coords[1]), length=length_km,
                    source=marker_info.url, difficulty=difficulty, tags=[*features])


def gather_hike_info_worker(marker_info: MarkerInfo, progress: Progress, task_id) -> HikeInfo:
    try:
        return gather_hike_info(requests.Session(), marker_info)
    except Exception as e:
        print(f"Error processing {marker_info.url}: {e}")
    finally:
        progress.update(task_id, advance=1)


def get_all_hikes():
    session = requests.Session()
    markers = get_all_markers(session)
    all_tracks = get_all_tracks(markers)
    # all_tracks = all_tracks[:10]
    all_hikes: list[HikeInfo] = []
    with Progress() as p:
        t = p.add_task("Tiuili - Processing...", total=len(all_tracks))
        with ThreadPoolExecutor(max_workers=6) as executor:
            all_hikes = list(
                executor.map(gather_hike_info_worker, all_tracks, itertools.repeat(p), itertools.repeat(t)))

    return all_hikes


if __name__ == '__main__':
    session = requests.Session()
    markers = get_all_markers(session)
    all_tracks = get_all_tracks(markers)
    print(len(all_tracks))
    # hikes = get_all_hikes()
    # with open("hikes.json", "w", encoding='utf8') as f:
    #     data = [hike.model_dump() for hike in hikes]
    #     f.write(json.dumps(data, indent=4, ensure_ascii=False))
