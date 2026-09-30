# Verificare abonament în fundal și actualizări — 30 septembrie 2026

- Intrarea cu o sesiune salvată nu mai așteaptă serverul de abonamente. Revocarea autentificării se aplică în fundal numai sesiunii care a pornit verificarea.
- RevenueCat și abonamentul backend se verifică în fundal la pornire și la revenirea în prim-plan. Modalul „Verificăm abonamentul” este rezervat unei solicitări explicite de acces, nu sincronizării automate.
- Ultima confirmare din cache este asociată contului și utilizată imediat până la expirarea cunoscută. Cache-ul altui cont, o expirare necunoscută sau expirată nu acordă acces offline. Abonamentul lifetime este acceptat după verificare. Trial-ul rămâne distinct de abonamentul plătit.
- Erorile de rețea păstrează confirmarea validă din cache; un răspuns verificat fără acces o revocă. Schimbările de cont și o achiziție nouă invalidează răspunsurile anterioare. Expirarea este aplicată și cât aplicația rămâne deschisă.
- Taburile din dashboard au fade și deplasare laterală de 14 px, în 220 ms. Atingerile repetate anulează tranziția precedentă; Reduce Motion dezactivează efectul.

## Dependențe

- Aplicație: Expo `57.0.26`, navigația React Navigation 7, iconuri și celelalte actualizări compatibile cu SDK 57; React/React Native rămân la versiunile cerute de SDK.
- Backend: Fastify 5, Better Auth, MySQL2, MJML, Resend și restul actualizărilor în limitele majore existente. Dependența nefolosită `@expo/vector-icons` și peer-urile mobile au fost eliminate din server.
- Panel: React `19.3`, Vite `7.3.6`, plugin React SWC `4.3.3`, React Router și ESLint actualizate. SWC este fixat prin override la `1.16.2`, deoarece `1.16.12` a eșuat la încărcarea modulului nativ pe acest Windows (`ERR_SWC_NATIVE_CACHE`). Build-ul reușește cu `1.16.2`, o actualizare față de versiunea anterioară `1.15.17`.
- Override-ul limitat la `xcode → uuid 11.1.1` elimină vulnerabilitatea transitivă. Xcode folosește `uuid.v4()` fără buffer; compatibilitatea a fost verificată prin generarea a 1.000 de identificatori unici în formatul de 24 caractere al proiectelor Apple.
- Lockfile-urile tuturor repository-urilor sunt actualizate. `npm audit` raportează zero vulnerabilități în fiecare.

## Validare

- 37 teste în aplicație și 19 în backend, inclusiv 10 cazuri noi pentru acces/cache/trial/expirare și afișarea modalului.
- Exporturi Expo reușite pentru iOS, Android și web; verificarea versiunilor Expo trece.
- Build și lint complet pentru panel trec.
- Verificare vizuală cu date locale demonstrative, răspunsul de abonament întârziat cu 12 secunde și schimbări rapide între toate cele patru taburi. Dashboard-ul se deschide fără modal și cache-ul Premium rămâne utilizabil.
- Verificarea RevenueCat pe dispozitive reale, achizițiile/restaurarea și migrarea pe un MySQL de staging rămân necesare înainte de publicare. Exporturile nu echivalează cu un build nativ instalat.

Ordine de lansare: backend și migrații aditive, panel, apoi build mobil nou. Nu au fost executate migrații sau deploy în producție în această sesiune.
