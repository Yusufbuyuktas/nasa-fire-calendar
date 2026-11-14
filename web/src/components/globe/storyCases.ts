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

export const STORY_CASES: StoryCase[] = [
  {
    id: 'mediterranean-2021',
    title: 'Akdeniz & Muğla',
    periodLabel: 'Ağu 2021',
    year: 2021,
    month: 8,
    lat: 37,
    lon: 29,
    summary: 'Doğu Akdeniz’de aşırı sıcak hava dalgası ile tarihsel ortalamaların çok üzerine çıkan yaz anomalisi.',
  },
  {
    id: 'california-2020',
    title: 'Kaliforniya',
    periodLabel: 'Eyl 2020',
    year: 2020,
    month: 9,
    lat: 39,
    lon: -121,
    summary: 'Batı ABD’de mega yangın sezonunun zirvesi; ekstrem pozitif z-skoru ve yüksek hotspot yoğunluğu.',
  },
  {
    id: 'amazon-2023',
    title: 'Amazon Havzası',
    periodLabel: 'Eyl 2023',
    year: 2023,
    month: 9,
    lat: -9,
    lon: -63,
    summary: 'Şiddetli kuraklık ve El Niño koşulları altında tropikal kuşakta yoğunlaşan aktivite artışı.',
  },
  {
    id: 'australia-2020',
    title: 'GD Avustralya',
    periodLabel: 'Oca 2020',
    year: 2020,
    month: 1,
    lat: -35,
    lon: 149,
    summary: '“Kara Yaz” (Black Summer) yangınlarının güneydoğu kıyı şeridinde tepe noktasına ulaştığı dönem.',
  },
  {
    id: 'canada-2023',
    title: 'Kanada Boreal',
    periodLabel: 'Haz 2023',
    year: 2023,
    month: 6,
    lat: 53,
    lon: -105,
    summary: 'Kuzey enlemlerde mevsim normallerinden erken başlayan ve kıta ölçeğinde yayılan yangın dalgası.',
  },
];