export interface StoryCase {
  id: string;
  title: string;
  periodLabel: string;
  year: number;
  month: number;
  lat: number;
  lon: number;
  summary: string;
  coverageStatus?: 'outside_download_bounds';
}

export const storyCases: StoryCase[] = [
  {
    id: '63_104',
    title: 'Mediterranean & Muğla Wildfires',
    periodLabel: 'Aug 2021',
    year: 2021,
    month: 8,
    lat: 37,
    lon: 29,
    summary:
      'Severe heatwave-driven wildfires across southwestern Türkiye and the eastern Mediterranean basin.',
  },
  {
    id: '41_58',
    title: 'Amazon Basin Drought Fires',
    periodLabel: 'Sep 2023',
    year: 2023,
    month: 9,
    lat: -7,
    lon: -63,
    summary:
      'Elevated hotspot activity across central Amazonas driven by severe drought and land-use pressure.',
  },
  {
    id: '27_164',
    title: 'Southeast Australia (Black Summer)',
    periodLabel: 'Jan 2020',
    year: 2020,
    month: 1,
    lat: -35,
    lon: 149,
    summary:
      'Peak of the historic 2019–2020 Australian bushfire season across New South Wales.',
  },
  {
    id: '43_146',
    title: 'Borneo & Kalimantan Peatland Fires',
    periodLabel: 'Oct 2015',
    year: 2015,
    month: 10,
    lat: -3,
    lon: 113,
    summary:
      'El Niño-intensified tropical peatland burning across Central Kalimantan, Indonesia.',
  },
  {
    id: '27_54',
    title: 'Central Chile Megafires',
    periodLabel: 'Jan 2017',
    year: 2017,
    month: 1,
    lat: -35,
    lon: -71,
    summary:
      'Extreme austral summer fire outbreaks across Chile’s Maule and Biobío regions.',
  },
];