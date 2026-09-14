# Firebase-oppsett for Dawah Norge

Dette gjøres én gang av personen som skal eie systemet. Bruk helst en felles e-postadresse som Dawah Norge kontrollerer, ikke en privat konto som kan forsvinne dersom noen går ut av styret.

## 1. Opprett Firebase-prosjektet

1. Gå til [Firebase Console](https://console.firebase.google.com/).
2. Trykk **Create a project** / **Opprett et prosjekt**.
3. Skriv prosjektnavnet `Dawah Norge Oppfolging`.
4. La prosjekt-ID-en Firebase foreslår stå, eller velg en unik ID som `dawah-norge-oppfolging`.
5. Google Analytics er ikke nødvendig for dette systemet. Slå det av.
6. Trykk **Create project**.

Prosjekt-ID-en må tas vare på. Den vises øverst i **Project settings**.

## 2. Aktiver innlogging med e-post og passord

1. Åpne **Build → Authentication**.
2. Trykk **Get started**.
3. Åpne fanen **Sign-in method**.
4. Velg **Email/Password**.
5. Aktiver bare det første valget **Email/Password**. `Email link` er ikke nødvendig.
6. Trykk **Save**.

Ikke aktiver anonym innlogging. Brukerne skal få konto av systemansvarlig.

## 3. Opprett databasen i Europa

1. Åpne **Build → Firestore Database**.
2. Trykk **Create database**.
3. Velg **Production mode**.
4. Velg en europeisk lokasjon. Velg helst **eur3 (Europe)** dersom den er tilgjengelig.
5. Trykk **Enable**.

Lokasjonen kan normalt ikke endres senere. Kontroller derfor at du har valgt Europa før du fortsetter.

## 4. Registrer nettsiden i Firebase

1. Trykk tannhjulet ved **Project Overview** og velg **Project settings**.
2. Under **Your apps**, trykk web-ikonet `</>`.
3. Skriv `Dawah Norge Oppfølging` som kallenavn.
4. Ikke velg automatisk Firebase Hosting-oppsett i dette steget.
5. Trykk **Register app**.
6. Firebase viser en kode som begynner med `const firebaseConfig = { ... }`.

Finn disse seks verdiene i koden:

| Firebase-verdi | Felt i prosjektet |
|---|---|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

Lag en kopi av `.env.example`, gi kopien navnet `.env.local`, og bytt ut eksempelverdiene. Filen skal se omtrent slik ut:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=dawah-norge-oppfolging.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=dawah-norge-oppfolging
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=dawah-norge-oppfolging.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Firebase-nøkkelen i en webapp er ikke et hemmelig administratorpassord. Det er sikkerhetsreglene i neste steg som beskytter databasen. Ikke legg servicekonto-nøkler eller private administratornøkler i prosjektet.

## 5. Publiser sikkerhetsreglene

Prosjektet inneholder en ferdig fil som heter `firestore.rules`.

Enkel metode i Firebase:

1. Åpne **Firestore Database → Rules**.
2. Åpne `firestore.rules` fra prosjektmappen i en teksteditor.
3. Kopier hele innholdet.
4. Erstatt alt som står i Firebase Rules-vinduet.
5. Trykk **Publish**.

Reglene gjør at:

- vanlige medlemmer bare kan sende inn en registrering
- vanlige medlemmer ikke kan lese personlisten
- styremedlemmer kan lese og endre registreringer og kontaktlogg
- ingen får tilgang uten innlogging
- samtykke må være bekreftet ved registrering

## 6. Opprett den første styrekontoen

### A. Opprett innloggingen

1. Åpne **Authentication → Users**.
2. Trykk **Add user**.
3. Skriv styremedlemmets e-postadresse og et midlertidig, sterkt passord.
4. Trykk **Add user**.
5. Kopier brukerens **User UID** fra listen.

### B. Gi kontoen styretilgang

1. Åpne **Firestore Database → Data**.
2. Trykk **Start collection**.
3. Collection ID skal være nøyaktig `users`.
4. Document ID skal være User UID-en du kopierte.
5. Legg til disse feltene:

| Feltnavn | Type | Verdi |
|---|---|---|
| `displayName` | string | Personens navn |
| `role` | string | `board` |

6. Trykk **Save**.

Bruk små bokstaver i `board`. Når personen logger inn, får vedkommende tilgang til hele styredelen.

## 7. Opprett en vanlig medlemskonto

Gjør det samme i **Authentication → Users**, kopier UID-en og opprett et dokument i `users`. Forskjellen er:

| Feltnavn | Type | Verdi |
|---|---|---|
| `displayName` | string | Personens navn |
| `role` | string | `member` |

En konto med `member` kan bare se og sende inn registreringsskjemaet.

Gjenta steg 6 eller 7 for alle som skal ha tilgang. Ikke la personer dele samme konto.

## 8. Bygg og publiser systemet

Åpne Terminal i prosjektmappen og kjør:

```bash
corepack enable
pnpm install
pnpm run build:firebase
npx firebase-tools login
```

Kopier `.firebaserc.example` til `.firebaserc`, åpne filen og erstatt `BYTT_TIL_FIREBASE_PROJECT_ID` med prosjekt-ID-en fra Firebase.

Publiser deretter nettsiden og reglene:

```bash
npx firebase-tools deploy
```

Etter publisering viser terminalen en adresse som ligner:

```text
https://dawah-norge-oppfolging.web.app
```

Denne lenken kan sendes til godkjente brukere. Selve siden kan åpnes av alle som har lenken, men ingen personopplysninger kan leses uten en godkjent styrekonto.

## 9. Test før dere bruker ekte opplysninger

1. Logg inn med en vanlig medlemskonto i et privat nettleservindu.
2. Kontroller at medlemmet bare ser registreringsskjemaet.
3. Registrer en oppdiktet testperson og bekreft samtykke.
4. Logg inn med styrekontoen.
5. Kontroller at testpersonen vises i listen.
6. Rediger status og registrer to kontaktforsøk.
7. Kontroller at antall kontakter og siste kontaktdato oppdateres.
8. Last ned en sikkerhetskopi fra brukermenyen.
9. Slett testdata før systemet tas i bruk.

## 10. Installer som ikon på mobil

### iPhone

1. Åpne systemlenken i Safari.
2. Trykk **Del**.
3. Velg **Legg til på Hjem-skjerm**.

### Android

1. Åpne systemlenken i Chrome.
2. Åpne menyen.
3. Velg **Installer app** eller **Legg til på startskjermen**.

## Viktig før ekte data legges inn

Registeret inneholder opplysninger om religiøs tilhørighet. Dawah Norge må ha gyldig behandlingsgrunnlag, tydelig informasjon til den registrerte, uttrykkelig samtykke, sletterutine, databehandleravtale og kontroll med hvem som har tilgang. Få dette vurdert av noen med personvernkompetanse før dere begynner å registrere ekte personer.
