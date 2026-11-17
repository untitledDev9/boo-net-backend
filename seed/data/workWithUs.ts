export interface Door {
  title: string;
  text: string;
  cta: string;
}

export interface DoorGroup {
  name: string;
  doors: Door[];
}

export const DOOR_GROUPS: DoorGroup[] = [
  {
    name: 'DO BUSINESS',
    doors: [
      { title: 'MEDIA & PRESS', text: 'Interviews, coverage, press & appearances.', cta: 'MEDIA REQUEST' },
      { title: 'ADVERTISE WITH US', text: 'Put your brand across the whole Network.', cta: 'ADVERTISE WITH BOOSIE' },
      { title: 'SPONSORSHIPS', text: 'Major sponsorship opportunities across the empire.', cta: 'BECOME A SPONSOR' },
      { title: 'BRAND PARTNERSHIPS', text: 'Build something deeper than an ad.', cta: 'BUILD SOMETHING TOGETHER' },
      { title: 'CONTENT LICENSING', text: 'License the music, film & archive.', cta: 'REQUEST LICENSING' },
      { title: 'STRATEGIC BUSINESS', text: 'Major distribution, tech & joint-venture opportunities.', cta: 'STRATEGIC INQUIRY' },
    ],
  },
  {
    name: 'BOOK / CREATE',
    doors: [
      { title: 'BOOK BOOSIE / APPEARANCES', text: 'Legitimate booking inquiries only.', cta: 'SUBMIT BOOKING INQUIRY' },
      { title: 'EVENTS / PROMOTERS / VENUES', text: 'Bring the Network to your city.', cta: 'BRING BOOSIE NETWORK TO YOUR CITY' },
      { title: 'FILM / TV / PRODUCTION', text: 'Pitches, production & co-production.', cta: 'FILM & PRODUCTION' },
      { title: 'MUSIC BUSINESS', text: 'Producers, writers, labels, supervisors & DJs.', cta: 'MUSIC BUSINESS' },
    ],
  },
  {
    name: 'JOIN THE MOVEMENT',
    doors: [
      { title: 'ARTISTS', text: 'An actual artist ecosystem — not an email.', cta: 'JOIN AS AN ARTIST' },
      { title: 'TALENT / AUDITIONS', text: 'Talent-show applications & casting.', cta: 'AUDITIONS & TALENT' },
      { title: 'CREATIVE PROFESSIONALS', text: 'Show us what you do.', cta: 'SHOW US WHAT YOU DO' },
      { title: 'VENDORS & SERVICE PROVIDERS', text: 'Help the empire run.', cta: 'BECOME A VENDOR' },
      { title: 'JOIN THE CREW', text: 'Work with the organization.', cta: 'INTRODUCE YOURSELF' },
      { title: 'HEARTFELT / COMMUNITY', text: 'Partner on community impact.', cta: 'MAKE AN IMPACT WITH US' },
    ],
  },
  {
    name: 'GENERAL INQUIRY',
    doors: [{ title: 'GENERAL INQUIRY', text: "Last stop — if it doesn't fit anywhere else.", cta: 'GENERAL INQUIRY' }],
  },
];

export const LANES = [
  { title: 'DO BUSINESS', text: 'Advertising • Sponsorships • Partnerships • Licensing' },
  { title: 'BOOK / CREATE', text: 'Bookings • Events • Film • Production • Music' },
  { title: 'JOIN THE MOVEMENT', text: 'Artists • Talent • Careers • Vendors • Community' },
] as const;
