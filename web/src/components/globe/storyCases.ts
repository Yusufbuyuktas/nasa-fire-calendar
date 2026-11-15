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
    title: 'Akdeniz & Muğla Yangınları',
    lat: 37,
    lon: 29,
    summary: 'Ağustos 2021 döneminde eşi görülmemiş sıcaklık dalgasıyla tetiklenen mega yangınlar.',
    year: 2021,
    month: 8,
    periodLabel: 'Ağu 2021',
  },
  {
    id: 'california-2020',
    coverageStatus: 'outside_download_bounds',
    title: 'Kaliforniya',
    periodLabel: 'Eyl 2020',
    year: 2020,
    month: 9,
    lat: 39,
    lon: -121,
    summary: 'Batı ABD’de mega yangın sezonunun zirvesi.',
  },
  {
    id: '41_58',
    title: 'Amazon Orman Yangınları',
    lat: -7,
    lon: -63,
    summary: 'Eylül 2023 döneminde kuraklık ve arazi açma faaliyetleri kaynaklı yoğun aktivite.',
    year: 2023,
    month: 9,
    periodLabel: 'Eyl 2023',
  },
  {
    id: '27_164',
    title: 'Güneydoğu Avustralya (Kara Yaz)',
    lat: -35,
    lon: 149,
    summary: 'Ocak 2020 döneminde gerçekleşen tarihi yangın sezonu.',
    year: 2020,
    month: 1,
    periodLabel: 'Oca 2020',
  },
  {
    id: 'canada-2023',
    coverageStatus: 'outside_download_bounds',
    title: 'Kanada Boreal',
    periodLabel: 'Haz 2023',
    year: 2023,
    month: 6,
    lat: 53,
    lon: -105,
    summary: 'Kuzey enlemlerde mevsim normallerinden erken başlayan ve kıta ölçeğinde yayılan yangın dalgası.',
  },
];
