/**
 * Mock tab data extracted from test/mocks/tabs_example.json.
 * Used by the "Mock 10 tabs" button to create realistic tabs with backdated lastAccessed.
 * Each entry provides url, title, favIconUrl for browser.tabs.create(), and daysAgo for timestamping.
 */

export const MOCK_TABS = [
  {
    url: 'https://domeczek.com.pl/pl/p/NAKLEJKI-FOLIA-OCHRONNA-kuchnia-zlew-10-szt/1558',
    title: 'NAKLEJKI FOLIA OCHRONNA kuchnia zlew 10 szt "DOMOWO"',
    favIconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NgAAIAAAUAAR4f7BQAAAAASUVORK5CYII=',
    daysAgo: 1,
  },
  {
    url: 'https://www.leroymerlin.pl/produkty/naklejka-kuchenna-odporna-na-olej-samoprzylepna-folia-ochronna-na-blaty-domowe-wodoodporna-i-odporna-na-plamy-60-cm-x-10-m-75162203.html',
    title: 'Naklejka kuchenna odporna na olej - folia ochronna - 60 cm x 10 m - Leroy Merlin',
    favIconUrl: '',
    daysAgo: 2,
  },
  {
    url: 'https://www.castorama.pl/departments/folia-ochronna-wallfluent-80x40-cm-mi-kkie-szk-o-przezroczysta-na-blat-st-pod-og-1-szt-/4070095992289_CAPL.prd',
    title: 'Folia ochronna Wallfluent 80x40 cm - przezroczysta',
    favIconUrl: '',
    daysAgo: 5,
  },
  {
    url: 'https://www.ceneo.pl/78293725',
    title: 'Aluminiowa folia ochronna do blatów 45mb x 50mm - Opinie na Ceneo.pl',
    favIconUrl: '',
    daysAgo: 8,
  },
  {
    url: 'https://www.perplexity.ai/search/5d84760f-2c7f-4d57-8d3b-19bb38fad817',
    title: 'Folia ochronna samoprzylepna dookoła zlewu - ochrona przed wodą',
    favIconUrl: '',
    daysAgo: 12,
  },
  {
    url: 'https://allegro.pl/produkt/naklejka-imitujaca-marmur-bedee-60-x-300cm-1696ddd3-040e-48a9-ada0-e35f67b1b910',
    title: 'Naklejka imitująca marmur Bedee 60 x 300cm - Allegro',
    favIconUrl: '',
    daysAgo: 18,
  },
  {
    url: 'https://allegro.pl/produkt/naklejka-imitujaca-marmur-40-x-300cm-375be2c3-1168-4352-a697-d67e9e6e96d4',
    title: 'Naklejka imitująca marmur 40 x 300cm - Allegro',
    favIconUrl: '',
    daysAgo: 25,
  },
  {
    url: 'https://allegro.pl/kategoria/przybory-kuchenne-maty-do-zlewu-322271',
    title: 'Ociekacz do Zlewu - Maty do zlewu kuchennego - Allegro',
    favIconUrl: '',
    daysAgo: 40,
  },
  {
    url: 'https://9gag.com/',
    title: '9GAG - Best Funny Memes and Breaking News',
    favIconUrl: 'data:image/x-icon;base64,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',
    daysAgo: 60,
  },
  {
    url: 'https://www.google.com/search?q=putlocker',
    title: 'putlocker - Szukaj w Google',
    favIconUrl: '',
    daysAgo: 100,
  },
  // ── IT / developer tabs ──
  {
    url: 'https://github.com/',
    title: 'GitHub: Let\'s build from here',
    favIconUrl: '',
    daysAgo: 101,
  },
  {
    url: 'https://stackoverflow.com/questions/ask',
    title: 'Ask a Question - Stack Overflow',
    favIconUrl: '',
    daysAgo: 356,
  },
  {
    url: 'https://www.docker.com/',
    title: 'Docker: Accelerated Container Application Development',
    favIconUrl: '',
    daysAgo: 366,
  },
  {
    url: 'https://www.npmjs.com/',
    title: 'npm | Home',
    favIconUrl: '',
    daysAgo: 367,
  },
  {
    url: 'https://vercel.com/',
    title: 'Develop Preview Ship | Vercel',
    favIconUrl: '',
    daysAgo: 100,
  },
  {
    url: 'https://aws.amazon.com/console/',
    title: 'AWS Management Console',
    favIconUrl: '',
    daysAgo: 101,
  }
].slice(0, 14)
