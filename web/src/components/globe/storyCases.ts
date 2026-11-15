export interface StoryCase {
  id: string;
  title: string;
  lat: number;
  lon: number;
  summary: string;
  year: number;
  month: number;
  periodLabel: string;
}

export const storyCases: StoryCase[] = [
  {
    id: '63_104',
    title: 'Mediterranean & Mugla Fires',
    lat: 37,
    lon: 29,
    summary: 'Mega fires triggered by an unprecedented heatwave in August 2021.',
    year: 2021,
    month: 8,
    periodLabel: 'Aug 2021'
  },
  {
    id: '41_58',
    title: 'Amazon Rainforest Fires',
    lat: -7,
    lon: -63,
    summary: 'Intense activity driven by drought and land clearing in September 2023.',
    year: 2023,
    month: 9,
    periodLabel: 'Sep 2023'
  },
  {
    id: '27_164',
    title: 'SE Australia (Black Summer)',
    lat: -35,
    lon: 149,
    summary: 'Historic fire season that took place in January 2020.',
    year: 2020,
    month: 1,
    periodLabel: 'Jan 2020'
  }
];