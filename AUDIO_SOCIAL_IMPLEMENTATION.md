# Audio, SVG-uri, statistici și prieteni

## Aplicație

- Paleta existentă este păstrată. Ilustrațiile vectoriale originale din `components/Illustration.js` au roluri precise: căști pentru bibliotecă/player, traseu pentru provocări/progres, persoane pentru prieteni și confirmare pentru finalizarea audio-ului. Nu rulează animații decorative în buclă.
- Cardul mare „Ascultă lecțiile lui Dan” apare imediat sub SOS și deschide secțiunea existentă „Înțelege anxietatea”. Lista păstrează toate cele 14 videoclipuri publicate și conținutul CMS, cu accesul existent. Shortcut-ul din profil și accesul direct la bibliotecă/player verifică aceeași regulă de abonament plătit; trial-ul nu deschide audio-urile.
- Playerul comun `VideoPlayerScreen` este folosit de videoclipurile existente din Înțelege anxietatea, HAI, Ajutor, povestea lui Dan și CMS. Imaginea este vizibilă implicit; „Ascultă doar sunetul” păstrează același player și aceeași poziție. Exclusiv HLS (`hlsUrl` din API, `.m3u8`, `contentType: hls`), fără fallback sau retry pe MP4. Include ecran complet, PiP, pauză/redare, salt -15/+30 secunde, slider, viteze 0,5–2×, încărcare/eroare/retry HLS și o animație discretă de final cu Reduce Motion. Playerul audio separat a fost eliminat.
- Progresul este salvat întâi pe telefon, separat pe cont, apoi sincronizat cu UUID stabil și revizii. Retry la conectare, revenire în prim-plan și periodic în prim-plan. Logout-ul păstrează coada pentru același cont; ștergerea contului o elimină.
- Statistici reale pentru videoclipurile existente, vizionate sau ascultate: materiale finalizate (minimum 90% din intervalele audio parcurse și eveniment de final), materiale diferite, minute parcurse și provocări pentru care utilizatorul a trimis feedback. Salturile și repetarea acelorași intervale într-o sesiune nu umflă timpul parcurs. Reluarea explicită creează o sesiune nouă.
- Profilul propriu arată totalurile serverului, cu cache pentru offline și mesaj separat pentru progres nesincronizat. Datele ascultărilor mai vechi, înainte de acest build, nu pot fi reconstruite. Provocările existente sunt incluse.
- Profiluri sociale accesibile din avatarul/numele mesajelor comunității, căutare după nume, cereri, acceptare/refuz/anulare, eliminarea prieteniei și blocare/deblocare. Chatul privat este disponibil doar după acceptare.
- Statisticile altora sunt vizibile numai după activarea explicită a opțiunii din profil. API-ul nu expune email, jurnal, check-in-uri sau sesiuni SOS prin profilul social.
- Conversații cu paginare, retry cu același UUID și contor de necitite. Actualizare la fiecare 5 secunde cât conversația este deschisă în prim-plan. În această versiune, mesajele private nu au push, atașamente sau criptare end-to-end.

## Backend

`backend/src/social.js` este înregistrat în server, iar `migrateSocial` face parte din migrațiile aditive existente. Tabele noi: `audio_activity`, `social_preferences`, `friendships`, `user_blocks`, `private_messages`, `private_reads`. Cheile de proprietar au `ON DELETE CASCADE`.

API-uri autentificate:

- `POST /api/activity/audio`, `GET /api/activity/stats`.
- `GET /api/social/profiles/:id`, `GET /api/social/people?q=…&after=…`, `PUT /api/social/preferences`.
- `GET /api/social/friends?after=…`, `POST/DELETE /api/social/friends/:id`, `POST /api/social/friends/:id/accept`.
- `GET /api/social/blocks?after=…`, `POST/DELETE /api/social/blocks/:id`.
- `GET/POST /api/social/private/:id/messages` (cursor `before` sau `after`), `POST /api/social/private/:id/read`.
- `GET /api/social/unread-count` (cereri primite + mesaje private necitite).

Autentificarea verifică existența contului. Proprietarul este derivat din JWT. Acceptarea poate fi făcută doar de destinatar; cererile încrucișate nu acceptă automat prietenia. Blocarea în orice direcție și eliminarea prieteniei închid API-urile conversației. Mutațiile între două persoane blochează aceiași doi utilizatori în ordine stabilă într-o tranzacție pentru a coordona blocarea cu trimiterea mesajelor. Cererile și mesajele au limite de rată. UUID-ul unui mesaj nu poate fi refolosit pentru a schimba destinatarul sau textul.

## Verificare și lansare

- Root: `node --test tests/*.test.mjs`: 42 teste (inclusiv validarea sursei HLS și refuzul MP4).
- Backend: `npm run test:audio-social` și `npm run test:wellbeing`.
- Export Expo iOS/Android/web și verificări vizuale în browser la 320/390 px, teme deschisă/închisă, redare completă, salt la final, profil, căutare, cerere/anulare, acceptare și mesaj privat, folosind exclusiv date demonstrative locale.
- Testele de rute folosesc Fastify inject și un adaptor de stocare de test. Migrarea pe MySQL real și verificarea pe telefoane iOS/Android rămân necesare înainte de lansare, inclusiv lock screen, fundal, cititoare de ecran și tastatură în chat.
- Lansează backend-ul și rulează migrațiile existente (`npm run migrate:custom`, cu configurația mediului țintă) înainte de noul build mobil. Verifică autentificarea, tabela `challenge_runs`, privacy, blocarea și paginarea pe staging. Nu este necesară modificarea panelului pentru această etapă.
- `react-native-svg` este o dependență nativă nouă: livrează un build mobil nou, nu doar un OTA pentru binare care nu o conțin.
- Nu au fost executate migrații sau deploy în producție.
- Corecția playerului folosește aceleași identificatoare ale videoclipurilor publicate, care păstrează extensia `.mp4` în catalog; acestea sunt chei pentru API, nu surse de redare. Verificarea în browser confirmă sursa `.m3u8` și comutarea afișării, nu redarea HLS nativă sau continuitatea în timpul redării. Serverul demonstrativ local nu furnizează un manifest HLS real. Verifică aceste două comportamente pe telefoane înainte de lansare.

## SOS simplificat

Instrucțiuni în română, o singură fază centrală și butoane de minimum 58 px cu 14 px între ele. Setările de sunet și vibrații se deschid separat și pun exercițiul în pauză; revenirea cere reluare explicită. „Observă ce te înconjoară” arată un pas din cinci, cu exemple și navigare manuală. Evaluarea se deschide numai la cerere după încheiere. Etichetele tehnicilor sunt traduse și în kit, preferințe și panel. Ceasul, accesul offline și salvarea rămân comune.
