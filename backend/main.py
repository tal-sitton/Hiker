import json
from threading import Thread
from typing import Callable

from kkl import get_all_hikes as get_kkl_hikes
from parks import get_all_hikes as get_parks_hikes
from tiuli import get_all_hikes as get_tiuli_hikes


def fresh():
    """call all scrapers in parallel, combine results and save them to json"""
    results = []

    def run_parks():
        results.extend(get_parks_hikes())

    def run_tiuli():
        results.extend(get_tiuli_hikes())

    def run_kkl():
        results.extend(get_kkl_hikes())

    t1 = Thread(target=run_parks)
    t2 = Thread(target=run_tiuli)
    t3 = Thread(target=run_kkl)

    t1.start()
    t2.start()
    t3.start()

    t1.join()
    t2.join()
    t3.join()

    with open("hikes.json", "w", encoding='utf8') as f:
        data = [hike.model_dump() for hike in results if hike]
        json.dump(data, f, indent=4, ensure_ascii=False)

def append(scraper: Callable):
    """call a single scraper and append results to json"""
    new_hikes = scraper()
    with open("hikes.json", "r+", encoding='utf8') as f:
        existing_data = json.load(f)
        existing_data.extend([hike.model_dump() for hike in new_hikes if hike])
        f.seek(0)
        json.dump(existing_data, f, indent=4, ensure_ascii=False)
    print(f"Appended {len(new_hikes)} hikes from {scraper.__name__} to hikes.json")

if __name__ == '__main__':
    # fresh()
    append(get_kkl_hikes)
