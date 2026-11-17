import { img } from '../lib/assets';

export interface Talent {
  slug: string;
  name: string;
  title: string;
  from: number;
  delivery: string;
  featured: boolean;
  available: boolean;
  image: string;
}

export const TALENT: Talent[] = [
  {
    slug: 'boosie',
    name: 'Boosie Badazz',
    title: 'RAPPER / LEGEND',
    from: 649,
    delivery: '7d',
    featured: true,
    available: true,
    image: img('08d4dbae5_boostar.jpeg'),
  },
];
