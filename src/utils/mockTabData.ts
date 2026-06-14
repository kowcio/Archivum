/**
 * Mock tab data extracted from test/mocks/tabs_example.json.
 * Used by the "Mock 10 tabs" button to create realistic tabs with backdated lastAccessed.
 * Each entry provides url, title, and favIconUrl for browser.tabs.create().
 */

export const MOCK_TABS = [
  {
    url: 'https://domeczek.com.pl/pl/p/NAKLEJKI-FOLIA-OCHRONNA-kuchnia-zlew-10-szt/1558',
    title: 'NAKLEJKI FOLIA OCHRONNA kuchnia zlew 10 szt "DOMOWO"',
    favIconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NgAAIAAAUAAR4f7BQAAAAASUVORK5CYII=',
  },
  {
    url: 'https://www.leroymerlin.pl/produkty/naklejka-kuchenna-odporna-na-olej-samoprzylepna-folia-ochronna-na-blaty-domowe-wodoodporna-i-odporna-na-plamy-60-cm-x-10-m-75162203.html',
    title: 'Naklejka kuchenna odporna na olej - folia ochronna - 60 cm x 10 m - Leroy Merlin',
    favIconUrl: '',
  },
  {
    url: 'https://www.castorama.pl/departments/folia-ochronna-wallfluent-80x40-cm-mi-kkie-szk-o-przezroczysta-na-blat-st-pod-og-1-szt-/4070095992289_CAPL.prd',
    title: 'Folia ochronna Wallfluent 80x40 cm - przezroczysta',
    favIconUrl: '',
  },
  {
    url: 'https://www.ceneo.pl/78293725',
    title: 'Aluminiowa folia ochronna do blatów 45mb x 50mm - Opinie na Ceneo.pl',
    favIconUrl: '',
  },
  {
    url: 'https://www.perplexity.ai/search/5d84760f-2c7f-4d57-8d3b-19bb38fad817',
    title: 'Folia ochronna samoprzylepna dookoła zlewu - ochrona przed wodą',
    favIconUrl: '',
  },
  {
    url: 'https://allegro.pl/produkt/naklejka-imitujaca-marmur-bedee-60-x-300cm-1696ddd3-040e-48a9-ada0-e35f67b1b910',
    title: 'Naklejka imitująca marmur Bedee 60 x 300cm - Allegro',
    favIconUrl: '',
  },
  {
    url: 'https://allegro.pl/produkt/naklejka-imitujaca-marmur-40-x-300cm-375be2c3-1168-4352-a697-d67e9e6e96d4',
    title: 'Naklejka imitująca marmur 40 x 300cm - Allegro',
    favIconUrl: '',
  },
  {
    url: 'https://allegro.pl/kategoria/przybory-kuchenne-maty-do-zlewu-322271',
    title: 'Ociekacz do Zlewu - Maty do zlewu kuchennego - Allegro',
    favIconUrl: '',
  },
  {
    url: 'https://9gag.com/',
    title: '9GAG - Best Funny Memes and Breaking News',
    favIconUrl: 'data:image/x-icon;base64,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',
  },
  {
    url: 'https://www.google.com/search?q=putlocker',
    title: 'putlocker - Szukaj w Google',
    favIconUrl: '',
  },
  // ── IT / developer tabs ──
  {
    url: 'https://github.com/',
    title: 'GitHub: Let’s build from here',
    favIconUrl: '',
  },
  {
    url: 'https://stackoverflow.com/questions/ask',
    title: 'Ask a Question - Stack Overflow',
    favIconUrl: '',
  },
  {
    url: 'https://www.docker.com/',
    title: 'Docker: Accelerated Container Application Development',
    favIconUrl: '',
  },
  {
    url: 'https://www.npmjs.com/',
    title: 'npm | Home',
    favIconUrl: '',
  },
  {
    url: 'https://vercel.com/',
    title: 'Develop Preview Ship | Vercel',
    favIconUrl: '',
  },
  {
    url: 'https://aws.amazon.com/console/',
    title: 'AWS Management Console',
    favIconUrl: '',
  }
]

/** Days ago values for each mock tab — creates a spread from fresh to very old. */
export const MOCK_DAYS = [
  // original spread
  1, 2, 5, 8, 12, 18, 25, 40, 60, 100, 101, 356, 366, 367
]
