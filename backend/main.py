import json
from threading import Thread

from parks import get_all_hikes as get_parks_hikes
from tiuli import get_all_hikes as get_tiuli_hikes


def main():
    """call both scrapers in parallel, combine results and save them to json"""
    results = []

    def run_parks():
        results.extend(get_parks_hikes())

    def run_tiuli():
        results.extend(get_tiuli_hikes())

    t1 = Thread(target=run_parks)
    t2 = Thread(target=run_tiuli)

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    with open("hikes.json", "w", encoding='utf8') as f:
        data = [hike.model_dump() for hike in results if hike]
        json.dump(data, f, indent=4, ensure_ascii=False)


if __name__ == '__main__':
    main()
