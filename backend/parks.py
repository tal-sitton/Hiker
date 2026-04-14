import os

import dotenv

dotenv.load_dotenv()
import itertools
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import requests
from bs4 import BeautifulSoup
from rich.progress import Progress

from hike_info import HikeInfo

PARKS_ALL_TRACKS_URL = "https://www.parks.org.il/ajax-handler-wp-loadmore.php?page={page}&args=%7B%27posts_per_page%27%3A100%2C%27post_status%27%3A%27publish%27%2C%27post_type%27%3A%27trip%27%2C%27tag%27%3A%27%27%7D&st=9&action=ajax_script_load_more"

GOOGLE_URL = "https://geocode.googleapis.com/v4/geocode/address/{location_name}?key=" + os.getenv("GOOGLE_API_KEY")

MAPS_CO_URL = "https://geocode.maps.co/search?q={location_name}&api_key=" + os.getenv("MAPS_CO_API_KEY")

TOMTOM_URL = "https://api.tomtom.com/search/2/search/{location_name}.json?minFuzzyLevel=1&maxFuzzyLevel=2&view=Unified&relatedPois=off&key=" + os.getenv(
    "TOMTOM_API_KEY")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

DIFFICULTY = {
    "קל": "קל",
    "קלה": "קל",
    "בינוני": "בינוני",
    "בינונית": "בינוני",
    "קשה": "קשה",
    "מטיבי לכת": "קשה"
}


def sanitize_hebrew(text: str) -> str:
    if text.endswith("("):
        return text.split(")")[0].strip()
    return text.strip()


def __get_google_coords(session: requests.Session, location_name: str) -> tuple[float, float]:
    location_info = session.get(GOOGLE_URL.format(location_name=location_name)).json()
    return (location_info.get('results')[0].get('location').get('latitude'),
            location_info.get('results')[0].get('location').get('longitude'))


def __get_maps_co_coords(session: requests.Session, location_name: str) -> tuple[float, float]:
    location_info = session.get(MAPS_CO_URL.format(location_name=location_name)).json()
    return (location_info[0].get('lat'), location_info[0].get('lon'))


def __get_tomtom_coords(session: requests.Session, location_name: str) -> tuple[float, float]:
    location_info = session.get(TOMTOM_URL.format(location_name=location_name)).json()
    return (location_info.get('results')[0].get('position').get('lat'),
            location_info.get('results')[0].get('position').get('lon'))


def get_coords(session: requests.Session, location_name: str) -> tuple[float, float]:
    try:
        return __get_google_coords(session, location_name)
    except Exception as e:
        pass
    try:
        return __get_maps_co_coords(session, location_name)
    except Exception as e:
        pass
    try:
        return __get_tomtom_coords(session, location_name)
    except Exception as e:
        raise e


def get_all_urls(session: requests.Session) -> list[str]:
    urls = []
    page = 0
    while True:
        response = session.get(PARKS_ALL_TRACKS_URL.format(page=page), headers=HEADERS)
        if response.text == '00':
            break
        urls += ([tag.get('href') for tag in BeautifulSoup(response.text, 'html.parser').find_all('a')])
        page += 1
    return list(set(urls))


def gather_hike_info(url: str) -> HikeInfo:
    session = requests.Session()
    raw_html = session.get(url, headers=HEADERS).text
    bs = BeautifulSoup(raw_html, 'html.parser')
    location_name = sanitize_hebrew(raw_html.split("כתבו בוויז: ")[1].split("<")[0].strip())
    try:
        base_length = \
            [n for n in bs.find_all("div", {"class": "useIcon"}) if "משך ואורך המסלול" in n.text][0].find_all_next(
                "div", {
                    "class": "editor"})[0]
        length = float(re.search(r'\d+(\.\d+)?', base_length.text).group(0))
    except Exception as e:
        print(e)
        length = 0

    try:
        base_info = \
            [n for n in bs.find_all("div", {"class": "useIcon"}) if "דרגת קושי ואופי הטיול" in n.text][0].find_all_next(
                "div", {
                    "class": "editor"})[0]
        tags = ["מעגלי"] if "מעגלי" in base_info.text else []
        difficulty = [parsed for raw, parsed in DIFFICULTY.items() if raw in base_info.text]
        if difficulty:
            difficulty = difficulty[0]
        else:
            difficulty = "לא ידוע"
    except Exception as e:
        print(e)
        difficulty = "לא ידוע"
        tags = []

    coords = get_coords(session, location_name)

    return HikeInfo(name=location_name, coords=coords, length=length, source=url, difficulty=difficulty, tags=tags)


def gather_hike_info_worker(track: str, p: Progress, t) -> Optional[HikeInfo]:
    try:
        return gather_hike_info(track)
    except Exception as e:
        print(f"Error processing {track}: {e}")
    finally:
        p.update(t, advance=1)


def get_all_hikes():
    session = requests.Session()
    all_tracks = get_all_urls(session)
    # all_tracks = all_tracks[:10]
    with Progress() as p:
        t = p.add_task("Parks - Processing...", total=len(all_tracks))
        with ThreadPoolExecutor(max_workers=6) as executor:
            all_hikes = list(
                executor.map(gather_hike_info_worker, all_tracks, itertools.repeat(p), itertools.repeat(t)))
    return all_hikes


if __name__ == '__main__':
    get_coords(requests.session(), "כפר שבילי")
    # hikes = get_all_hikes()
    # with open("hikes2.json", "w", encoding='utf8') as f:
    #     data = [hike.model_dump() for hike in hikes]
    #     f.write(json.dumps(data, indent=4, ensure_ascii=False))
