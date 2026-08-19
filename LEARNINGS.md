# Beach Volley Live - dziennik projektu

## 2026-08-19: Strefy czasowe, czyli jak nie wpaść w pułapkę "prawie działającego" pola

**Kontekst:** Trzeba było pokazać godzinę meczu w strefie użytkownika, a w nawiasie
oryginalną godzinę miejsca rozgrywek.

**Ślepa uliczka.** FIVB API ma pole `TimeZone`. Wygląda obiecująco: Montreal=15,
Pingtan=81, Tallinn=51. Widać, że id rośnie razem z offsetem UTC, więc kusi, żeby
dopasować funkcję liniową i mieć problem z głowy. Sprawdziłem to na 13 znanych
lokalizacjach - **błąd sięgał 2.46 godziny**. To nie jest offset, tylko indeks w
posortowanej liście stref, do której API nie daje żadnego endpointu
(`GetTimeZoneList` zwraca `BadParameter`).

Gorzej: to id **nie jest nawet spójne wewnątrz jednego turnieju**. Malmö ma
`TimeZone=38,51`, Sibiu `45,58`. Gdybym oparł się na "pierwszej znalezionej
wartości", część meczów pokazywałaby złą godzinę - i to cicho, bez błędu.

Druga ślepa uliczka: wyprowadzić strefę z lokalizacji. Nie da się. Pole `city`
jest **puste we wszystkich 652 turniejach**, a kod kraju potrafi kłamać:
"BPT Futures Tahiti" ma `countryCode=FR`, ale Tahiti to UTC-10, nie strefa Paryża.

**Rozwiązanie.** W lokalnej dokumentacji (`docs/FIVB-API-Documentation.md`) była
lista pól, której wcześniej nie przeczytałem do końca: feed podaje **ten sam
moment dwa razy** - `LocalDate`/`LocalTime` oraz `UtcDate`/`UtcTime`. Mając parę
UTC, strefa areny przestaje być potrzebna: przeglądarka sama przelicza na strefę
użytkownika, a czas lokalny areny bierzemy wprost z feedu. Zweryfikowane na 8
miejscach, 8/8, łącznie z Indiami (+5:30) i oboma niejednoznacznymi przypadkami.

**Lekcja:** Zanim zaczniesz odtwarzać dane heurystyką, przeczytaj listę pól do
końca. Pole, które "prawie działa" (monotoniczne, wygląda sensownie) jest
groźniejsze niż pole, którego w ogóle nie ma - bo błąd nie krzyczy, tylko cicho
przesuwa godziny o dwie.

**Druga lekcja z tego samego dnia:** analogicznie poległo `[Q]` (oznaczenie
drużyny z kwalifikacji). Założyłem `IsInMainDraw=1 AND IsInQualification=1`.
Sprawdzenie na 80 drużynach: **żadna** nie ma obu flag naraz, a zespoły oznaczone
`[Q]` na stronie referencyjnej mają `IsInMainDraw=1, IsInQualification=0`.
Usunąłem tę funkcję zamiast zgadywać. Lepiej nie pokazać czegoś, niż pokazać źle.

## 2026-08-19: Konwersja czasu musi być w useEffect, nie w renderze

`toLocaleTimeString()` na serwerze użyje strefy **serwera**, nie użytkownika.
W Next.js z SSR oznacza to, że wyrenderowany HTML ma inną godzinę niż to, co
React policzy po stronie klienta - i wywala się hydracja.

Rozwiązanie w `src/components/MatchTime.tsx`: do momentu uruchomienia efektu
pokazujemy godzinę areny (poprawną dla kogoś w tej strefie i nigdy pustą),
a przeliczenie dopisuje się dopiero po stronie klienta.

## 2026-08-19: Next 16 + Serwist = build pod webpackiem

Upgrade do Next 16 (zrobiony dla bezpieczeństwa - zamykał 4 podatności w `sharp`
i `postcss`) wywalił build:

```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
```

Next 16 domyślnie używa Turbopacka, a `@serwist/next` (service worker dla PWA)
wstrzykuje konfigurację webpacka, w którą Turbopack nie potrafi się wpiąć.
Dostępne opcje: eksperymentalny `@serwist/turbopack` albo przypięcie builda do
webpacka flagą `--webpack`.

Wybrałem `--webpack`. Upgrade robiliśmy dla bezpieczeństwa, nie dla szybkości
builda - wprowadzanie eksperymentalnego pluginu w warstwę service workera
byłoby wymianą jednego ryzyka na drugie. Flagę można zdjąć, gdy wsparcie
Turbopacka w Serwist wyjdzie z fazy eksperymentalnej.

## 2026-08-19: Stary katalog .next udaje błąd w kodzie

Pierwszy build po przejęciu projektu wywalił się serią:

```
Cannot find module './331.js'
PageNotFoundError: Cannot find module for page: /_not-found
```

Wygląda na zepsuty kod, jest to zabrudzony katalog `.next` z trybu dev.
`rm -rf .next` i build przechodzi. Zapisane w CLAUDE.md, bo objaw myli.

## 2026-08-19: Dwie warstwy cache muszą się zgadzać

W aplikacji są dwa cache: `globalCache` (in-memory, TTL w kliencie) i nagłówek
`s-maxage` na CDN Vercela. **Na Vercelu liczy się głównie ten drugi** - funkcje
serverless są krótkotrwałe, więc pamięć podręczna procesu nie przeżywa między
wywołaniami. To nagłówek CDN realnie chroni API FIVB przed zalewem zapytań.

Regułę zapisałem w CLAUDE.md wraz z tabelą wartości: `s-maxage` ma być **równy
lub mniejszy** od TTL w pamięci. Przy okazji jej spisywania wyszło, że
`/api/tournaments/[id]` miał `s-maxage=30` przy TTL 25s - sam sobie zaprzeczał.
Wyrównane do 25/25.

## 2026-08-19: Osobne tabele nie wyrównują się same

Widok wyników turnieju to sekcja na fazę (Pool A, Pool B, ćwierćfinały...),
każda jako osobna `<table>`. Przy domyślnym `table-layout: auto` **każda tabela
liczy szerokości kolumn niezależnie**, więc kolumna TEAM 1 w Pool A wypadała w
innym miejscu niż w Pool B. Wygląda jak rozjechany layout, jest to poprawne
zachowanie HTML.

Naprawa: `table-fixed` + jawny `<colgroup>` ze stałymi szerokościami. Wszystkie
sekcje na stronie dostają identyczną siatkę.
