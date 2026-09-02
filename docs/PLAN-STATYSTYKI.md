# Plan: statystyki zawodników z FIVB VIS

**Status**: zatwierdzony, gotowy do implementacji
**Data ustalenia**: 2026-09-02
**Weryfikacja empiryczna kodu i API**: 2026-09-02 (sekcja 10 — log sond)
**Prototyp**: https://claude.ai/code/artifact/d874e600-16e7-4f9c-b31e-15f95360b833

Ten dokument jest samodzielny — nowa sesja nie potrzebuje wcześniejszej rozmowy.
Wszystkie liczby poniżej są zweryfikowane empirycznie na żywym API, nie założone.

---

## 1. Odkrycie, na którym stoi cały plan

FIVB VIS ma nieudokumentowany w `RequestList` typ requestu **`GetBeachStatisticList`**,
dostępny publicznie, bez autoryzacji. Zwraca statystyki per zawodnik per mecz.

```xml
POST https://www.fivb.org/vis2009/XmlRequest.asmx
Content-Type: text/xml; charset=utf-8

<Request Type="GetBeachStatisticList" SumBy="Match" Fields="...">
  <Filter NoTournaments="9229"/>
</Request>
```

**Kluczowe**: filtr `NoTournaments` z `SumBy="Match"` zwraca **cały turniej jednym
requestem** (48 meczów, 284 rekordy, ~150 KB przy pełnym zestawie pól). Nie trzeba
odpytywać mecz po meczu.

### Parametry

| Parametr | Wartości | Uwagi |
|---|---|---|
| `SumBy` | `Set`, `Match`, `Tournament` | można łączyć: `SumBy="Match Set"` |
| `Include` | `Players`, `PlayersSumByTeam`, `Teams` | domyślnie tylko zawodnicy |
| `Filter NoTournaments` | lista numerów oddzielona spacją | |
| `Filter NoMatches` | lista numerów oddzielona spacją | |
| `Filter NoPlayer` | jeden numer | **działa tylko w kombinacji** z powyższymi |

Działa też przez GET (`?Request=<url-encoded>`) i zwraca JSON przy nagłówku
`Accept: application/json`.

### PUŁAPKA: User-Agent (dotyczy tylko Pythona)

FIVB **blokuje domyślny User-Agent Pythona** (`Python-urllib/x.y`) — zwraca HTTP 403.
Research był robiony z Pythona i stąd ta pułapka.

**Z Node'a problemu nie ma**: domyślny User-Agent undici (czyli `fetch` w Next.js
i w skrypcie odpalanym przez `tsx`) dostaje HTTP 200 — sprawdzone na wszystkich
sondach z sekcji 10. W skrypcie backfillu własny UA zostaje jako higiena
(identyfikacja klienta), nie jako warunek działania.

To nie jest rate limit; można pobierać szeregowo bez opóźnień (105 turniejów ≈ 2 minuty).

Ten błąd raz już spowodował fałszywe wnioski — 403 zinterpretowane jako "brak
statystyk" dało zera dla całych sezonów. **Błąd HTTP nigdy nie może być zapisany
jako zero.**

### PUŁAPKA: `GetPlayerList` ignoruje filtr turnieju

`<Request Type="GetPlayerList"><Filter NoTournament="9229"/></Request>` **nie filtruje** —
zwraca cały rejestr FIVB: **13,2 MB, 131 091 zawodników** (zmierzone). Żaden route ani
komponent nie może tego wołać. `data/players.json` (Etap 2) składa się z list drużyn
(`GetBeachTeamList` per turniej), nigdy z `GetPlayerList`.

---

## 2. Zakres danych (zweryfikowany)

| Typ turnieju | `Type` | Turnieje 2022–26 (M) | Statystyki |
|---|---|---|---|
| Elite16 | 51 | 104 | tak |
| Challenge | 52 | 92 | tak |
| Pro Tour Finals | 54 | 6 | tak |
| Mistrzostwa Świata | 4 | 6 | tak |
| Igrzyska | 5 | 2 | tak |
| **Futures** | **53** | **302** | **1 mecz w sumie — wykluczyć** |

Przeskanowano wszystkie 302 turnieje Futures 2022–2026: statystyki ma dokładnie
jeden mecz (Madryt 2022, `MMAD2022`). Traktować jako szum.

**Pokrycie w obrębie kwalifikujących się turniejów: 5430 / 5836 meczów = 93,0%.**

| Sezon | Pokrycie |
|---|---|
| 2022 | 87,9% |
| 2023 | 95,0% |
| 2024 | 94,9% |
| 2025 | 96,0% |
| 2026 | 90,7% |

Rozkład: 25 turniejów ma 100%, 52 ma 90–99%, 19 ma 50–89%, **1 ma 7%**
(Gstaad 2022 — tylko półfinały i finały, `No=6298`), 8 ma 0% (wszystkie odwołane).

Przed 2022 dane są szczątkowe: MŚ Rzym 2022 i IO Tokio 2020 mają, World Tour Finals
Rzym 2019 ma częściowo, zwykłe turnieje 2019 i wcześniej nie mają.

**Kobiety**: cały powyższy research dotyczy wyłącznie turniejów męskich.
Kobiety wymagają osobnego backfillu (~105 turniejów, podobna skala).

---

## 3. Pola API — co realnie przychodzi

Klasa `VolleyStatistic` deklaruje ponad 100 atrybutów, ale dla plaży FIVB
wypełnia ~28. Sprawdzone na 192 wierszach zawodników (Elite16 Hamburg 2026).

### Identyfikacja wiersza (poprawione po weryfikacji)

```xml
<VolleyStatistic No="262724385" NoItem="156567" ItemType="30"
                 NoMatch="544995" NoTournament="9229" .../>
```

| Atrybut | Znaczenie |
|---|---|
| `No` | id samego rekordu statystyki — bezużyteczne do joinów |
| `NoItem` | **numer zawodnika** (przy `ItemType="30"`) albo numer drużyny (przy `11`) |
| `ItemType` | `30` = zawodnik, `11` = drużyna |
| `NoMatch`, `NoTournament`, `NoSet` | kontekst; `NoSet` tylko przy `SumBy="Set"` |

**`NoPlayer` nie istnieje w odpowiedzi.** Zamówione w `Fields` jest po cichu pomijane —
API nie zgłasza błędu, atrybut po prostu nie przychodzi. Kluczem do zawodnika jest
`NoItem`. To po nim łączy się statystyki ze składem pary (sekcja 5.4).

**Wiersze drużynowe (`ItemType="11"`) są wyzerowane** i mają puste atrybuty
(`NbRallies=""`). `Include="Players Teams"` ich nie wypełnia — sumę pary trzeba liczyć
z dwóch wierszy zawodników. Parser musi mapować `""` na `undefined`, nie na `0`.

### Wypełniane

```
SpikeTotal SpikePoint SpikeFault SpikeContinue
BlockTotal BlockPoint BlockFault BlockContinue
ServeTotal ServePoint ServeFault ServeContinue
ReceptionTotal ReceptionFault ReceptionContinue
DigTotal DigExcellent DigFault DigContinue
SetTotal SetFault SetContinue
PointTotal AttemptTotal FaultTotal NbRallies
ScorerTotalAttempts ScorerTotalFaults NbMatches NbSets
```

### Zawsze puste (nie używać)

```
ReceptionExcellent  TeamFault  OpponentError  TimePlayed
SpikeKey BlockKey DigKey ServeKey SetKey
SpikeSideOut BlockSideOut SpikeFaultSideOut
BackSpike*   (pojęcia halowe)
*Percentage  *Average*   (tylko przy SumBy="Tournament")
```

### Tożsamości zweryfikowane na 192/192 wierszach

```
SpikeTotal      = SpikePoint + SpikeFault + SpikeContinue
BlockTotal      = BlockPoint + BlockFault + BlockContinue
ServeTotal      = ServePoint + ServeFault + ServeContinue
ReceptionTotal  = ReceptionFault + ReceptionContinue
DigTotal        = DigExcellent + DigFault + DigContinue
PointTotal      = SpikePoint + BlockPoint + ServePoint
```

Dzięki temu można pokazać rozkład zakończeń każdej akcji bez żadnych założeń.

**Uwaga o obronie i przyjęciu**: nie dają punktu. `DigExcellent` to "piłka
wybroniona czysto", nie punkt. Przyjęcie nie ma w ogóle oceny pozytywnej.

---

## 4. Definicje wskaźników (ustalone, nie zmieniać bez migracji agregatów)

Terminologia zgodna z polskimi portalami siatkarskimi
([vispolska.pl](https://www.vispolska.pl/siatkarskie-statystyki-jak-odczytywac-i-interpretowac-liczby/),
[siatkowkaokiemstatystyka.pl](https://www.siatkowkaokiemstatystyka.pl/efektywnosc-czym-jest-i-dlaczego-jest-wazna/)):

```
skuteczność ataku = SpikePoint / SpikeTotal * 100            (zawsze dodatnia)
efektywność ataku = (SpikePoint - SpikeFault) / SpikeTotal * 100   (MOŻE BYĆ UJEMNA)
skuteczność bloku = BlockPoint / BlockTotal * 100
ryzyko serwisu    = (ServePoint + ServeFault) / ServeTotal * 100
błędy przyjęcia   = ReceptionFault / ReceptionTotal * 100
```

`SpikeFault` **już zawiera ataki zablokowane** — zweryfikowane na 96/96 meczów
(błędy ataku jednej pary zawsze ≥ bloki punktowe drugiej). Dlatego efektywność
odpowiada halowemu wzorowi `(kille − błędy − zablokowane) / ataki` bez korekty.

### Punkty z błędów rywala

API **nie podaje tego wprost**, a sumowanie `FaultTotal` rywala **nie zadziała** —
zablokowany atak jest tam liczony dwa razy (jako błąd atakującego i punkt
blokującego), podobnie as i błąd przyjęcia.

Właściwe liczenie to **reszta**:

```
punkty_z_błędów_rywala = suma_punktów_drużyny_z_setów - (PointTotal gracza + PointTotal partnera)
```

Zweryfikowane na 1597 meczach: 0 braków, 0 wartości ujemnych.
Typowo 22–27% punktów drużyny, mediana 11,2 na mecz (zakres 9,5–13,6).

Wymaga: `GetBeachMatchList` (wyniki setów) + `GetBeachTeamList` (skład pary).

---

## 5. Jakość danych — co obsłużyć w kodzie

### 5.1 Zero ≠ brak danych (najważniejsze)

Dla niestatystykowanych meczów API zwraca **poprawną odpowiedź z wyzerowanymi
polami**, nie błąd. Mecz jest niestatystykowany, gdy:

```js
spikeTotal === 0 && receptionTotal === 0 && serveTotal === 0
```

Takie rekordy **muszą** być odróżnione typem (`PlayerMatchStats[] | null`), nie
pustą tablicą, i wykluczone ze wszystkich mianowników. Inaczej średnie kariery
będą zaniżone, a UI pokaże "0 bloków" zamiast "nie mierzono".

**Filtr stosuje się wyłącznie do wierszy `ItemType="30"`.** Wiersze drużynowe (`11`)
są wyzerowane zawsze, także dla meczów w pełni statystykowanych — wrzucone do tego
testu zaklasyfikowałyby każdy mecz jako niemierzony.

### 5.2 Turnieje z niepełnym zapisem

19 turniejów ma 50–89% meczów ze statystykami, Gstaad 2022 ma 7%.
**Nie usuwać** — te mecze, które mają dane, są poprawne (sprawdzone: 21–45 ataków,
228–337 wymian). Oznaczyć w UI, że agregat turniejowy nie obejmuje całego turnieju.

### 5.3 Małe mianowniki

48 meczów w próbie 8 zawodników ma < 10 ataków jednego zawodnika. **To nie są
zepsute dane** — 21 z nich należy do Andersa Mola, blokującego, który realnie mało
atakuje (mediana: 277 wymian, 13 kontaktów bloku, 12 punktów w takim meczu).

Zasada: **liczby bezwzględne liczą się zawsze, procenty tylko przy sensownym
mianowniku.** Progi w prototypie: `spikeTotal >= 10` dla rozkładu meczowego,
`spikeTotal >= 20` dla punktu turniejowego na wykresie.

Naprawdę zepsuty jest 1 mecz na 1597: Grimalt, IO Paryż 2024, 0 akcji i 0 wymian
(walkower). Łapie go filtr z 5.1.

### 5.4 Dopasowanie zawodnika do drużyny

**Nie po nazwisku.** W tourze jest dwóch Molów (Anders i Hendrik) i dwóch
Grimaltów. Dopasowywać po `NoPlayer1`/`NoPlayer2` z `GetBeachTeamList`, a po stronie
statystyk po `NoItem` (nie `NoPlayer` — patrz sekcja 3):

```js
const playerId = statRow.NoItem;            // wiersz z ItemType === "30"
const side = ['A','B'].find(s =>
  [teams[match['NoTeam'+s]].NoPlayer1, teams[match['NoTeam'+s]].NoPlayer2].includes(playerId));
```

**Nazwiska** biorą się z tego samego requestu — `GetBeachTeamList` zwraca
`Player1FirstName Player1LastName Player2FirstName Player2LastName` (zweryfikowane).
`PlayerAName`/`PlayerBName`, których używa dzisiejszy `RequestBuilder.getTeam`, są
w liście drużyn pomijane. Jeden request na turniej daje więc komplet: rozstawienie
(już używane), skład par i nazwiska.

Po tej zmianie: 0 nieustalonych stron na 1597 meczów. Wcześniejsze dopasowanie
po nazwisku dawało bilanse typu Ehlers 78–114 zamiast 116–76.

### 5.5 Kwalifikacje

Rundy `Round 1`, `Round 2`, `Lucky losers` **zostają** — to część turnieju.
Zawodnik, który odpadł w kwalifikacjach, ma turniej z jednym meczem i to jest
poprawne. Musi mieć wynik, nie `0-0`.

---

## 6. Plan wdrożenia

### Etap 1 — warstwa danych + widok meczu

Fundament. Tu leży całe ryzyko: definicje wskaźników i obsługa braku danych.

**Pliki:**
- `src/lib/fivb/types.ts` — `PlayerMatchStats`, `TeamPointBreakdown`, skład pary.
  Statystyki jako `PlayerMatchStats[] | null` (null = niemierzone).
- `src/lib/fivb/requestBuilder.ts` — `getMatchStatistics(matchNo)`,
  `getTournamentStatistics(tournamentNo)`; rozszerzyć `getTeamList` o
  `NoPlayer1 NoPlayer2 Player1FirstName Player1LastName Player2FirstName Player2LastName`.
- `src/lib/fivb/responseParser.ts` — parser `VolleyStatistic`, filtr `ItemType="30"`
  (zawodnicy; `11` to drużyny), pusty atrybut → `undefined`, zwraca `null` gdy
  wszystkie sumy zawodników = 0; parser składu par obok `parseTeamSeeds`.
- `src/lib/fivb/statistics.ts` — **nowy**: wzory z sekcji 4 w jednym miejscu.
- `src/lib/fivb/client.ts` — metoda w `globalCache.getOrSet()`.
- `src/app/api/matches/[id]/route.ts` — jeden endpoint zwracający
  `{ match, roster, stats }`; `force-dynamic` + `s-maxage`.
- `src/components/MatchTable.tsx` — wiersz i karta meczu stają się linkiem.
- Komponenty widoku meczu.

**Prerequisite — dwa zepsute buildery w `requestBuilder.ts`** (dziś martwy kod, nikt
ich nie woła, ale widok meczu sięgnie po pierwszy z nich):
- `getMatch` (`requestBuilder.ts:26`) wkłada `No` do `<Filter>` → HTTP 400
  `ParameterMissing No`. Zapytania o pojedynczy obiekt biorą `No` jako atrybut
  `<Request>`: `<Request Type="GetBeachMatch" No="544995" Fields="..."/>`.
- `getTeam` (`requestBuilder.ts:37`) prosi o `PlayerAName`/`PlayerBName`, które API
  pomija — te dane są w liście drużyn (sekcja 5.4).

**Skąd status meczu dla TTL**: `globalCache.getOrSet` przyjmuje stały TTL, więc nie da
się wybrać 25 s vs 3600 s bez znajomości statusu. Stąd jeden endpoint: najpierw mecz
(status), potem statystyki z TTL dobranym do statusu.

**Cache** (zgodnie z tabelą w CLAUDE.md):

| Dane | `globalCache` TTL | `s-maxage` |
|---|---|---|
| Statystyki meczu w trakcie | 25 s | 25 s |
| Statystyki meczu zakończonego | 3600 s | 1800 s |

**Widok meczu, desktop**: tabela — wiersze to statystyki, kolumny to zawodnik ×
(set 1..n, mecz). Kolumny setowe z `SumBy="Set"` (atrybut `NoSet`), kolumna meczowa
z `SumBy="Match"` — jeden request `SumBy="Match Set"` daje oba.

**Bez średnich w Etapie 1.** Średnia sezonowa w nawiasie pod wartością meczową wymaga
zagregowanej bazy, która powstaje dopiero w Etapie 2 — dokładana tam, nie tutaj.
Etap 1 pokazuje wyłącznie liczby z tego meczu.

**Widok meczu, mobile (< 720px)**: cztery karty zawodników jedna pod drugą,
statystyki pionowo, sety w kolumnach. Nie próbować mieścić szerokiej tabeli.

**Degradacja**: gdy statystyk brak — pokazać istniejący widok (wynik, sety, czas,
sędziowie) plus jawny komunikat "ten mecz nie był statystykowany". Nie pustą
tabelę zer. Trafi się to średnio raz na 14 meczów.

**Wejście**: klik w wiersz meczu na stronie turnieju → `/tournaments/[id]/match/[matchNo]`.
Wiersze `MatchTable` nie są dziś linkami — trzeba je opakować (desktop: wiersz tabeli,
mobile: karta).

**CLAUDE.md**: tabela cache w PART 2 dostaje wiersz dla statystyk meczu — reguła
projektu mówi, że obie kolumny (TTL i `s-maxage`) rusza się razem.

### Etap 2 — backfill do plików statycznych

- `scripts/backfill-stats.ts` — szeregowo, **z własnym User-Agent**, po liście
  turniejów typu 51/52/54/4/5. Idempotentny.
- Błąd HTTP przerywa i loguje — **nigdy nie zapisuje się jako zero**.
- Wynik: `data/stats/{tournamentNo}.json` + `data/players.json` (nr → nazwisko, kraj),
  ten drugi składany z list drużyn, nigdy z `GetPlayerList` (sekcja 1).
- **Średnie sezonowe do widoku meczu** (przeniesione z Etapu 1): agregat per zawodnik
  per sezon liczony z plików, dołożony do widoku meczu jako wartość w nawiasie pod
  liczbą meczową. Mianownik obejmuje wyłącznie mecze statystykowane (sekcja 5.1),
  a procent pokazuje się tylko przy progach z sekcji 5.3.

**Dlaczego pliki, nie baza**: zmierzone ~11,6 KB JSON na turniej (3,8 KB gzip),
czyli ~2,5–3 MB na 210 turniejów męskich. Dane historyczne są niezmienne.
Vercel Hobby, zero zmiennych środowiskowych. Baza byłaby uzasadniona przy
~100 MB albo zapisach z runtime.

Bieżący sezon dociągać z API na żywo, archiwum z plików.

### Etap 2b — aktualizacja bazy o nowe turnieje

Dane dzielą się na trzy warstwy o różnej zmienności. To jest sedno projektu
aktualizacji — nie ma sensu traktować ich jednakowo.

| Warstwa | Co to | Skąd | Odświeżanie |
|---|---|---|---|
| **Archiwum** | turnieje zakończone > 7 dni | pliki w repo | nigdy |
| **Świeże** | zakończone < 7 dni | pliki w repo | 1× w tygodniu, potem zamrożone |
| **Na żywo** | turniej w trakcie | API przy requeście | TTL 25 s + `s-maxage` |

**Dlaczego archiwum można zamrozić na zawsze**: luki w pokryciu są **strukturalne,
nie czasowe**. Zweryfikowane na dwóch turniejach o najniższym pokryciu:
Xiamen 2026 — wszystkie 30 brakujących meczów to `Round 1` (kwalifikacje nie są
statystykowane); Bhubaneswar 2026 — po 1–2 mecze z każdej grupy (boczne korty).
Najnowszy turniej w bazie (Montreal, 20.08.2026) miał 100% pokrycia od razu.
Ponowne pobranie zakończonego turnieju nie doda danych.

Tydzień karencji jest na ewentualne korekty protokołu, nie na dosyłanie braków.

#### Mechanizm: GitHub Actions cron

Repo jest już na GitHubie z auto-deployem na Vercel, więc naturalny jest workflow,
który commituje zmiany — Vercel przebuduje się sam.

```yaml
# .github/workflows/update-stats.yml
on:
  schedule: [{ cron: '0 4 * * 1' }]   # poniedziałek 04:00 UTC
  workflow_dispatch:                  # + ręczne odpalenie
```

Kroki: pobierz listę turniejów bieżącego sezonu (`GetBeachTournamentList`) →
znajdź zakończone, których nie ma w `data/stats/` → pobierz je → zapisz pliki →
odśwież `data/players.json` → commituj **tylko jeśli coś się zmieniło**.

Wymagania dla skryptu:
- własny User-Agent (patrz sekcja 1 — inaczej 403)
- **błąd HTTP przerywa job**, nigdy nie zapisuje pustego pliku
- brak zmian = brak commita (żeby nie generować pustych deployów)
- turniej trafia do archiwum dopiero, gdy ma jakiekolwiek statystyki — turniej
  odwołany albo bez zapisu zostaje pominięty i sprawdzony ponownie za tydzień

Koszt: ~2 minuty na przebieg, ~8 minut miesięcznie. Darmowy limit GitHub Actions
dla repo prywatnego to 2000 minut/miesiąc.

#### Czego nie użyć

**Vercel Cron nie zadziała** do tego zadania: funkcja serverless ma system plików
tylko do odczytu i nie może commitować do repo. Wymagałaby zewnętrznego storage,
co burzy założenie „bez bazy danych".

#### Nowy sezon

Lista turniejów sezonu jest pobierana za każdym przebiegiem, więc nowy sezon
podłącza się sam. Jedyne, co wymaga ręcznej decyzji, to rozszerzenie filtra typów,
gdyby FIVB dodał nową kategorię rozgrywek (obecnie: 51, 52, 54, 4, 5).

### Etap 3 — zakładka zawodników

- Agregacja przy buildzie: średnie per zawodnik, per sezon, per typ turnieju.
- Wyszukiwarka z podpowiadaniem po literach, **w całości po stronie klienta**
  (lista ~400–600 zawodników to < 200 KB, zero zapytań do API).
- Strona zawodnika: kariera, forma turniej po turnieju, percentyle na tle czołówki.
- **Mały druk u góry, obowiązkowo**: zakres danych (Elite16, Challenge, Finals,
  MŚ, IO od 2022) i informacja, że **Futures nie mają statystyk**. Bez tego
  pierwszy użytkownik profilu zawodnika grającego Futures uzna, że apka nie działa.

### Etap 4 — kobiety

Osobny backfill, ~105 turniejów. Podwaja bazę do ~6 MB. Ta sama logika, inny
filtr płci (`Code` zaczynający się od `W`, `Gender=2`).

---

## 7. Czego nie robić na starcie

Porównywarka dwóch zawodników i przełącznik metryk na wykresie są w prototypie,
ale zwiększają powierzchnię błędu. Dołożyć, gdy podstawa się przyjmie.

---

## 8. Ryzyka

- `GetBeachStatisticList` jest nieudokumentowany w publicznym `RequestList`
  (choć opisany w SDK `Fivb.Vis.DataWPF`). FIVB może go zmienić. Backfill do
  plików jest zabezpieczeniem — raz pobrane dane historyczne zostają.
- Przebiegu punktowego (drabinki punkt po punkcie) **nie da się pobrać wstecz**.
  Sprawdzone: `GetBeachLive` i model `BeachMatch` nie zawierają sekwencji akcji.
  Jeśli kiedyś ma być wykres przebiegu seta — trzeba zbierać samemu od teraz,
  odpytując w trakcie meczu.
- Rate limit przy live nie został przetestowany podczas realnego turnieju
  z kilkoma meczami naraz. TTL + `s-maxage` powinny wystarczyć, ale zweryfikować.

---

## 9. Przydatne numery do testów

| Co | Numer |
|---|---|
| Elite16 Hamburg 2026 (turniej) | `9229` |
| Półfinał Ehlers/Wüst – Plavins/Fokerots | `544992` |
| Finał Ehlers/Wüst – Mol/Sørum | `544995` |
| Gstaad 2022 (turniej z 7% pokrycia) | `6298` |
| Michał Bryl (zawodnik) | `137237` |
| Bartosz Łosiak | `122846` |

---

## 10. Log weryfikacji empirycznej (2026-09-02)

Sondy z Node'a (`fetch`, domyślny User-Agent undici) przeciw
`https://www.fivb.org/vis2009/XmlRequest.asmx`. Wszystkie surowe odpowiedzi
sprawdzone, nie streszczone.

| Sonda | Wynik |
|---|---|
| `GetBeachStatisticList` `SumBy="Match"` `NoTournaments="9229"` | HTTP 200, **284 wiersze, 102 110 B, 249 ms** — zgadza się z sekcją 1 |
| `GetBeachStatisticList` `SumBy="Match"` `NoMatches="544995"` | HTTP 200, `NbItems="6"` (4 × `ItemType="30"`, 2 × `"11"`) |
| `GetBeachStatisticList` `SumBy="Set"` `NoMatches="544995"` | HTTP 200, `NbItems="12"`, atrybut `NoSet` obecny |
| `Fields="... NoPlayer ..."` | atrybut **nie wraca** — identyfikacja przez `NoItem` |
| `GetBeachTeamList` `NoTournament="9229"` + pola zawodników | HTTP 200, 81 drużyn, `NoPlayer1/2` i `Player1/2FirstName/LastName` obecne |
| `GetBeachMatch` z `No` w `<Filter>` | **HTTP 400 `ParameterMissing No`** — patrz Etap 1, prerequisite |
| `GetBeachTeam No="3165799"` (No jako atrybut Request) | HTTP 200 |
| `GetPlayerList` z `<Filter NoTournament>` | HTTP 200, **13 195 182 B, 131 091 zawodników** — filtr ignorowany |

Kontrola tożsamości z sekcji 4 na wierszu `No="262724385"` (finał Hamburg 2026):
`SpikeTotal 20 = SpikePoint 12 + SpikeFault 4 + SpikeContinue 4`,
`PointTotal 22 = SpikePoint 12 + BlockPoint 9 + ServePoint 1`. Wzory stoją.

Stan kodu w repo na dzień weryfikacji: z `RequestBuilder` używane są tylko
`getTournamentList`, `getMatchList`, `getTeamList` (`client.ts:49,69,89`);
`getMatch` i `getTeam` to martwy kod z błędami opisanymi w Etapie 1.
