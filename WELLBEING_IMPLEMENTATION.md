# SOS, check-in și kit offline

Pachetul este implementat în trei repository-uri: aplicația mobilă din acest director, `backend` și `paneldan`. Modificările din cele două subdirectoare trebuie livrate separat; sunt ignorate de repository-ul mobil.

## Funcții și acces

- Dashboard-ul pornește SOS direct și oferă check-in, timeline și kit offline. Setările aplicației includ setări SOS și reminder.
- SOS pornește cu preferințele salvate: implicit 180 secunde, inspir 4 / expir 6, haptics active, sunet oprit. Sunt disponibile 120/180/300 secunde, ritmul 4/2/6 și grounding 5–4–3–2–1.
- Un ceas bazat pe timpul activ conduce fazele. Pauza, ascunderea aplicației și ieșirea din ecran opresc efectele; revenirea cere reluare explicită. Feedback-ul opțional este salvat separat de încheierea sesiunii.
- Check-in-urile și feedback-ul sunt sincronizate în cont și vizibile lui Dan în panel. Notițele, contactele și favoritele kitului sunt locale.
- Basic/Premium/VIP/Pro active oferă acces. Trial-ul este exclus. Offline este necesară o expirare viitoare confirmată pentru contul curent. Abonamentele active fără o dată de expirare necesită verificare online; nu primesc acces offline nelimitat sau notificări programate după o expirare necunoscută.
- Expirarea blochează accesul nou, păstrând datele. SOS admis poate fi încheiat și salvat local chiar dacă accesul expiră. Upload-ul așteaptă reactivarea.

## Persistență și sincronizare

`wellbeing_v1:<userId>` păstrează check-in-uri, sesiuni, preferințe, kit, ultima confirmare a abonamentului și starea reminder-ului. Scrierile sunt serializate; intrările au UUID, revizie și indicator de sincronizare. Serverul folosește unicitatea `(user_id, client_id)` pentru retry fără duplicate. Feedback-ul folosește revizii crescătoare pentru a respinge actualizările întârziate.

Sincronizarea rulează la pornire, revenire în prim-plan, reconectare și după salvare, cu retry periodic în prim-plan. Descărcarea este paginată și îmbină datele fără a elimina intrările nesincronizate. La logout se opresc upload-ul și reminder-ul; datele rămân separate pentru același cont. Ștergerea contului elimină blob-ul local și tabelele aferente. Scrierile întârziate din sesiuni deja montate nu pot recrea datele unui cont șters.

Reminder-ul este o notificare locală unică, activată voluntar. După 72 ore fără check-in, alege prima oră locală 18:00 eligibilă, înainte de expirarea abonamentului. Un check-in nou o reprogramează. O notificare deja livrată nu se repetă la fiecare deschidere. Notificările existente pentru gândul zilei nu sunt modificate.

## API nou

Autentificare mobilă: `Authorization: Bearer <token>`, plus abonament plătit activ verificat server-side. Proprietarul este derivat din token.

| Rută | Comportament |
| --- | --- |
| `POST /api/wellbeing/checkins` | Salvare idempotentă a unui check-in |
| `GET /api/wellbeing/checkins` | Listare proprie paginată |
| `POST /api/wellbeing/sessions` | Salvare idempotentă a unei sesiuni încheiate/oprite |
| `GET /api/wellbeing/sessions` | Listare proprie paginată |
| `PATCH /api/wellbeing/sessions/:clientId/feedback` | `{ feedback, revision }`, actualizare numai pentru o revizie mai mare |
| `GET /api/admin/wellbeing/checkins` / `sessions` | Listare admin, cu `user_id`, `since`, `until`, `page`, `limit` |
| `GET /api/admin/wellbeing/checkins/:id` / `sessions/:id` | Detalii admin |

Metadate comune: `clientId` UUID, `occurredAt` ISO UTC, `timezoneOffset` în minute ca `Date.getTimezoneOffset()`, `timezone` IANA. SQL păstrează momentul în UTC; interfața arată ora înregistrată pe telefon.

Check-in: `level` întreg 1–10; `note` maximum 4.000 caractere; `context` home/work/travel/social/other; `sleep` poor/average/good; `caffeine` none/some/much; `activity` rest/walk/exercise/work/social/other. Câmpurile contextuale sunt opționale.

Sesiune: `duration` 120/180/300, `elapsedMs` între 0 și durată, `pattern` 4-6/4-2-6, `status` completed/stopped, `techniques` breathing/grounding și feedback opțional `{ rating: helpful/neutral/unhelpful, level, context }`.

Crearea și feedback-ul răspund cu `{ item }`. Listele mobile răspund cu `{ items, page, limit, hasMore }`; cele admin includ `total` și identitatea utilizatorului. Erori: 400 pentru date invalide, 401 fără autentificare validă, 403 fără acces, 404 pentru o sesiune/detaliu inexistent.

Observațiile se calculează pe telefon, fără AI: minimum 10 intrări în perioada selectată, 3 în fiecare grup comparat și diferență medie de minimum 1 punct. Recomandările folosesc evaluări pozitive, contextul ultimului check-in din ultimele 6 ore, frecvența și recența.

## Validare și lansare

- `npm run test:wellbeing` în aplicație: ceas, faze, acces, observații, recomandări, repository, upload/retry și reminder.
- `npm run test:wellbeing` în backend: rute Fastify cu pool de test, validare, autorizare, izolare, replay și revizii. Aceste teste nu înlocuiesc verificarea SQL pe MySQL.
- `npm run build` și `npm run lint` în panel: ambele trec după actualizarea dependențelor și corectarea încărcării inițiale/formularelor.
- Exporturile Metro pentru Android și iOS includ cele patru fișiere WAV locale. Sunetele originale se pot regenera cu `node scripts/generate-wellbeing-audio.cjs`.
- Expo este actualizat la `57.0.26`; `npx expo install --check` confirmă compatibilitatea dependențelor cu SDK 57.
- Verificare browser cu date demonstrative: check-in/timeline, pauză/reluare SOS, grounding, feedback, kit, preferințe, tema întunecată, background simulat și rețea întreruptă/restabilită; panel la lățimi desktop/mobil. Capturile locale sunt în `.expo/wellbeing-*.png`.

Ordine de lansare: backend cu migrarea aditivă pentru `wellbeing_checkins` și `wellbeing_sessions`, apoi panel, apoi un nou build nativ mobil. Migrarea este integrată în pornirea backend-ului și poate fi executată explicit prin `runMigrations()` din `src/migrate.js`.

Înainte de publicare rămân de verificat migrarea pe MySQL de test și comportamentul pe telefoane reale iOS/Android: intensitatea haptics, sunet, întreruperi audio, blocarea ecranului, VoiceOver/TalkBack, Reduce Motion și notificarea locală la expirare. Exportul JavaScript și testele browser nu confirmă aceste comportamente native. Docker local nu era pornit în timpul implementării.

Nu s-au executat deploy sau submit în magazine.
