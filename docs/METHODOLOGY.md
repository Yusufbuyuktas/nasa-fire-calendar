# Scientific Methodology

## Harmonization of MODIS and VIIRS Active Fire Hotspots

### 1. Project Overview

This project develops a web-based fire activity calendar using harmonized MODIS and VIIRS active fire hotspot observations.

The goal is to support the exploration of historical fire activity, seasonal patterns, and unusual conditions across geographic regions.

The resulting activity index represents satellite-detected active fire hotspots, not burned area, fire severity, or the probability of a wildfire.

### 2. Data Sources

The processing pipeline incorporates three satellite sensor records:

| Sensor | Data coverage in this project |
|---|---|
| MODIS | 2000–2026 |
| VIIRS NOAA-20 | 2018–2026 |
| VIIRS NOAA-21 | 2023–2026 |

Approximately **312.9 million hotspot records** were processed.

The records are normalized into a common schema containing geographic coordinates, observation date, sensor identifier, and fire radiative power (FRP) where available.

### 3. Spatial and Temporal Aggregation

Individual hotspot detections are aggregated into:

- A 2° × 2° geographic grid within the available NASA FIRMS download region.
- Monthly observation periods.
- Separate hotspot counts for each sensor.

The aggregation produces approximately 828,000 sensor-specific grid-month records.

Grid coordinates displayed in the application represent grid centers rather than the exact positions of individual fire detections.

### 4. Sensor Harmonization

MODIS and VIIRS have different detection characteristics. Their raw hotspot counts therefore cannot be treated as directly interchangeable.

We estimate sensor-specific monthly calibration factors using grid-month observations where both MODIS and the corresponding VIIRS sensor report positive hotspot counts.

For each calendar month and VIIRS sensor:

**Calibration factor = Sum of VIIRS hotspot counts / Sum of MODIS hotspot counts**

The calibrated VIIRS activity is calculated as:

**Adjusted VIIRS activity = VIIRS hotspot count / Calibration factor**

The harmonized series uses the following source priority:

1. MODIS, when available.
2. Adjusted VIIRS NOAA-20.
3. Adjusted VIIRS NOAA-21.

This produces a MODIS-referenced activity index across the available observation period.

The calibration is based on positive matched observations and does not establish equivalence in detection coverage, burned area, or fire intensity.

### 5. Historical Anomaly Detection

For each geographic grid and calendar month, the anomaly model compares current activity against observations from preceding years.

The historical reference excludes the year being evaluated, preventing the current observation from contributing to its own baseline.

The anomaly score is calculated using:

**Z-score = (Current activity − Historical mean) / Historical standard deviation**

A valid anomaly score requires at least three preceding positive activity observations and a nonzero historical standard deviation.

| Z-score | Classification |
|---|---|
| ≥ 2 | VERY_HIGH |
| ≥ 1 and below 2 | HIGH |
| Above −1 and below 1 | NORMAL |
| ≤ −1 and above −2 | LOW |
| ≤ −2 | VERY_LOW |
| Insufficient historical information | INSUFFICIENT_DATA |

A separate historical sample-size indicator is provided:

| Previous observations | Confidence label |
|---|---|
| Fewer than 3 | INSUFFICIENT |
| 3–9 | LOW |
| 10–19 | MEDIUM |
| 20 or more | HIGH |

These confidence labels indicate the quantity of historical observations, not calibrated statistical confidence or prediction certainty.

### 6. Validation Results

#### 6.1 Anomaly Data Integrity

The processed dataset contains **566,355 grid-month records**.

- 475,547 records have a calculated anomaly score.
- 90,808 records are classified as having insufficient information.
- No invalid dates, invalid history counts, nonfinite anomaly scores, inconsistent anomaly labels, or duplicate grid-month groups were detected by the implemented validation checks.

#### 6.2 Sensor Agreement

An in-sample comparison between calibrated VIIRS observations and MODIS measurements produced:

| Sensor | Matched observations | WAPE |
|---|---:|---:|
| VIIRS NOAA-20 | 154,059 | 25.07% |
| VIIRS NOAA-21 | 56,726 | 24.73% |

These results measure agreement with MODIS on positive matched grid-month observations. They are not independent test-set accuracy estimates.

A separate 2025 holdout evaluation, using calibration information from preceding years, produced approximately **28% WAPE**.

#### 6.3 Sensor Transition Analysis

Two types of sensor transition comparisons were conducted.

**Consecutive-month comparison**

- Same-source mean absolute log change: 0.9219
- Source-switch mean absolute log change: 0.8884

**Same-calendar-month, consecutive-year comparison**

- Same-source mean absolute log change: 0.7789
- Source-switch mean absolute log change: 0.8776

The second comparison shows approximately 12.7% higher mean absolute log change among source-switch observations.

This association does not establish that sensor switching caused the additional variability. Differences in geography, observation availability, and actual fire activity may contribute.

### 7. Scientific Limitations

Several limitations must be considered when interpreting the results.

**Geographic coverage:** The NASA FIRMS source files were downloaded using the bounding box west -120.6°, south -57.8°, east 180°, and north 38.9°. The dataset does not provide global coverage. The bounding box describes the requested download region, not verified complete observation coverage within that region.

**Unobserved regions:** Areas outside the downloaded region cannot be evaluated using this dataset. Missing hotspot records, including those within the downloaded region, must not be interpreted as confirmed zero-fire conditions or complete satellite observations.

**Positive-observation sampling:** Missing hotspot records cannot automatically be interpreted as observed zero-fire conditions.

**Sensor detection differences:** MODIS and VIIRS have different spatial resolutions and detection characteristics. Monthly count calibration does not remove every source of measurement bias.

**Temporal coverage:** The sensors cover different periods. The 2026 observation record is incomplete.

**Spatial resolution:** Aggregation to 2° × 2° cells supports regional exploration within the available data coverage but is too coarse for precise local incident mapping.

**Anomaly interpretation:** Z-scores describe deviations from historical positive recorded activity. They are not wildfire forecasts or emergency alerts by themselves.

**Calibration stability:** Sensor agreement can change over time, and source transitions may introduce additional uncertainty.

### 8. Reproducibility

The processing and validation scripts are maintained in the project's `pipeline/` directory.

Core scripts include:

- `clean.py`
- `aggregate.py`
- `harmonize.py`
- `anomalies_v2.py`
- `export_frontend.py`
- `split_frontend.py`
- `validate_anomalies_v2.py`
- `sensor_overlap_validation.py`
- `sensor_transition_validation.py`
- `sensor_transition_yearly.py`

The frontend uses yearly CSV files containing harmonized activity, anomaly classifications, historical observation counts, and data-confidence labels.

### 9. Conclusion

This project provides a reproducible approach for combining MODIS and VIIRS active fire hotspot observations into a historical fire activity calendar.

The methodology supports exploratory comparisons of seasonal activity and historical anomalies while explicitly communicating uncertainty, incomplete coverage, and limitations of satellite hotspot observations
