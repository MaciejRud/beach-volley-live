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

## 2026-09-02: Próg odcięcia mierzył nie to, co trzeba

W tabeli meczu ukrywałem procent, gdy prób było mniej niż 10 - żeby "nie
pokazywać statystyki z małej próbki". Właściciel zobaczył wiersz `Kill %`:
41,7%, kreska, i **60,0%** jako wartość meczową. Wygląda na błąd w liczbach.

Liczby były poprawne. Ukryty set to `7/8 = 87,5%`, mecz to `(5+7)/(12+8) = 60%`.
Problem był w tym, że **kreska stała w miejscu najwyższej z trzech wartości**,
więc kolumna obok i suma zaprzeczały czemuś, czego nie było widać.

Najpierw obniżyłem próg do 5. To było leczenie objawu - zmierzyłem, że mediana
ataków w secie to 10,5, więc próg 10 chował **42% wszystkich kolumn setowych**.
Właściciel zakwestionował jednak sam pomysł progu i miał rację: dwa ataki na dwa
to naprawdę 100%, a w szczegółach jednego meczu to jest fakt, nie próbka, przed
którą trzeba chronić czytelnika.

Sedno: **próg mierzył liczbę prób w komórce, a pytanie brzmiało "czy ten
zawodnik ma dość materiału, żeby go oceniać"**. To dwie różne rzeczy. Ta druga
decyzja i tak już zapadała gdzie indziej - przy wpuszczaniu na listę (10 meczów
kariery) i do rankingu (8 meczów w sezonie). Próg w komórce dublował ją w złym
miejscu i na złej podstawie.

Reguła: filtr jakości danych stosuje się **raz, przy wejściu do zbioru**, a nie
ponownie przy każdym renderowaniu. Jeśli ktoś jest w zestawieniu, to jego mecz z
dziewięcioma atakami też się liczy - inaczej suma przestaje odpowiadać składnikom.

Przy okazji wyszło, że agregaty sezonowe nigdy tego progu nie miały (osobna
funkcja w `playerFiles.ts`), więc mecz z 9 atakami zawsze wchodził do sezonu.
Sprawdzone na Artacho Del Solar 2022: dwa takie mecze, `47,48%` z nimi i bez
różnicy w wyniku - bo agregat sumuje akcje, nie uśrednia procentów.

## 2026-09-02: 25 nazw kluczy razy 250 wierszy to pięciokrotność pliku

Plan zakładał ~11,6 KB JSON na turniej. Pierwsza wersja zapisu dała **108 KB**,
czyli 22 MB na całe archiwum zamiast 3. Różnica to wyłącznie powtarzane nazwy
pól: 25 kluczy przy każdym z ~250 wierszy.

Przejście na krotki pozycyjne z kolejnością kolumn zapisaną w pliku
(`columns: [...]`) dało **11,3 KB** - dokładnie tyle, ile zakładał plan.

Dwie rzeczy warte zapamiętania. Po pierwsze: sprawdziłem to **zanim**
wygenerowałem 194 pliki, więc nie było migracji. Po drugie: kolejność kolumn
siedzi w każdym pliku osobno, a dekoder czyta ją stamtąd, nie ze stałej w
kodzie - dzięki temu dopisanie kolumny w przyszłości nie unieważni starych
plików. Kolejność jest **append-only**; przestawienie jej po cichu przekłamuje
każdą liczbę w archiwum.

## 2026-09-02: Link do prototypu w planie to nie ozdobnik

Plan wdrożenia miał w nagłówku link do artefaktu z prototypem. Zbudowałem trzy
etapy **wyłącznie z opisu prozą** w sekcji 6, nie otwierając go ani razu.
Właściciel zapytał, czemu układ różni się od tego, co wspólnie oceniali.

Różnica nie była kosmetyczna: prototyp miał trzy sekcje, których u mnie nie było
w ogóle (rozkład pochodzenia punktów jako pasek, rozkład zakończeń akcji,
percentyle jako kropka na skali), a ja zrobiłem z nich tabele i szary tekst.

Proza opisuje **co** ma być na ekranie. Prototyp pokazuje **jak to ma wyglądać**
- i to jest informacja, której zdanie "tabela z percentylami" nie niesie.
Jeśli plan odsyła do artefaktu, makiety albo zrzutu, otwieram to przed
pierwszą linijką kodu, a nie po pytaniu "czemu inaczej".

## 2026-09-02: z-index nie przebije sticky ani overflow

Dymek z definicją statystyki chował się za komórkami tabeli mimo `z-50`.
Podbijanie wartości nic nie dawało, bo problem nie był w warstwach.

Komórka etykiety jest `sticky`, a kontener tabeli ma `overflow-x-auto` -
**każde z tych dwóch tworzy własny kontekst nakładania**. Element wewnątrz
takiego kontekstu nie może wyjść ponad rodzeństwo tego kontekstu, choćby miał
`z-index: 9999`. To ten sam mechanizm, przez który `position: fixed` przestaje
być względne do okna, gdy przodek ma `transform`.

Rozwiązanie: `createPortal` do `document.body`. Panel opuszcza drzewo tabeli i
pozycjonuje się względem kursora przez `position: fixed`.

Objaw myli, bo wygląda jak problem z kolejnością warstw. Kiedy `z-index` nie
działa, pytanie brzmi nie "za mało", tylko **"czyj to kontekst nakładania"**.

## 2026-09-02: Cron w Actions i lokalna praca potrafią się rozminąć

Uruchomiłem workflow ręcznie, żeby sprawdzić, czy przechodzi. Przeszedł i
zacommitował `data/player-index.json` przebudowany **starą** wersją skryptu -
sprzed zmiany sortowania, którą właśnie robiłem lokalnie. Push odbił się
konfliktem.

Rozwiązanie było proste (rebase, przegenerowanie pliku, moja wersja wygrywa),
ale mechanizm warto pamiętać: **bot commituje pliki wynikowe, więc każda lokalna
zmiana generatora kłóci się z jego ostatnim przebiegiem**. Przy pracy nad
czymkolwiek, co produkuje zawartość `data/`, najpierw `git pull`.

## 2026-09-03: dwa rankingi w jednym regulaminie

Tabele grup liczymy sami, bo nikt ich nie publikuje. Znalazłem klauzulę w FIVB
Sport Operations Manual, zaimplementowałem - i dwie pule z siedmiu turniejów
wyszły sprzecznie z rzeczywistością. Wyglądało to na błąd w moim tie-breaku.

Nie był to błąd. Manual ma **dwa osobne rankingi**, a ja czytałem jeden:

- **wewnątrz grupy**: punkty meczowe, potem stosunek małych punktów (setów tam
  nie ma w ogóle)
- **między grupami**: "match points first, **set ratio** second, rally point
  ratio third, tournament seeding fourth"

Ten drugi decyduje, który drugi z grupy wchodzi do R16, a który do R18 - czyli
dokładnie to, co mierzyłem jako "sprawdzenie" tabeli. Miara testowała nie tę
regułę, którą implementowałem.

Lekcja jest o testowaniu, nie o siatkówce: **zanim uznam rozbieżność za błąd
implementacji, sprawdzam, czy miara mierzy to samo, co kod robi**. Trzy razy z
rzędu poprawiałem tu metrykę (głębokość w drabince → numer meczu wejścia →
runda wejścia), zanim zobaczyłem, że nawet poprawna metryka odpowiada na inne
pytanie.

## 2026-09-03: 100% albo TBD - próg, który trzeba zmierzyć, nie ustawić

Algorytm podstawiający "Winner M69" zamiast TBD wyprowadza okablowanie drabinki
z rozegranych turniejów. Kluczowe pytanie brzmiało: jak dopasować regułę do
turnieju o nieznanym formacie.

Zmierzyłem cztery kryteria na sezonie 2026 (reguły uczone na 2025):

| kryterium | trafność | pokrycie U20 |
|---|---|---|
| tylko dokładny format | 100.00% | 0 slotów |
| dokładny, inaczej dowolny podzbiór | 99.91% | 28 |
| zawsze podzbiór | 98.35% | 28 |
| **dokładny, inaczej podzbiór ≥80% rund** | **100.00%** | **28** |

Gdybym wybrał "intuicyjnie sensowne" luźne dopasowanie, wszedłbym z 98% - i 128
złych nazw na 40 turniejach. Różnica między 98% a 100% to nie zaokrąglenie,
tylko **błędna nazwa przy finale**, czyli dokładnie ten wiersz, na który ludzie
patrzą. Próg 80% nie jest wyczuty, tylko wybrany z tabeli pomiarów.

Wniosek na przyszłość: kiedy stawiam sobie próg jakości, od razu buduję pomiar,
który go weryfikuje out-of-sample. Bez tego "wydaje się dobre" wygrywa z
"jest dobre".

## 2026-09-03: dev server potrafi serwować stary build

Poprawka w komponencie flagi nie pojawiała się na stronie mimo czterech
restartów `npm run dev`. Kod na dysku był dobry, `tsc` czysty, a przeglądarka
uparcie renderowała starą wersję - 166 pustych obrazków, które właśnie
usunąłem.

Przyczyna: w `.next/static/chunks/` leżały artefakty z wcześniejszego
`npm run build`. Dev server podawał je zamiast przekompilować. CLAUDE.md
opisuje wariant z `MODULE_NOT_FOUND` przy buildzie; ten jest cichszy, bo nic
nie pada - po prostu widzisz nieaktualną stronę.

Rozpoznanie zajęło cztery restarty, bo szukałem błędu w kodzie. Szybszy test:
`grep` po skompilowanym chunku w `.next/static/chunks/` za fragmentem nowego
kodu. Nie ma go tam - to nie kod jest winny, tylko cache.
