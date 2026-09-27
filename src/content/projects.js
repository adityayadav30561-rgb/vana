// Every project on the site lives here. The Work showcase on the home page is
// rendered from this file at build time (see vite.config.js), so adding a
// project means adding an entry below. Screenshots go in assets/work/ as WebP.
//
// Project fields
//   id        short slug, unique
//   category  one of the CATEGORIES ids
//   name      client or product name
//   meta      small line above the name, e.g. 'SEO · Health · 2026'
//   site      live URL (optional)
//   accent    colour for the growth line, badge and window dot
//   summary   two or three sentences
//   headline  the story in one line, for the project's page; wrap a word or
//             two in *asterisks* to set them in gold italic
//   badge     { value, label }: the one number the project is remembered by
//             (it leads the card, e.g. '+7,245%' / 'more active users')
//   light     backdrop for the project's page: 'morning', 'noon' or 'golden'
//   stats     up to three { label, value, suffix, decimals } (these count up)
//   highlights  optional, for the project's own page: groups of figures,
//             each { source, period, items: [{ label, value, change }] }.
//             Figures with a change also get a before/after bar (the earlier
//             value is worked out from the % change)
//   challenge optional: where the client was when we met (a paragraph)
//   approach  optional: what we did (a paragraph, or a list of short points)
//             Both chapters stay hidden until they're written
//   shots     screenshots in viewing order; the first two are framed on the
//             card (shots[0] in front, shots[1] behind), and all of them open
//             in the lightbox. { file, w, h, label, alt }

// Set url to the live domain (e.g. 'https://vana.studio') once it's known:
// project pages then get canonical links, absolute share images and
// breadcrumb data for Google.
export const SITE = {
  name: 'Vana',
  url: '',
  email: 'hello@vana.studio',
};

export const CATEGORIES = [
  {
    id: 'seo',
    label: 'SEO',
    caseLabel: 'SEO case study',
    empty: null,
  },
  {
    id: 'websites',
    label: 'Websites',
    caseLabel: 'Website case study',
    empty: {
      title: 'Website case studies are on their way.',
      text: 'We’re writing up recent builds: stores, service sites and brand sites that load fast and rank from launch. Until they’re here, we’d be glad to walk you through them on a call.',
    },
  },
  {
    id: 'apps',
    label: 'Apps',
    caseLabel: 'App case study',
    empty: {
      title: 'Android & iOS case studies are on their way.',
      text: 'We’re preparing write-ups of the apps we’ve shipped for Android and iOS. Until they’re here, we’d be glad to show them to you on a call.',
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    caseLabel: 'Custom software case study',
    empty: {
      title: 'Custom software case studies are on their way.',
      text: 'Dashboards, integrations and bespoke tools are hard to show in public. Ask us, and we’ll walk you through the ones we can share.',
    },
  },
];

export const PROJECTS = [
  {
    id: 'badowl',
    category: 'seo',
    name: 'Badowl',
    meta: 'SEO · Accessories · 2026',
    site: 'https://badowl.in/',
    accent: '#f0c46e',
    summary: 'Our biggest turnaround so far. In eight months an accessories brand went from barely found to 311K active users, 1.6M page views and 6.2K purchases, with an average search position of 7.5.',
    headline: 'From barely found to *311K* active users.',
    badge: { value: '+7,245%', label: 'more active users' },
    light: 'golden',
    challenge: '',
    approach: '',
    stats: [
      { label: 'Active users', value: 311, suffix: 'K' },
      { label: 'Purchases', value: 6.2, suffix: 'K', decimals: 1 },
      { label: 'Page views', value: 1.6, suffix: 'M', decimals: 1 },
    ],
    highlights: [
      {
        source: 'Google Analytics',
        period: 'Feb 1 – Sep 25, 2026, against the previous period',
        items: [
          { label: 'Active users', value: '311K', change: '+7,245.2%' },
          { label: 'Events', value: '3.5M', change: '+14,023.9%' },
          { label: 'Page views', value: '1.6M', change: '+17,064.1%' },
          { label: 'Purchases', value: '6.2K', change: '+6,537.2%' },
        ],
      },
      {
        source: 'Google Search Console',
        period: 'Last 6 months',
        items: [
          { label: 'Clicks', value: '5.33K' },
          { label: 'Impressions', value: '61.3K' },
          { label: 'Average CTR', value: '8.7%' },
          { label: 'Average position', value: '7.5' },
        ],
      },
      {
        source: 'AI features in Google Search',
        period: 'Last 6 months',
        items: [
          { label: 'Impressions in AI Overviews and AI Mode', value: '3.64K' },
        ],
      },
    ],
    shots: [
      { file: 'badowl-ga4', w: 1500, h: 628, label: 'Google Analytics · Feb 1 – Sep 25, 2026', alt: 'Google Analytics for Badowl: 311K active users (up 7,245.2%), 3.5M events (up 14,023.9%), 1.6M views (up 17,064.1%) and 6.2K purchases (up 6,537.2%), February 1 to September 25, 2026' },
      { file: 'badowl-gsc', w: 1497, h: 870, label: 'Search Console · last 6 months', alt: 'Google Search Console for badowl.in over six months: 5.33K clicks, 61.3K impressions, 8.7% average CTR, average position 7.5' },
      { file: 'badowl-ai', w: 1480, h: 732, label: 'Search Console · AI features · 6 months', alt: 'Google Search Console generative AI features report for badowl.in: 3.64K impressions over six months' },
    ],
  },
  {
    id: 'khadi-organique',
    category: 'seo',
    name: 'Khadi Organique',
    meta: 'SEO · Clean beauty · 2026',
    site: 'https://khadiorganique.com/',
    accent: '#9fc26a',
    summary: 'More than a million search impressions in six months for a clean-beauty label. Key events on the site grew almost a hundred-fold, and the brand now shows up in Google’s AI answers too.',
    headline: 'Over a *million* search impressions in six months.',
    badge: { value: '+9,517%', label: 'more key events' },
    light: 'noon',
    challenge: '',
    approach: '',
    stats: [
      { label: 'Search impressions', value: 1.19, suffix: 'M', decimals: 2 },
      { label: 'Clicks', value: 10.3, suffix: 'K', decimals: 1 },
      { label: 'AI search impressions', value: 59.4, suffix: 'K', decimals: 1 },
    ],
    highlights: [
      {
        source: 'Google Analytics',
        period: 'Mar 1 – Jul 31, 2026, against the previous period',
        items: [
          { label: 'Engagement rate', value: '73.5%', change: '+182.3%' },
          { label: 'Events', value: '284K', change: '+4.2%' },
          { label: 'Key events', value: '63K', change: '+9,517.3%' },
          { label: 'Page views', value: '116K', change: '+46.4%' },
        ],
      },
      {
        source: 'Google Search Console',
        period: 'Last 6 months',
        items: [
          { label: 'Clicks', value: '10.3K' },
          { label: 'Impressions', value: '1.19M' },
          { label: 'Average CTR', value: '0.9%' },
          { label: 'Average position', value: '9.5' },
        ],
      },
      {
        source: 'AI features in Google Search',
        period: 'Last 6 months',
        items: [
          { label: 'Impressions in AI Overviews and AI Mode', value: '59.4K' },
        ],
      },
    ],
    shots: [
      { file: 'khadi-ga4', w: 1500, h: 655, label: 'Google Analytics · Mar 1 – Jul 31, 2026', alt: 'Google Analytics for Khadi Organique: 73.5% engagement rate (up 182.3%), 284K events, 63K key events (up 9,517.3%) and 116K views, March 1 to July 31, 2026' },
      { file: 'khadi-gsc', w: 1477, h: 878, label: 'Search Console · last 6 months', alt: 'Google Search Console for khadiorganique.com over six months: 10.3K clicks, 1.19M impressions, 0.9% average CTR, average position 9.5' },
      { file: 'khadi-ai', w: 1486, h: 722, label: 'Search Console · AI features · 6 months', alt: 'Google Search Console generative AI features report for khadiorganique.com: 59.4K impressions over six months' },
    ],
  },
  {
    id: 'kama-health-india',
    category: 'seo',
    name: 'Kama Health India',
    meta: 'SEO · Health · 2026',
    site: 'https://kamahealthindia.com/',
    accent: '#e2b35f',
    summary: 'Organic search turned a trickle into a steady stream for this health brand. Active users grew almost sixteen-fold on the previous period, and its pages now rank on Google’s first page on average.',
    headline: 'Nearly *sixteen times* the visitors.',
    badge: { value: '+1,484%', label: 'more active users' },
    light: 'morning',
    challenge: '',
    approach: '',
    stats: [
      { label: 'Sessions', value: 115, suffix: 'K' },
      { label: 'Search impressions', value: 66.9, suffix: 'K', decimals: 1 },
      { label: 'Avg. position', value: 7.8, decimals: 1 },
    ],
    highlights: [
      {
        source: 'Google Analytics',
        period: 'Mar 1 – Sep 25, 2026, against the previous period',
        items: [
          { label: 'Active users', value: '104K', change: '+1,483.8%' },
          { label: 'Events', value: '828K', change: '+1,796.0%' },
          { label: 'Engaged sessions', value: '50K', change: '+1,983.3%' },
          { label: 'Sessions', value: '115K', change: '+1,356.0%' },
        ],
      },
      {
        source: 'Google Search Console',
        period: 'Last 6 months',
        items: [
          { label: 'Clicks', value: '3.87K' },
          { label: 'Impressions', value: '66.9K' },
          { label: 'Average CTR', value: '5.8%' },
          { label: 'Average position', value: '7.8' },
        ],
      },
      {
        source: 'AI features in Google Search',
        period: 'Last 6 months',
        items: [
          { label: 'Impressions in AI Overviews and AI Mode', value: '10.3K' },
        ],
      },
    ],
    shots: [
      { file: 'kama-ga4', w: 1500, h: 671, label: 'Google Analytics · Mar 1 – Sep 25, 2026', alt: 'Google Analytics for Kama Health India: 104K active users (up 1,483.8%), 828K events, 50K engaged sessions and 115K sessions, March 1 to September 25, 2026' },
      { file: 'kama-gsc', w: 1500, h: 782, label: 'Search Console · last 6 months', alt: 'Google Search Console for kamahealthindia.com over six months: 3.87K clicks, 66.9K impressions, 5.8% average CTR, average position 7.8' },
      { file: 'kama-ai', w: 1500, h: 663, label: 'Search Console · AI features · 6 months', alt: 'Google Search Console generative AI features report for kamahealthindia.com: 10.3K impressions over six months' },
    ],
  },
  {
    id: '7-seas-matrix',
    category: 'seo',
    name: '7 Seas Matrix',
    meta: 'SEO · Organic growth · 2026',
    site: 'https://www.7seasmatrix.com/',
    accent: '#7fc7d9',
    summary: 'Patient, compounding growth: more than five times the visitors of the previous period, and 161K impressions across Google Search in a year.',
    headline: 'More than *five times* the visitors.',
    badge: { value: '+418%', label: 'more active users' },
    light: 'golden',
    challenge: '',
    approach: '',
    stats: [
      { label: 'Sessions', value: 7, suffix: 'K' },
      { label: 'Search impressions', value: 161, suffix: 'K' },
      { label: 'AI search impressions', value: 7.37, suffix: 'K', decimals: 2 },
    ],
    highlights: [
      {
        source: 'Google Analytics',
        period: 'Jan 1 – Sep 25, 2026, against the previous period',
        items: [
          { label: 'Sessions', value: '7K', change: '+292.4%' },
          { label: 'New users', value: '5.8K', change: '+413.6%' },
          { label: 'First visits', value: '5.8K', change: '+413.6%' },
          { label: 'Active users', value: '5.6K', change: '+417.9%' },
        ],
      },
      {
        source: 'Google Search Console',
        period: 'Last 12 months',
        items: [
          { label: 'Clicks', value: '2.38K' },
          { label: 'Impressions', value: '161K' },
          { label: 'Average CTR', value: '1.5%' },
          { label: 'Average position', value: '19.2' },
        ],
      },
      {
        source: 'AI features in Google Search',
        period: 'Last 12 months',
        items: [
          { label: 'Impressions in AI Overviews and AI Mode', value: '7.37K' },
        ],
      },
    ],
    shots: [
      { file: '7seas-ga4', w: 1500, h: 669, label: 'Google Analytics · Jan 1 – Sep 25, 2026', alt: 'Google Analytics for 7 Seas Matrix: 7K sessions (up 292.4%), 5.8K new users (up 413.6%), 5.8K first visits and 5.6K active users (up 417.9%), January 1 to September 25, 2026' },
      { file: '7seas-gsc', w: 1496, h: 867, label: 'Search Console · last 12 months', alt: 'Google Search Console for 7seasmatrix.com over twelve months: 2.38K clicks, 161K impressions, 1.5% average CTR, average position 19.2' },
      { file: '7seas-ai', w: 1491, h: 730, label: 'Search Console · AI features · 12 months', alt: 'Google Search Console generative AI features report for 7seasmatrix.com: 7.37K impressions' },
    ],
  },
  {
    id: 'fresh-light-photography',
    category: 'seo',
    name: 'Fresh Light Photography',
    meta: 'SEO · Photography · 2025–26',
    site: 'https://fresh-light-photography.com/',
    accent: '#e6a36a',
    summary: 'Half a million impressions in a year for a photography studio, and a presence in Google’s AI answers that has more than doubled since spring.',
    headline: '*Half a million* impressions in a year.',
    badge: { value: '503K', label: 'search impressions in a year' },
    light: 'noon',
    challenge: '',
    approach: '',
    stats: [
      { label: 'Clicks', value: 1.76, suffix: 'K', decimals: 2 },
      { label: 'AI search impressions', value: 19.3, suffix: 'K', decimals: 1 },
      { label: 'Avg. position', value: 14.3, decimals: 1 },
    ],
    highlights: [
      {
        source: 'Google Search Console',
        period: 'Last 12 months',
        items: [
          { label: 'Clicks', value: '1.76K' },
          { label: 'Impressions', value: '503K' },
          { label: 'Average CTR', value: '0.3%' },
          { label: 'Average position', value: '14.3' },
        ],
      },
      {
        source: 'AI features in Google Search',
        period: 'Last 12 months',
        items: [
          { label: 'Impressions in AI Overviews and AI Mode', value: '19.3K' },
        ],
      },
    ],
    shots: [
      { file: 'freshlight-ai', w: 1500, h: 658, label: 'Search Console · AI features · 12 months', alt: 'Google Search Console generative AI features report for fresh-light-photography.com: 19.3K impressions, rising from about 80 to about 200 a day' },
      { file: 'freshlight-gsc', w: 1500, h: 787, label: 'Search Console · last 12 months', alt: 'Google Search Console for fresh-light-photography.com over twelve months: 1.76K clicks, 503K impressions, 0.3% average CTR, average position 14.3' },
    ],
  },
];
