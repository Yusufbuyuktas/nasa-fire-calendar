
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent

RAW_DIR = BASE_DIR / "data" / "raw"
OUTPUT_DIR = BASE_DIR / "data" / "processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

COLUMNS = [
    "latitude",
    "longitude",
    "acq_date",
    "frp"
]

def detect_sensor(file):
    name = file.name.upper()

    if "M-C61" in name:
        return "MODIS"
    elif "SV-C2" in name:
        return "VIIRS_SNPP"
    elif "J1V-C2" in name:
        return "VIIRS_NOAA20"
    elif "J2V-C2" in name:
        return "VIIRS_NOAA21"

    return None


def clean_file(file):
    sensor = detect_sensor(file)

    if sensor is None:
        print("Bilinmeyen sensör:", file.name)
        return

    print("İşleniyor:", file.name)

    chunks = pd.read_csv(
        file,
        chunksize=100_000,
        low_memory=False
    )

    output_file = OUTPUT_DIR / f"{file.stem}_clean.csv"
    first_chunk = True
    total = 0

    for chunk in chunks:

        # Gerekli sütunları kontrol et
        missing = [c for c in COLUMNS if c not in chunk.columns]

        if missing:
            raise ValueError(
                f"{file.name} eksik sütunlar: {missing}"
            )

        df = chunk[COLUMNS].copy()

        # Sayısal alanları dönüştür
        for col in ["latitude", "longitude", "frp"]:
            df[col] = pd.to_numeric(
                df[col],
                errors="coerce"
            )

        # Tarihleri dönüştür
        df["date"] = pd.to_datetime(
            df["acq_date"],
            errors="coerce"
        )

        # Geçersiz koordinat ve tarihleri sil
        df = df.dropna(
            subset=["latitude", "longitude", "date"]
        )

        df = df[
            df["latitude"].between(-90, 90)
            & df["longitude"].between(-180, 180)
        ].copy()

        # Sensör bilgisini ekle
        df["sensor"] = sensor

        # Tarih sütununu düzenle
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")

        # Çıktı sütunları
        df = df[
            ["latitude", "longitude", "date", "sensor", "frp"]
        ]

        # CSV dosyasına yaz
        df.to_csv(
            output_file,
            mode="w" if first_chunk else "a",
            header=first_chunk,
            index=False
        )

        first_chunk = False
        total += len(df)

    print(f"Tamamlandı: {total} kayıt")


def main():
    files = sorted(RAW_DIR.rglob("*.csv"))

    if not files:
        print("CSV dosyası bulunamadı!")
        return

    for file in files:
        clean_file(file)

    print("\nBütün dosyalar işlendi.")


if __name__ == "__main__":
    main()
