export interface StoryCase {
  id: string;
  title: string;
  periodLabel: string;
  year: number;
  month: number;
  lat: number;
  lon: number;
  summary: string;
}

export const storyCases = [
  {
    id: '63_104',
    title: 'Akdeniz & Muğla Yangınları',
    lat: 37,
    lon: 29,
    summary: 'Ağustos 2021 döneminde eşi görülmemiş sıcaklık dalgasıyla tetiklenen mega yangınlar.',
    year: 2021,
    month: 8,
    periodLabel: 'Ağu 2021'
  },
  {
    id: '41_58',
    title: 'Amazon Orman Yangınları',
    lat: -7,
    lon: -63,
    summary: 'Eylül 2023 döneminde kuraklık ve arazi açma faaliyetleri kaynaklı yoğun aktivite.',
    year: 2023,
    month: 9,
    periodLabel: 'Eyl 2023'
  },
  {
    id: '27_164',
    title: 'Güneydoğu Avustralya (Kara Yaz)',
    lat: -35,
    lon: 149,
    summary: 'Ocak 2020 döneminde gerçekleşen tarihi yangın sezonu.',
    year: 2020,
    month: 1,
    periodLabel: 'Oca 2020'
  }
];