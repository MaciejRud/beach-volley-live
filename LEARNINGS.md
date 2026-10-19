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

## 2026-09-08: usuwając fallback, sprawdź wszystkich wywołujących, nie tylko ten jeden przypadek

Picker krajów odsłonił 26 federacji naraz i wyszło, że `CountryFlag` przy
nieznanym kodzie brał dwie pierwsze litery. To nie było tylko nieskuteczne -
było **cicho kłamliwe**: BEN (Benin) dawało "be", czyli flagę Belgii, NIG
(Niger) "ni" = Nikaragua, PAR (Paragwaj) "pa" = Panama, LBR (Liberia) "lb" =
Liban. TAN, SUD i URU po prostu wracały 404.

Naprawiłem to porządnie: 20 federacji dopisane jawnie, zgadywanie wycięte,
nieznany kod dostaje neutralny kafelek. Brak flagi to luka, zła flaga to
kłamstwo.

I tym samym zepsułem kalendarz turniejów.

Bo przez ten komponent idą **dwa różne systemy kodów**. Drużyny mają
trzyliterowe kody FIVB (`POL`, `BRA`). Turnieje mają dwuliterowe ISO prosto z
atrybutu `CountryCode` - wszystkie 87 z nich. Dla tych drugich obcięcie do
dwóch liter nie było zgadywaniem, tylko operacją tożsamościową. Wyciąłem je
razem ze złym przypadkiem i cała lista turniejów spadła na szary kafelek.

Sprawdziłem wtedy dokładnie ten scenariusz, który mnie zainteresował - trzy
litery spoza mapy - i ani jednego innego. `CountryFlag` ma siedem wywołań w
czterech komponentach.

**Wniosek na przyszłość:** zmiana kontraktu współdzielonego komponentu to nie
jest zmiana lokalna, choćby diff miał pięć linii. Zanim usunę fallback, robię
`grep` po wszystkich wywołaniach i wypisuję, jakie **dane** każde z nich podaje.
"Fallback jest zły" bywa prawdą tylko dla części ruchu, który przez niego
przechodzi.

## 2026-09-08: FIVB w 2022 liczyło tylko udane bloki

Przełącznik okresu na profilu zawodnika ujawnił, że pasek "How the actions
ended" dla sezonu 2022 jest w całości zielony. Nie błąd renderowania - feed:

| sezon | blockTotal | blockPoint | blockFault | blockContinue |
|---|---|---|---|---|
| 2022 | 12 541 | **11 951 (95%)** | 432 | 158 |
| 2023 | 46 660 | 15 334 (33%) | 19 290 | 12 036 |
| 2025 | 54 921 | 15 486 (28%) | 23 255 | 16 180 |

W 2022 rejestrowano praktycznie wyłącznie bloki punktowe. Rozkład na
punkt/kontynuacja/błąd dla tego sezonu nie niesie informacji - pokazywałby
każdego jako bezbłędnego blokującego.

Ciekawsze było **gdzie** postawić granicę. Pierwsza myśl: liczyć udział bloków
niepunktowych per zawodnik i odcinać poniżej progu. Sprawdziłem rozkłady i to
by nie zadziałało - w 2022 zawodnik potrafi mieć 45% bloków niepunktowych, a w
2023 tylko 18%. **Zakresy zachodzą, więc próg per gracz myliłby się w obie
strony.** Na poziomie całego sezonu separacja jest czysta: 4,7% vs 67%.

Metryka rankingowa (`blockPoint / mecze`) jest bezpieczna, bo `blockPoint` jest
spójny między sezonami. Zepsuty jest tylko rozkład.

**Wniosek na przyszłość:** kiedy dane trzeba zakwalifikować jako wiarygodne albo
nie, sprawdzam rozkłady na kilku poziomach agregacji, zanim wybiorę ten, na
którym stawiam próg. Poziom, na którym klasy się rozdzielają, nie zawsze jest
tym, na którym instynktownie się liczy.

## 2026-09-08: okno 25 turniejów nigdy nie dosięga zakończonych (decyzja: zostawiamy)

Poland Zone pokazywała zero meczów. Nie dlatego, że Polacy nie grają.

`getTournamentWindow()` sortuje sezon: `running`, potem `upcoming`, na końcu
`finished` - i bierze pierwsze 25. Sezon 2026 ma 12 running i 80 upcoming.
Limit wyczerpuje się na 25. pozycji, **zanim algorytm dojdzie do pierwszego
zakończonego turnieju**, a tych jest 546.

Czyli kategoria "Recent", którą strona reklamuje we własnym tytule ("Live,
Scheduled & Recent"), nie ma prawa się nigdy pojawić. We wrześniu Beach Pro
Tour ma po sezonie, więc cała polska aktywność siedzi właśnie tam. Skan
dziesięciu ostatnich turniejów BPT: 10 polskich meczów (Elite16 Hamburg,
Challenge Shangluo) - dane są, tylko po drugiej stronie granicy.

Druga usterka w tym samym sortowaniu: malejąca data jest słuszna dla
zakończonych, ale odwrotna dla nadchodzących. Z 80 przyszłych turniejów okno
bierze te **najbardziej odległe** (6 listopada przed przyszłym tygodniem).

Proponowana poprawka to trzy osobne budżety zamiast jednego cięcia: wszystkie
running, ~6 najbliższych upcoming, ~12 najnowszych finished. **Decyzja z
2026-09-08: nie wdrażamy teraz, może później.** Zapisane, żeby diagnoza nie
przepadła - metoda jest już wyciągnięta osobno, więc zmiana będzie w jednym
miejscu.

## 2026-09-08: `localeCompare` bez locale to niedeterminizm między maszynami

Push odbił się od zdalnych zmian. Zdalny commit `chore: update statistics
archive` z cotygodniowego workflow zmienił **wyłącznie kolejność dwóch wpisów**
w `player-index.json` - te same sezony, ci sami 577 zawodnicy, identyczna
liczba bajtów:

```
lokalnie:  ... Lunio Urszula, Łosiak Bartosz ...
w CI:      ... Łosiak Bartosz, Lunio Urszula ...
```

`build-player-data.ts` sortuje przez `a.d.localeCompare(b.d)` bez podanego
locale, więc wynik zależy od ustawień maszyny. Windows z polskim collation
stawia `Ł` tuż za `L`, ubuntu w GitHub Actions inaczej.

Skutki są dwa i oba realne: workflow produkuje co tydzień pusty commit z
komunikatem, który kłamie, a każda lokalna regeneracja danych kończy się
odbitym pushem.

**Wniosek na przyszłość:** każde `localeCompare` w kodzie, który generuje
zacommitowany plik, dostaje jawne locale. Sortowanie bez locale jest jak
`Date.now()` w snapshocie - działa, dopóki nie porównasz dwóch maszyn.

## 2026-09-26: Status turnieju w VIS to deklaracja organizatora, nie fakt

Na stronie U20 wisiał jako "trwający" trzy tygodnie po finale. Przyczyna nie
była w naszym kodzie, tylko w danych: CEV U20 European Championships (nr 9094)
ma w VIS `Status="6"`, choć wszystkie 103 mecze mają status zakończony, a
bliźniaczy turniej drugiej płci (9095) poprawnie dostał `7`. Ktoś zamknął jedną
płeć i zapomniał o drugiej.

Parser brał kody 2-6 za "running" bez patrzenia na daty. Po sprawdzeniu całego
sezonu okazało się, że takich zombie było **11 z 15** "trwających" turniejów -
najstarszy skończył się w lutym. Każdy z nich co 25 s ciągnął listę meczów w
`/api/live`.

Poprawka (`341b7e5`): data końca starsza niż wczoraj wygrywa z kodem. Dzień
zapasu, bo "dziś" liczymy w UTC, a finał w Amerykach kończy się po północy UTC.

**Wniosek:** pole ustawiane ręcznie przez organizatora (status, a pewnie i inne
flagi) traktuj jak wskazówkę i krzyżuj z czymś, co zmienia się samo - datami
albo statusami meczów. Te same dane mają jeszcze dwa niezałatane przypadki:
kod `10` (CNVP Formentera), którego parser nie zna, i kod `1` po dacie końca
(Maputo 3), pokazywany dalej jako nadchodzący.

Przy okazji: klubowy CEV Beach Volley European Cup (np. Poznań, 26-27.09.2026)
**nie istnieje w VIS**. Wyniki są tylko w `beachevents.cev.eu` jako HTML bez
API, a drużyna to klub z 5-6 zawodnikami, nie para. Odrzucone świadomie - brak
porządnego źródła danych.

## 2026-10-19 -- Nazwa turnieju to szyld, kod typu to numer w KRS

### Problem
Brazylijskie "Beach Elite Itapema" (9582/9583, grudzień 2026) wylądowało w
zakładce National Tours, zamiast w Elite 16. Tak samo trzy turnieje "Beach Elite"
w 2027 i nowy "Beach World Series Dubai" (9584/9585, styczeń 2027). Przy
okazji wyszło odwrotne pudło: CSVP Finals - Iquique (finał touru Ameryki
Południowej) od początku siedział w sekcji Beach Pro Tour: Elite 16.

### Cause
`classifyTournament` decydował po tekście nazwy: "bpt elite", "elite16",
"challenge", "finals". FIVB przemianowało cykl -- "Beach Elite" nie ma już
"BPT" w tytule, a Beach World Series to zupełnie nowa marka, następca Beach
Pro Tour. Tymczasem pole `Type` się nie zmieniło: Itapema ma `51`, dokładnie jak
każde "BPT Elite". Nazwa jest jak szyld nad sklepem, który zmienia się przy
każdym rebrandingu; kod typu jest jak numer w rejestrze, który zostaje.

Reguła "finals" była z kolei za szeroka: miała łapać BPT Finals, a łapała
każdy finał dowolnego touru (CSVP Finals ma kod `7`).

Dodatkowo lokalna `docs/FIVB-API-Documentation.md` miała zamienione 51 i 53
(51 = Futures, 53 = Elite16) -- gdyby ktoś zbudował mapę kodów z dokumentacji
zamiast z danych, pomyliłby Elite z Futures.

### Fix
- `src/lib/fivb/responseParser.ts`: `TIER_BY_TYPE` sprawdzany przed regułami
  tekstowymi -- 3 WorldSeries, 4/5 WorldChamps, 51 Elite16, 52 Challenge,
  53 Futures, 54 Elite16 (Finals zostają w Elite16, bo kalendarz nie ma sekcji
  Finals). Reguła "finals" usunięta.
- Nowa kategoria `WorldSeries`: `types.ts`, sekcja w `TournamentTable.tsx`,
  filtr na `/tournaments`, kolor w `TournamentCard`, ranga w `prominence.ts`.
- Tabela typów w dokumentacji poprawiona i oznaczona, które kody sprawdzone na
  danych 2025-2027.

Dowód: przed zmianą Itapema i Dubai wychodziły z parsera jako National/National,
po -- Elite16/BPT i WorldSeries/BPT; CSVP Finals spadł do National.

### Wzór do zapamiętania / Lekcja
Klasyfikuj po identyfikatorze, który nadaje system, a nie po tekście, który
pisze człowiek. Tekst zostaw jako zapas dla kodów, których jeszcze nie znasz.
I mapę kodów buduj z danych na żywo (zgrupuj cały sezon po `Type`), nie z
dokumentacji -- tutejsza miała błąd w najważniejszych trzech wierszach.

Do sprawdzenia, gdy przyjdzie sezon 2027: czy Beach World Series ma statystyki
(wtedy kod `3` do `STATISTIC_TOURNAMENT_TYPES` w `archive.ts`) i jak wygląda
sekcja "Beach World Series" z prawdziwymi danymi -- dziś strona ładuje tylko
bieżący sezon, więc nikt jej jeszcze nie widział z wierszami.

## 2026-10-19 -- Lista par z VIS: dokumentacja obiecuje więcej, niż API oddaje

### Problem
Budując sekcję "Entry list" chciałem oprzeć podział par na polach, które model
VIS opisuje wprost: `IsInReserve` ("czy para jest w rezerwie"), `StatusText`
(dlaczego się wycofała), `MainDrawSeed` (rozstawienie). Wszystkie trzy wracają
**puste** w każdym sprawdzonym turnieju (Montreal 8982, Alanya 9151, Itapema
9582). Gdyby kod na nich stał, rezerwa byłaby zawsze pusta, a pary z niej
lądowałyby w "Registered".

### Cause
Dokumentacja SDK (`Fivb.Vis.Beach.BeachTeam`) opisuje model po stronie FIVB, a
nie to, co publiczne `GetBeachTeamList` faktycznie serializuje. Pole przyjęte w
`Fields` nie musi wrócić -- to ten sam wzór co `NoPlayer` w statystykach
(przyjmowany, nigdy nie zwracany).

Dwie kolejne niespodzianki z tych samych danych:
- `PositionInReserve` porządkuje rezerwę, ale nie zaczyna się od 1 -- pierwsza
  rezerwowa para Montrealu ma 24. Wygląda na miejsce w ogólnym rankingu
  zgłoszeń, nie w kolejce rezerwowej.
- Futures nie mają `Rank` ani `RankText` w ogóle (Alanya: 0 z 78), choć
  Elite i Challenge mają.

Co natomiast działa i jest wiarygodne: `Status` (BeachTeamStatus 0-5),
`Type` (BeachTeamType 0-10), `EntryPoints`, `PositionInEntry`,
`IsInMainDraw`/`IsInQualification` i pozycje w obu drabinkach. Lista istnieje
długo przed turniejem (Itapema, -51 dni: 41 par), ale same nazwiska --
punkty i przydział przychodzą później, według regulaminu ~28 dni przed.

### Fix
`src/lib/fivb/entryList.ts`: rezerwa rozpoznawana po `PositionInReserve`
(nie po `IsInReserve`), pokazywana z numeracją 1..n w kolejności tego pola;
powód wycofania z kodu `Status`, nie z `StatusText`; kolumna miejsca tylko gdy
jakaś para je ma. Sprawdzone liczbami wyliczonymi niezależnie z surowego XML:
Montreal 16/12/11/39 (+2 usunięte), Alanya 16/12/20/24 (+6), Itapema 41.

### Wzór do zapamiętania / Lekcja
Zanim oprzesz logikę na polu z dokumentacji VIS, poproś o nie na dwóch-trzech
prawdziwych turniejach i policz, ile wierszy ma je niepuste. "Udokumentowane"
znaczy tu "istnieje w modelu FIVB", nie "dostaniesz je przez API".

Do sprawdzenia po 2026-11-11 (Itapema przekroczy -28 dni): czy i kiedy
dochodzą punkty wejściowe i przydział -- dziś nie było żadnego turnieju BPT w
oknie, w którym dałoby się to zobaczyć.

## 2026-10-19 -- Status "trwa" przed startem i dwa domknięte przypadki z 09-26

### Problem
Igrzyska Olimpijskie Młodzieży 2026 (9530/9531, start 31.10) wisiały na liście
jako trwające i `/api/live` co 25 s ciągnął ich mecze -- dwa tygodnie przed
pierwszym gwizdkiem. VIS ma dla nich `Status="6"`.

### Cause
Lustro przypadku z 09-26: tam organizator zapomniał zamknąć turniej, tu otworzył
go za wcześnie. Poprawka `341b7e5` patrzyła tylko na datę końca. Pomiar całego
sezonu 2026 przy okazji zamknął dwie zaległości z tamtego wpisu:
- kod `10` to w praktyce "odwołany" -- w latach 2024-2026 56 turniejów, żaden
  z zakończonym meczem, prawie połowa ma "CANCELLED" w tytule (CNVP Formentera
  też tu jest);
- kod `1` po dacie końca to 39 turniejów w 2026, wszystkie bez jednego meczu w
  VIS. Część odwołana ("Cancelado"), część pewnie się odbyła, tylko wyniki nie
  trafiły do VIS (Czech National Tour, mistrzostwa Włoch).

Miernik sprawdzony na znanym przypadku, zanim uwierzyłem w "0 meczów": 9094 dał
103/103, jak w wpisie z 09-26.

### Fix
`src/lib/fivb/responseParser.ts` `mapTournamentStatus` (`f7da84a`): kod 2-6 z
pierwszym dniem kwalifikacji później niż jutro UTC -> upcoming; kod 10 ->
cancelled; kod 1 po dacie końca -> finished. Pierwszy dzień liczony od
kwalifikacji, nie od drabinki głównej -- turniej w kwalifikacjach naprawdę już
trwa. Dzień zapasu w obie strony; świadomy koszt: YOG pokaże się jako trwający
od 30.10.

Kod 1 po końcu -> finished, nie cancelled: "odwołany" byłby kłamstwem dla
turniejów, które się odbyły bez wyników w VIS; "zakończony" mówi tylko tyle,
ile wiemy -- że termin minął.

### Wzór do zapamiętania / Lekcja
Ręcznie ustawiany status jest nieaktualny w obie strony, więc data musi go
ograniczać z obu końców, nie tylko z jednego. Naprawiając jedną stronę,
sprawdź od razu drugą -- 09-26 by to wyłapało. Zostają kody `9` i `11`
(2025: 2 i 6 turniejów), które dalej dają `unknown`.
