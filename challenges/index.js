// Central catalog of challenges with stable IDs
// Structure: levels with nested challenges, IDs must be unique and stable

export const levels = [
  {
    id: 1,
    title: 'Nivel 1',
    goal: '➡️ scop: obișnuirea cu senzațiile, gândurile și situațiile ușoare',
    color: '#5cb85c',
    gradientColors: ['#5cb85c', '#4cae4c'],
    difficulty: 'Ușor',
    duration: '5-10 min',
    challenges: [
      { id: 'l1_c1', title: 'Stai 5 minute cu anxietatea spunându-ți: „Poți să fii aici, eu nu mă tem.”', est: '5 min' },
      { id: 'l1_c2', title: 'Mergi 5 minute la o plimbare scurtă în jurul blocului.', est: '5 min' },
      { id: 'l1_c3', title: 'Bea o cafea sau ceai și observă dacă apar palpitații.', est: '5-15 min' },
      { id: 'l1_c4', title: 'Scrie un gând anxios pe hârtie și citește-l cu voce tare.', est: '5 min' },
      { id: 'l1_c5', title: 'Ține în mână o bucată de gheață și observă senzațiile.', est: '2-3 min' },
      { id: 'l1_c6', title: 'Inspiră adânc, ține 5 secunde, expiră lent – repetă de 5 ori.', est: '2-3 min' },
      { id: 'l1_c7', title: 'Spune-ți: „Îmi permit să am orice gând.”', est: '1 min' },
      { id: 'l1_c8', title: 'Notează un lucru curajos făcut azi.', est: '2 min' },
    ],
  },
  {
    id: 2,
    title: 'Nivel 2',
    goal: '➡️ scop: să înveți că și în contexte mai incomode ești în siguranță',
    color: '#f0ad4e',
    gradientColors: ['#f0ad4e', '#eea236'],
    difficulty: 'Moderat',
    duration: '10-20 min',
    challenges: [
      { id: 'l2_c1', title: 'Mergi singur(ă) la magazin și stai câteva minute.', est: '5-10 min' },
      { id: 'l2_c2', title: 'Stai la coadă într-un supermarket fără să grăbești ieșirea.', est: '5-10 min' },
      { id: 'l2_c3', title: 'Urcă într-un autobuz/metrou pentru o stație.', est: '5-10 min' },
      { id: 'l2_c4', title: 'Aleargă pe loc 1 minut și observă pulsul.', est: '1 min' },
      { id: 'l2_c5', title: 'Spune-ți: „Pot avea un atac de panică acum și tot voi fi în siguranță.”', est: '1-2 min' },
      { id: 'l2_c6', title: 'Imaginează-ți cel mai rău scenariu 2 minute, apoi întreabă-te: „Ce se întâmplă de fapt acum?”', est: '2 min' },
      { id: 'l2_c7', title: 'Rămâi într-o situație incomodă 2 minute în plus.', est: '2 min+' },
      { id: 'l2_c8', title: 'Fă 20 de genuflexiuni și observă respirația accelerată.', est: '2-3 min' },
    ],
  },
  {
    id: 3,
    title: 'Nivel 3',
    goal: '➡️ scop: înfruntarea situațiilor și gândurilor cele mai temute',
    color: '#d9534f',
    gradientColors: ['#d9534f', '#c9302c'],
    difficulty: 'Avansat',
    duration: '20-30 min',
    challenges: [
      { id: 'l3_c1', title: 'Participă la o discuție de grup și nu te retrage.', est: '10-20 min' },
      { id: 'l3_c2', title: 'Stai 10 minute pe o bancă în parc, observând senzațiile.', est: '10 min' },
      { id: 'l3_c3', title: 'Intră într-un lift și rămâi până la capăt.', est: '5-10 min' },
      { id: 'l3_c4', title: 'Repetă: „Am anxietate și e ok să o simt.” timp de 1 minut.', est: '1 min' },
      { id: 'l3_c5', title: 'Scrie lista fricilor tale și citește-o zilnic.', est: '10-15 min' },
      { id: 'l3_c6', title: 'Bea rapid o băutură rece și simte senzația în piept.', est: '1-2 min' },
      { id: 'l3_c7', title: 'Stai cu ochii închiși și rotește-te încet 20 secunde pentru amețeală.', est: '20 sec' },
      { id: 'l3_c8', title: 'Lasă un atac de panică să vină și doar observă, fără să intervii.', est: '5-15 min' },
    ],
  },
];

export function getChallengeById(id) {
  for (const lvl of levels) {
    const c = lvl.challenges.find((x) => x.id === id);
    if (c) return { level: lvl, challenge: c };
  }
  return null;
}
