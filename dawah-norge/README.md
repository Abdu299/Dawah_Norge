# Dawah Norge – Oppfølging

Et mobilvennlig internt system for registrering og oppfølging av nye muslimer. Systemet bruker Firebase Authentication og Cloud Firestore, og kan publiseres gratis med Firebase Hosting innenfor Firebase sine gratiskvoter.

## Funksjoner

- personlig innlogging med e-post og passord
- medlemstilgang som bare kan sende inn nye registreringer
- styretilgang til oversikt, søk, filtre og redigering
- kontakthistorikk med antall, første og siste kontakt
- neste oppfølgingsdato og forsinkelsesvarsler
- rødt varsel etter 30 dager uten første kontakt
- aktivitet: aktiv, ikke aktiv eller vet ikke
- lister for 0, 1, 2 og 3+ kontakter
- sikkerhetskopi til JSON for styret
- installérbar PWA på mobil og PC
- Firestore-regler som håndhever tilgangen i databasen

## Lokal demoversjon

```bash
corepack enable
pnpm install
pnpm dev
```

Uten `.env.local` viser innloggingssiden knapper for en styredemo og en medlemsdemo. Demodata lagres ikke.

## Koble til Firebase

Følg [FIREBASE_OPPSETT.md](./FIREBASE_OPPSETT.md) fra start til slutt.

## Bygg for Firebase Hosting

```bash
pnpm run build:firebase
npx firebase-tools deploy
```

Den statiske produksjonsversjonen opprettes i `out/`, som allerede er valgt i `firebase.json`.

## Viktige filer

- `.env.example` – feltene som skal fylles med Firebase web-konfigurasjon
- `firestore.rules` – tilgangsregler som må publiseres
- `firebase.json` – hosting- og sikkerhetsoppsett
- `components/dawah-app.tsx` – hovedsystemet
- `FIREBASE_OPPSETT.md` – full norsk oppskrift

## Personvern

Ikke bruk ekte personopplysninger før Dawah Norge har dokumentert behandlingsgrunnlag, uttrykkelig samtykke, tilgangsrutiner, slettefrist og databehandleravtaler. Sikkerhetskopier inneholder sensitive opplysninger og må lagres kryptert.
