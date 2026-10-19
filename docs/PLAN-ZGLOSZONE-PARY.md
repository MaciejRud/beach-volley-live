# Plan: lista zgłoszonych par na stronie turnieju

Stan: **wdrożone lokalnie** (2026-10-19), zaakceptowane z linkami do zawodników i zwiniętymi wycofanymi. Linkowani są tylko zawodnicy z `player-index.json` (inni nie mają strony, /players/[no] daje 404).

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
