# Prelungirea abonamentelor din panel

În **Abonamente active**, administratorul poate adăuga zile unui utilizator sau tuturor utilizatorilor eligibili. Prelungirea globală ignoră filtrele și paginarea listei.

- Sunt eligibile abonamentele plătite Basic, Premium, Pro și VIP, începute și neexpirate. Se folosește același abonament curent per cont ca în lista din panel.
- Trial-urile, inclusiv cele RevenueCat, conturile fără abonament și abonamentele expirate sau care încep în viitor sunt excluse. Abonamentele fără termen sunt omise.
- Panelul oferă 1, 2, 3, 7, 14, 30, 60, 90 și 365 de zile, plus un număr personalizat întreg între 1 și 365.
- Zilele se adaugă la expirarea curentă. Accesul acordat este păstrat la sincronizarea RevenueCat până la acea dată; o reînnoire cu expirare ulterioară poate avansa accesul. Datele de facturare și reînnoire din Google Play/App Store nu se modifică.

## Actualizare

Publică mai întâi backend-ul și apoi panelul. Pornirea backend-ului execută migrarea din `runMigrations`: coloana `subscriptions.admin_extended_until` și tabelele `subscription_extension_operations` / `subscription_extension_changes`. Migrarea poate fi rulată repetat. Contul MySQL al backend-ului trebuie să permită aceste modificări de schemă.

Nu este necesară o versiune nouă a aplicației mobile: aceasta folosește deja accesul plătit verificat de backend.

## API administrativ

Ambele rute folosesc autentificarea administrativă existentă:

- `GET /api/admin/subscriptions/extension-preview?scope=all`
- `GET /api/admin/subscriptions/extension-preview?scope=user&user_id=123`
- `POST /api/admin/subscriptions/extend`

Exemplu corp JSON pentru prelungirea individuală:

```json
{
  "scope": "user",
  "userId": 123,
  "days": 2,
  "operationId": "42b99aca-bf19-43ef-877c-370b57a53d08"
}
```

Pentru prelungirea globală folosește `scope: "all"` și omite `userId`. Generează un UUID v4 nou pentru fiecare operațiune intenționată. La reluarea aceleiași cereri după o eroare de rețea, păstrează UUID-ul și corpul: serverul returnează rezultatul salvat fără să adauge zile din nou. Refolosirea UUID-ului pentru alt corp este respinsă cu 409.

Eligibilitatea este verificată din nou în tranzacție la confirmare. Numărul efectiv poate diferi de previzualizare dacă abonamentele expiră între timp. Actualizarea și jurnalul sunt atomice; jurnalul conține administratorul/metoda de autentificare și expirarea anterioară/nouă pentru fiecare abonament.

## Verificări

`npm run test:subscriptions` rulează verificările fără MySQL și omite testul de integrare dacă variabila de mai jos lipsește.

Pentru integrare setează `SUBSCRIPTIONS_TEST_MYSQL_URL` către o bază **dedicată testelor**, pe `127.0.0.1`, numită exact `dan_subscription_extensions_test`. Testul recreează datele acestei baze, rulează migrarea de două ori și verifică eligibilitatea, prelungirea globală/individuală, reluările, concurența, rollback-ul și sincronizarea RevenueCat.
