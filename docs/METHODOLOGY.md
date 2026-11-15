# Methodology: Harmonized MODIS–VIIRS Fire Activity Calendar

## 1. Project Overview

This project develops a historical fire activity calendar using active fire hotspot detections from NASA FIRMS.

The objective is to provide a consistent analytical view of detected burning activity across multiple satellite sensors, while highlighting temporal patterns, anomalies, and limitations in data coverage.

The resulting activity index represents a calibrated measure of hotspot detections. It does not directly represent burned area, fire severity, or the number of individual fire incidents.

## 2. Data Sources

The processing pipeline incorporates the following satellite products:

- **MODIS Collection 6.1:** Terra and Aqua active fire detections.
- **VIIRS NOAA-20:** 375 m active fire detections.
- **VIIRS NOAA-21:** 375 m active fire detections.

Both archive and near-real-time (NRT) records are processed.

The available MODIS data begins in 2000, NOAA-20 in 2018, and NOAA-21 in 2023. Their temporal coverage is not identical.

### Geographic Coverage

The processed dataset has the following observed coordinate bounds:

| Coordinate | Minimum | Maximum |
|---|---:|---:|
| Latitude | −57.79982 | 38.90000 |
| Longitude | −120.60001 | 179.99673 |

These bounds describe the observed dataset and must not be interpreted as complete global coverage.

## 3. Monthly Spatial Aggregation

Individual hotspot detections are aggregated by:

- Spatial grid identifier
- Year
- Month
- Satellite sensor

For each grid-month-sensor combination, the pipeline calculates the number of detected hotspots.

This produces `monthly_activity.csv`, which is used as the input to the harmonization process.

The spatial grid identifier is preserved across processing stages to support consistent geographic comparisons.

## 4. Sensor Harmonization

MODIS and VIIRS have different detection characteristics and spatial resolutions. Their raw hotspot counts are therefore not assumed to be directly interchangeable.

### 4.1 Calibration Periods

Monthly calibration factors are estimated using overlapping observations:

| Sensor | Calibration years |
|---|---|
| VIIRS NOAA-20 | 2018–2025 |
| VIIRS NOAA-21 | 2023–2025 |

Only grid-month observations containing positive hotspot counts from both MODIS and the corresponding VIIRS sensor are used to calculate calibration factors.

### 4.2 Calibration Formula

For each calendar month and VIIRS sensor:

\[
F_{m,s} =
\frac{\sum_{i \in P_{m,s}} V_{i,s}}
{\sum_{i \in P_{m,s}} M_i}
\]

Where:

- \(F_{m,s}\) is the calibration factor for calendar month \(m\) and VIIRS sensor \(s\).
- \(P_{m,s}\) is the set of matched positive grid-month observations.
- \(V_{i,s}\) is the VIIRS hotspot count.
- \(M_i\) is the corresponding MODIS hotspot count.

Adjusted VIIRS activity is calculated as:

\[
V_{\text{adjusted}} = \frac{V_{\text{raw}}}{F_{m,s}}
\]

This calibration targets aggregate count comparability within matched observations. It does not guarantee equal medians, identical distributions, or equivalent detection probabilities.

### 4.3 Sensor Selection

For each grid-month, the harmonization pipeline selects activity in the following order:

1. MODIS, when available.
2. Calibrated VIIRS NOAA-20, when MODIS is unavailable.
3. Calibrated VIIRS NOAA-21, when neither preceding source is available.

The selected sensor is recorded in the `source` field.

The harmonized output is stored in `harmonized_activity.csv`.

## 5. Missing-Month Handling

The source FIRMS records contain positive hotspot detections, but do not independently establish whether every grid-month was successfully observed.

For continuity analysis, the pipeline generates `harmonized_activity_filled.csv`.

Within each grid's first and last detected hotspot months, missing monthly records are inserted with:

- `activity_index = 0`
- `source = NO_DETECTION`

**These zeros are processing assumptions, not independently verified observations of zero fire activity.**

A missing hotspot record could also result from satellite coverage limitations, observation conditions, or other data availability constraints.

Therefore, imputed zeros must not be treated as confirmed absence of burning.

The filled dataset contains:

| Record category | Count |
|---|---:|
| Original harmonized records | 566,355 |
| Imputed `NO_DETECTION` records | 256,373 |
| Total filled records | 822,728 |

## 6. Anomaly Detection

The anomaly analysis uses a Leave-One-Year-Out (LOYO) reference strategy.

Each grid and calendar month is evaluated against available observations from other years for the same grid and calendar month.

### 6.1 Log Transformation

To reduce the influence of highly skewed hotspot counts, the pipeline applies:

\[
x = \ln(1 + \text{activity_index})
\]

### 6.2 LOYO Reference

For a target observation, the reference distribution excludes the target year
### 6.6 Anomaly Classification

Anomaly levels are assigned according to the calculated LOYO Z-score.

| Z-score condition | Classification |
|---|---|
| \(z \geq 2\) | `VERY_HIGH` |
| \(1 \leq z < 2\) | `HIGH` |
| \(-1 < z < 1\) | `NORMAL` |
| \(-2 < z \leq -1\) | `LOW` |
| \(z \leq -2\) | `VERY_LOW` |
| Insufficient reference observations | `INSUFFICIENT_DATA` |
| Imputed zero without verified observation | `UNVERIFIED_ZERO` |

These categories describe statistical deviations from the available positive-detection reference distribution. They do not directly classify wildfire severity or emergency risk.

### 6.7 Historical Sample Confidence

The pipeline assigns a confidence label based on the number of reference observations available after excluding the target year.

| Historical reference observations | Confidence label |
|---|---|
| Fewer than 3 | `INSUFFICIENT` |
| 3–9 | `LOW` |
| 10–19 | `MEDIUM` |
| 20 or more | `HIGH` |
| Imputed `NO_DETECTION` record | `UNVERIFIED` |

These labels represent historical sample availability, not statistically calibrated prediction confidence.

### 6.8 Retrospective Interpretation

The Leave-One-Year-Out method excludes the target year but can use observations from both earlier and later years.

Therefore, the calculated anomaly scores are retrospective historical comparisons rather than strictly forward-looking predictions.

Operational real-time anomaly detection would require a separate historical reference strategy that uses only information available before the evaluation date.