# Plan: lista zgłoszonych par na stronie turnieju

Stan: **wdrożone lokalnie** (2026-10-19), zaakceptowane z linkami do zawodników i zwiniętymi wycofanymi. Linkowani są tylko zawodnicy z `player-index.json` (inni nie mają strony, /players/[no] daje 404).

Poprawki po pierwszym wdrożeniu (właściciel, 2026-10-19): grupy jako zakładki zamiast nagłówków; jedna para w jednej linii; lista wstępna i wycofani sortowani po kodzie federacji, potem po nazwiskach (jak `/players`); bez kolumny Rank i bez dopisku powodu przy wycofanych.

## Cel

Na stronie turnieju widać, kto się zgłosił i gdzie gra: turniej główny,
kwalifikacje, rezerwa, wycofani. Dla nadchodzących turniejów to jest jedyna
treść strony (meczów jeszcze nie ma), a dziś strona jest wtedy pusta.

## Co mówi źródło

**Model VIS** (`Fivb.Vis.Beach.BeachTeam`, SDK FIVB,
`https://www.fivb.org/VisSDK/Fivb.Vis.Model/Fivb.Vis.Model~Fivb.Vis.Beach.BeachTeamStatus.html`):

| `Status` | znaczenie | | `Type` | znaczenie |
|---|---|---|---|---|
| 0 | Registered | | 0 | Normal |
| 1 | Deleted | | 1 | WildCard |
| 2 | Withdrawn | | 2 | TechnicalWildCard |
| 3 | WithdrawnWithMedicalCert | | 3 | LateEntry |
| 4 | LateWithdraw | | 4 | Reserve |
| 5 | NoShow | | 5 | HostTeam |
| | | | 6 | QualificationWildCard |
| | | | 7 | Confederation |
| | | | 8/9 | Federation/ConfederationSpot (miejsce z kwoty) |
| | | | 10 | OrganizerVacancy |

**Regulamin** (SOM 2026, wyciąg w `Beach-tournament-platform/docs/reference/fivb/`):
wstępna lista zamyka się 35 dni przed startem kwalifikacji, potwierdzona lista
z punktami wejściowymi 28 dni przed, rozstawienie turnieju głównego Elite 14 dni
przed. Punkty wejściowe = suma punktów obu zawodników (3 najlepsze z 4 ostatnich
turniejów w 365 dniach).

## Co VIS faktycznie zwraca (sprawdzone 2026-10-19)

Zwraca: `Status`, `Type`, `EntryPoints`, `PositionInEntry`, `PositionInReserve`,
`IsInMainDraw`, `IsInQualification`, `PositionInMainDraw`,
`PositionInQualification`, `Rank`, `RankText`.
Puste mimo dokumentacji: `IsInReserve`, `StatusText`, `StatusDate`, `MainDrawSeed`.

| Turniej | etap | par | co jest wypełnione |
|---|---|---|---|
| Beach World Series Dubai 9584 | -93 dni | 0 | nic |
| Beach Elite Itapema 9582 | -51 dni | 41 | tylko nazwy; wszystkie `Status=0`, bez punktów i pozycji |
| Futures Alanya 9151 | zakończony | 78 | wszystko poza `Rank` (Futures nie ma miejsc końcowych) |
| Elite16 Montreal 8982 | zakończony | 80 | wszystko |

Montreal rozkłada się na: turniej główny 16 (11 bezpośrednio + 1 dzika karta +
4 z kwalifikacji), kwalifikacje 12 (przegrani), rezerwa 11, wycofani 39
(27 Withdrawn, 8 z L4, 4 No show), usunięci 2. Razem 80.

**Nie zbadane:** kiedy między -51 a 0 dni VIS wypełnia punkty i pozycje. W
najbliższych 4 tygodniach nie ma żadnego turnieju BPT; Itapema przekroczy
-28 dni 2026-11-11 i wtedy można to sprawdzić.

## Kroki

1. `requestBuilder.getTeamList`: dopisać pola `Status Type EntryPoints
   PositionInEntry PositionInReserve Rank RankText`.
2. `types.ts` `TeamEntry`: pola `status`, `entryType`, `entryPoints`,
   `positionInEntry`, `positionInReserve`, `rankText`.
   `parseTeamEntries` je czyta.
3. `src/lib/fivb/entryList.ts` (nowy): `groupEntries(entries)` dzieli na grupy:
   - **Main draw**: `IsInMainDraw`, kolejność `PositionInMainDraw`; znacznik
     "Q" dla par z kwalifikacji, "WC" dla `Type` 1/2/6, "Host" dla 5.
   - **Qualification**: tylko `IsInQualification`, kolejność
     `PositionInQualification`.
   - **Reserve**: `Status 0`, poza obiema fazami, kolejność `PositionInReserve`.
   - **Registered** (lista wstępna): `Status 0` i brak jakiejkolwiek pozycji;
     alfabetycznie, z dopiskiem, że kolejność nie jest jeszcze ustalona.
   - **Withdrawn**: `Status` 2/3/4/5 z etykietą powodu. `Status 1` (Deleted)
     pomijamy.
4. Trasa `/api/tournaments/[id]`: zwraca też `entries` (już pobierane przez
   `getMatchesWithSeeds`, cache 3600 s, więc zero dodatkowych zapytań do FIVB).
5. `src/components/EntryList.tsx` (prezentacyjny) + sekcja na stronie turnieju:
   przed startem rozwinięta jako główna treść, w trakcie i po turnieju zwinięta
   pod meczami. Kolumny: pozycja, para, federacja (flaga), punkty wejściowe,
   po turnieju miejsce (`RankText`). UI jest po angielsku: "Entry list".

## Dowód, że działa

- Skrypt na `groupEntries` dla Montrealu 8982 daje dokładnie 16 / 12 / 11 / 39
  (+2 pominięte); przed zmianą funkcja nie istnieje, więc liczby muszą się
  zgadzać z tabelą wyżej, nie tylko "coś zwracać".
- Itapema 9582: 41 par w grupie Registered, pozostałe puste.
- `npm run build`; strona `/tournaments/8982` i `/tournaments/9582` w przeglądarce.

## Decyzje dla właściciela

- Czy pokazywać wycofanych (domyślnie: tak, zwinięci na dole).
- Czy nazwiska linkować do stron zawodników `/players/[playerNo]` (dane są:
  `NoPlayer1/2`).
- Czy przypomnieć o sprawdzeniu Itapemy po 2026-11-11.

## Rozpoznanie: czy sami policzymy punkty wejściowe (2026-10-19)

**Co VIS daje.** Listy par z zakończonych turniejów mają `EarnedPointsPlayer`
(punkty rankingowe zawodnika z tego turnieju) -- także Futures (Mount Maunganui
8940: 28/28 par). Brak tylko w turnieju zakończonym kilka dni temu (Alanya 9151:
0/28; FIVB pewnie jeszcze nie wpisało). Lista par docelowego turnieju ma
`EntryPoints1`/`EntryPoints2` -- oficjalne punkty każdego zawodnika osobno, więc
da się porównywać na poziomie zawodnika.

**Backtest: Elite16 Montreal 8982 (M).** Start kwalifikacji 2026-08-19, punkty
liczone na 2026-07-22 (-28 dni). Wzięte: 58 turniejów mężczyzn z okna 365 dni
(Elite 13, Challenge 10, Futures 34, MŚ 1), 1637 wierszy par, zero pustych
`EarnedPointsPlayer`. Porównanie ze 148 oficjalnymi wartościami zawodników:

| Reguła | zawodnicy dokładnie | pary dokładnie | pary +-50 pkt |
|---|---|---|---|
| 3 najlepsze z 4 ostatnich wyników | 104/148 | 48/74 | 53 |
| j.w. + Futures we własnym kraju tylko gdy podnosi sumę (SOM s. 23) | **108/148** | **51/74** | **57** |
| 3 najlepsze z całego roku (kontrola) | 39/148 | -- | -- |

W wariancie tylko BPT wszystkie 40 różnic są **w dół** (my niżej niż FIVB), żadna
w górę: brakuje wyników, nie liczymy źle tych, które mamy.

Kody krajów: turniej ma ISO-2 (`SE`), para kod FIVB (`SWE`) --
`CountryHelper.getCountryCode` przelicza, ale nie zna `HU`, `BG`, `TH`, `CV`,
`CK`, `BI` (dopisane w skrypcie) ani `01` (Bridlington 9039 -- VIS nie ma tu kodu
kraju). Bridlington kosztował 2 zawodników: Bialokoz/Batrane grają jako `ENG`,
więc to dla nich Futures we własnym kraju (wyjątek `HOST_OVERRIDES` w skrypcie).
Pary z Wielkiej Brytanii mają kody `ENG`/`SCO`, a nie `GBR` -- przy wdrożeniu
mapowanie kraju gospodarza musi to znać.

**Backtest z turniejami homologowanymi (kontynentalne, krajowe).** Wszystkie
pozostałe turnieje tej samej płci z okna, z punktami > 0, liczone "tylko gdy
poprawiają sumę" (jak Futures we własnym kraju). Skrypt:
`npx tsx scripts/research/entry-points-backtest.ts <nr turnieju> [--bpt-only]`
(`scripts/research/entry-points-backtest.ts`; listy par w cache w katalogu
tymczasowym, ponowne uruchomienie nie pyta VIS).

**Jak czytać "tylko gdy poprawiają" -- to rozstrzygnęło wynik.** Wyniki
nieobowiązkowe (homologowane, Futures we własnym kraju) **nie zajmują miejsca**
w "4 ostatnich". Liczy się 3 najlepsze ze zbioru: 4 ostatnie wyniki obowiązkowe
+ każdy wynik nieobowiązkowy rozegrany od najstarszego z tych 4 (przy mniej niż
4 obowiązkowych: wszystkie nieobowiązkowe z roku). Pierwsza wersja skryptu
wstawiała je do czwórki, co wypychało wynik obowiązkowy -- stąd 20 brakujących
zawodników w Montrealu. Przykład: Ranghieri 640 = Alanya 230 + Xiamen 230 +
Cervia 180 (Futures we Włoszech, dochodzi obok czwórki Gstaad/Alanya/Nuvali/Xiamen).

| Turniej | Reguła | turniejów | zawodnicy dokładnie | wyżej niż FIVB | pary dokładnie | pary +-50 pkt |
|---|---|---|---|---|---|---|
| Elite16 Montreal 8982 (M) | tylko BPT | 58 | 116/148 | 0 | 55/74 | 59 |
| Elite16 Montreal 8982 (M) | + homologowane, wersja 1 (w czwórce) | 358 | 128/148 | 0 | 62/74 | 69 |
| Elite16 Montreal 8982 (M) | + homologowane, **obok czwórki** | 358 | **146/148** | 0 | **72/74** | **73** |
| Futures Kraków 9029 (W, kwal. 2026-06-04) | tylko BPT | 54 | 35/70 | 0 | 12/35 | 18 |
| Futures Kraków 9029 (W, kwal. 2026-06-04) | + homologowane, wersja 1 | 367 | 63/70 | 0 | 31/35 | 34 |
| Futures Kraków 9029 (W, kwal. 2026-06-04) | + homologowane, **obok czwórki** | 367 | **69/70** | 0 | **34/35** | 34 |

Odrzucone hipotezy (sprawdzone na tych samych danych): wynik z samych
kwalifikacji tylko gdy poprawia (92/148, 49 za wysoko); 41. miejsce w Challenge
(50 pkt) nie liczy się jako wynik (139/148, 7 za wysoko).

**Drugi błąd skryptu: wiersze z punktami bez flag drabinki.** Toury strefowe
dają punkty wierszom z `IsInMainDraw=0` i `IsInQualification=0` (WEVZA Zonal
Tour Modena 2025: van Werkhoven 108 pkt). Skrypt je odrzucał. Teraz wynikiem
jest każdy wiersz w drabince albo z punktami > 0.

**Backtest na 7 turniejach (stan końcowy, 2026-10-19):**

| Turniej | zawodnicy dokładnie | wyżej niż FIVB | pary dokładnie |
|---|---|---|---|
| Elite16 Montreal 8982 (M) | 147/148 | 0 | 73/74 |
| Elite16 Hamburg 9230 (W) | 146/152 | 4 (+2 do +8) | 72/76 |
| Challenge Alanya 8976 (M) | 168/168 | 0 | 84/84 |
| Challenge Shangluo 8979 (W) | 143/144 | 0 | 71/72 |
| Futures Kraków 9029 (W) | 69/70 | 0 | 34/35 |
| Futures Laginha Beach 9016 (M, CPV) | 74/74 | 0 | 37/37 |
| Futures Brno 9127 (M) | 84/84 | 0 | 42/42 |
| **Razem** | **831/840 (98,9%)** | 4 | **413/420** |

Co zostaje (9 wartości, 7 zawodników):
- **Punkty chronione** (5 wartości, 4 zawodników; nasze za nisko o 628-1168):
  Kropidłowska 132868 (628), McBain 162674 (937, Shangluo i Hamburg),
  Sandra 132846 (1220), George/Pedro 183549 (900). SOM s. 24-26 (urlop
  macierzyński, poważna kontuzja): FIVB bierze **pozycję** zawodnika
  w indywidualnym rankingu wejściowym z poniedziałku po ostatnim turnieju przed
  przerwą i daje mu **punkty osoby na tej pozycji** w poniedziałek tygodnia -28
  dni przed powrotem; po każdym kolejnym turnieju -1/3 sumy startowej plus nowe
  punkty, po 4 turniejach (kontuzja: 3) zero; ważne rok od powrotu.
  Kropidłowska: ostatni turniej 2024-07-14, powrót 2026-05-24; jej własne punkty
  z lipca 2024 to 580, nie 628 -- zgodnie z regułą, bo liczy się pozycja. W naszym
  rankingu kobiet na 2026-05-07 (3086 zawodniczek) 628 stoi na miejscach 142-143.
  Jej pozycji z lipca 2024 nie liczyliśmy -- pełne potwierdzenie otwarte.
- **Hamburg, nadwyżki +2 do +8** (Behlen/Schulz 54 vs 56, Rockova/Dundackova
  100 vs 102 i 10 vs 18): zawodniczki z samymi turniejami krajowymi. Rockova:
  FIVB nie liczy wyniku z Czech National Tour z 2026-07-05, 3 dni przed datą
  odniesienia -- prawdopodobnie punkty wpisane po tej dacie. Bez znaczenia dla
  rozstawienia; otwarte.

Wniosek: regułę mamy. Punktów chronionych nie da się wyliczyć z historii
zawodnika -- trzeba całego rankingu w dwóch datach i wiedzy, kto złożył wniosek
(FIVB tego nie publikuje). Da się je natomiast **wykryć**: przerwa > ~12 miesięcy
w wynikach i powrót -- taki zawodnik wychodzi u nas za nisko, nigdy za wysoko.

**Historia zawodnika jednym zapytaniem:** `GetBeachTeamList` z `<Filter
NoPlayer="..."/>` zwraca wszystkie pary zawodnika (Kropidłowska: 201). Uwaga:
nieznany atrybut filtra (`Player=`) jest ignorowany i zwraca całą bazę (207 tys.
wierszy) -- przy wdrożeniu sprawdzać `NbItems`.

Koszt i ryzyka przed wdrożeniem:
- Jedno przeliczenie to ~360 list par na płeć (pierwsze pobranie kilka minut).
  W aplikacji tylko jako wynik budowany z wyprzedzeniem (jak `data/player-index.json`),
  nie na żądanie.
- Dla przyszłego turnieju liczymy na dziś, a nie na -28 dni: wyniki z ostatnich
  dni mogą nie mieć jeszcze `EarnedPointsPlayer` (Alanya 9151), więc wartość jest
  szacunkiem i musi być tak oznaczona.
- Punkty chronione: oznaczać zawodnika po długiej przerwie zamiast udawać wartość.
