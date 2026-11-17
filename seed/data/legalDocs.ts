export interface LegalDoc { slug: string; title: string; category: string }

export const LEGAL_CATEGORIES = ['Core', 'Creators', 'Community & IP', 'Commerce & Events', 'Business'] as const;

export const LEGAL_DOCS: LegalDoc[] = [
  { slug: 'terms-of-service', title: 'Terms of Service', category: 'Core' },
  { slug: 'privacy-policy', title: 'Privacy Policy', category: 'Core' },
  { slug: 'membership-subscription-terms', title: 'Membership & Subscription Terms', category: 'Core' },
  { slug: 'cookie-tracking-notice', title: 'Cookie & Tracking Notice', category: 'Core' },
  { slug: 'acceptable-use-policy', title: 'Acceptable Use Policy', category: 'Core' },
  { slug: 'accessibility-statement', title: 'Accessibility Statement', category: 'Core' },
  { slug: 'user-migration-reconsent-notice', title: 'User Migration & Re-Consent Notice', category: 'Core' },
  { slug: 'artist-risk-indemnification', title: 'Artist Risk Acknowledgment & Indemnification', category: 'Creators' },
  { slug: 'artist-creator-agreement', title: 'Artist & Creator Agreement', category: 'Creators' },
  { slug: 'payout-revenue-share-policy', title: 'Creator Payout & Revenue Share', category: 'Creators' },
  { slug: 'livestreaming-policy', title: 'Livestreaming Policy', category: 'Creators' },
  { slug: 'content-rights-warranty', title: 'Content Rights Warranty & Ownership', category: 'Creators' },
  { slug: 'audition-talent-release', title: 'Audition & Talent Release', category: 'Creators' },
  { slug: 'community-guidelines', title: 'Community Guidelines', category: 'Community & IP' },
  { slug: 'copyright-dmca-policy', title: 'Copyright & DMCA Policy', category: 'Community & IP' },
  { slug: 'editorial-standards-corrections-policy', title: 'Editorial Standards & Corrections', category: 'Community & IP' },
  { slug: 'refund-return-cancellation-policy', title: 'Refund, Return & Cancellation', category: 'Commerce & Events' },
  { slug: 'commerce-shipping-policy', title: 'Commerce, Shipping & Fulfillment', category: 'Commerce & Events' },
  { slug: 'event-ticket-terms', title: 'Event & Ticket Terms', category: 'Commerce & Events' },
  { slug: 'advertising-sponsorship-terms', title: 'Advertising & Sponsorship Terms', category: 'Business' },
  { slug: 'work-with-us-submission-terms', title: 'Work With Us Submission Terms', category: 'Business' },
  { slug: 'ai-features-policy', title: 'AI Features Policy', category: 'Business' },
];
