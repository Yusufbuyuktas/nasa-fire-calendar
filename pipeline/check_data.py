
from pathlib import Path
import pandas as pd

# Projenin ana klasörünü bul
BASE_DIR = Path(__file__).resolve().parent.parent

# NASA verilerinin bulunduğu klasör
DATA_DIR = BASE_DIR / "data" / "raw"

# Bütün CSV dosyalarını bul
csv_files = list(DATA_DIR.rglob("*.csv"))

if not csv_files:
    print("HATA: CSV dosyası bulunamadı!")

for file in csv_files:
    print("\n" + "=" * 50)
    print("DOSYA:", file.name)

    # İlk 1000 satırı oku
    df = pd.read_csv(file, nrows=1000)

    print("\nSütun isimleri:")
    print(df.columns.tolist())

    print("\nİlk 5 satır:")
    print(df.head())

    print("\nVeri tipleri:")
    print(df.dtypes)

    print("\nEksik değerler:")
    print(df.isnull().sum())
