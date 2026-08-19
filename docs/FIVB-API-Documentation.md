# FIVB VIS API Documentation

**Local documentation for Beach Volley Results plugin**
**Last updated:** 2025-12-11
**Source:** Official FIVB VIS SDK Documentation + API testing

---

## Official Documentation Links

- **VIS SDK Overview:** https://www.fivb.org/Vissdk/#VisSdk.html
- **VIS Web Service:** https://www.fivb.org/VisSDK/VisWebService/#Introduction.html
- **Data Model Reference:** https://www.fivb.org/VisSDK/Fivb.Vis.Model/#Fivb.Vis.Model.html

> **Note:** These pages use JavaScript frameworks - content loads dynamically. If inaccessible, use this local documentation.

---

## API Endpoint

```
POST https://www.fivb.org/vis2009/XmlRequest.asmx
Content-Type: text/xml; charset=utf-8
```

---

## Request Format

### Basic Structure
```xml
<?xml version="1.0" encoding="utf-8"?>
<Request Type="RequestTypeName" Fields="Field1 Field2 Field3" />
```

### With Parameters (Single Item Requests)
For requests fetching single items (GetBeachTournament, GetBeachMatch, GetBeachTeam):
```xml
<?xml version="1.0" encoding="utf-8"?>
<Request Type="GetBeachMatch" No="12345" Fields="Field1 Field2" />
```

### With Filter Element (List Requests)
**IMPORTANT:** For list requests (GetBeachMatchList, GetBeachTeamList), filters MUST be child elements:
```xml
<?xml version="1.0" encoding="utf-8"?>
<Request Type="GetBeachMatchList" Fields="No TeamAName TeamBName Status">
    <Filter NoTournament="502"/>
</Request>
```

### Batch Requests (Multiple queries)
```xml
<?xml version="1.0" encoding="utf-8"?>
<Requests>
    <Request Type="GetBeachTournament" No="502" Fields="No Title"/>
    <Request Type="GetBeachMatchList" Fields="No Status">
        <Filter NoTournament="502"/>
    </Request>
</Requests>
```

### Parameter Rules
- Single item requests: Parameters as XML attributes (`No="123"`)
- List requests: Filter parameters as child `<Filter>` element
- Parameter names use PascalCase (e.g., `NoTournament`, `StartDate`)
- Fields are space-separated strings
- **No BeachTournamentFilter exists** - GetBeachTournamentList returns ALL tournaments (~8600+)

---

## Beach Volleyball Request Types

### 1. GetBeachTournamentList
Returns list of all beach volleyball tournaments.

**Parameters:** None required

**Example:**
```xml
<Request Type="GetBeachTournamentList"
    Fields="No Title Code StartDate EndDate CountryCode CountryName Gender Type Status" />
```

**Response:**
```xml
<BeachTournaments NbItems="8659" Version="103392">
    <BeachTournament No="1234" Title="Paris Elite16" Code="BPARI16M"
        StartDate="2025-06-11" EndDate="2025-06-15"
        CountryCode="FRA" CountryName="France"
        Gender="0" Type="53" Status="1" Version="12345"/>
</BeachTournaments>
```

---

### 2. GetBeachTournament
Returns single tournament details.

**Parameters:**
- `No` (required) - Tournament number

**Example:**
```xml
<Request Type="GetBeachTournament" No="1234"
    Fields="No Title Code StartDate EndDate City CountryCode Gender Type Status" />
```

---

### 3. GetBeachMatchList
Returns list of matches filtered by tournament.

**Filter Parameters (as child `<Filter>` element):**
- `NoTournament` (required) - Tournament number

**Example:**
```xml
<Request Type="GetBeachMatchList"
    Fields="No NoTournament TeamAName TeamBName PointsTeamASet1 PointsTeamBSet1 Status LocalDate LocalTime">
    <Filter NoTournament="1234"/>
</Request>
```

**Available BeachMatchFilter fields:**
- `NoTournament` - Filter by tournament number
- `Status` - Filter by match status code
- `LocalDate` - Filter by date

---

### 4. GetBeachMatch
Returns single match details.

**Parameters:**
- `No` (required) - Match number

**Example:**
```xml
<Request Type="GetBeachMatch" No="5678"
    Fields="No TeamAName TeamBName PointsTeamASet1 PointsTeamBSet1 PointsTeamASet2 PointsTeamBSet2 Status RoundName" />
```

---

### 5. GetBeachTeamList
Returns list of teams for a tournament.

**Filter Parameters (as child `<Filter>` element):**
- `NoTournament` (required) - Tournament number

**Example:**
```xml
<Request Type="GetBeachTeamList"
    Fields="No Name CountryCode Player1FirstName Player1LastName Player2FirstName Player2LastName">
    <Filter NoTournament="1234"/>
</Request>
```

---

### 6. GetBeachTeam
Returns single team details.

**Parameters:**
- `No` (required) - Team number

---

### 7. GetBeachRoundList
Returns tournament rounds/phases.

**Parameters:**
- `NoTournament` (required) - Tournament number

---

### 8. GetBeachTournamentRanking
Returns tournament final standings.

**Parameters:**
- `NoTournament` (required) - Tournament number
- `Phase` (optional) - Specific phase

---

### 9. GetBeachWorldTourRanking
Returns World Tour rankings.

**Parameters:**
- `Gender` (required) - 0=Men, 1=Women
- `Number` (optional) - Number of results
- `ReferenceDate` (optional) - Date for rankings

---

### 10. GetBeachOlympicSelectionRanking
Returns Olympic qualification rankings.

**Parameters:**
- `Gender` (required) - 0=Men, 1=Women
- `GamesYear` (required) - Olympic year
- `OnlySelected` (optional) - Boolean
- `ReferenceDate` (optional)

---

## Available Fields

### Beach Tournament Fields
```
No, Title, Code, Name, StartDate, EndDate, City, CountryCode, CountryName,
Gender, Type, Status, Season, Version,
StartDateMainDraw, EndDateMainDraw, StartDateQualification, EndDateQualification,
NbTeamsMainDraw, NbTeamsQualification, NbTeamsFromQualification,
MaxTeamsMainDrawFederation, MaxTeamsMainDrawHost,
FederationCode, OrganizerCode, OrganizerType,
WebSite, Logos, Parameters,
DefaultMatchFormat, DefaultTimeZone, DefaultLocalTimeOffset
```

### Beach Match Fields
```
No, NoTournament, NoRound, NoTeamA, NoTeamB,
TeamAName, TeamBName, TeamAFederationCode, TeamBFederationCode,
TeamAText, TeamBText,
PointsTeamASet1, PointsTeamBSet1,
PointsTeamASet2, PointsTeamBSet2,
PointsTeamASet3, PointsTeamBSet3,
PointsTeamASet4, PointsTeamBSet4,
PointsTeamASet5, PointsTeamBSet5,
MatchPointsA, MatchPointsB,
DurationSet1, DurationSet2, DurationSet3, DurationSet4, DurationSet5,
Status, ResultType, ResultTypeText, MatchResultText, SetsResultsText,
LocalDate, LocalTime, LocalTimeOffset, UtcDate, UtcTime, TimeZone,
Court, Venue, City,
RoundName, RoundCode, RoundPhase, RoundBracket,
NoInTournament, NoInTournamentForImages,
TournamentCode, TournamentName, TournamentTitle, TournamentGender, TournamentType,
NoPlayerA1, NoPlayerA2, NoPlayerB1, NoPlayerB2,
NoReferee1, NoReferee2, NoRefereeChallenge,
Referee1Name, Referee2Name, Referee1FederationCode, Referee2FederationCode,
WinnerRank, LoserRank, WinnerRoundRank, LoserRoundRank,
NbSpectators, Temperature, Humidity,
LiveScoreSource, LiveStreamUri, NbLiveScoreUpload,
Format, AcquisitionMethod, AreCourtAndTimePublished,
BeginDateTimeUtc, EndDateTimeUtc,
Version
```

### Beach Team Fields
```
No, NoTournament, Name, CountryCode, FederationCode, ConfederationCode,
NoPlayer1, NoPlayer2,
Player1FirstName, Player1LastName, Player1Birthdate, Player1Height, Player1Weight,
Player1FederationCode, Player1BeachPosition, Player1BirthPlace, Player1TeamName,
Player2FirstName, Player2LastName, Player2Birthdate, Player2Height, Player2Weight,
Player2FederationCode, Player2BeachPosition, Player2BirthPlace, Player2TeamName,
NoShirt1, NoShirt2,
Status, Type, Rank,
IsInMainDraw, IsInQualification, IsInFederationQuota, IsInConfederationQuota,
MainDrawSeed, PositionInMainDraw, PositionInQualification, PositionInEntry,
EntryPoints, TechnicalPoints, SeedTechnicalPoints, QualificationPoints,
WorldTourRanking, FederationRankingPoints,
TournamentCode, TournamentName, TournamentTitle, TournamentType, TournamentStatus,
TournamentSeason, TournamentSeed, TournamentEndDateMainDraw,
EarnedPointsTeam, EarnedPointsPlayer, EarningsTeam, EarningsPlayer,
Version
```

---

## Enum Values (Numeric Codes)

### Gender (VolleyGender enum)
| Code | Value |
|------|-------|
| 0 | Unknown |
| 1 | Men (M) |
| 2 | Women (W) |
| 3 | Both (MW) |

### Tournament Status (VolleyTournamentStatus enum)
| Code | Status | Description |
|------|--------|-------------|
| 0 | NotOpen | Tournament not open yet |
| 1 | Open | Accepting registrations (Upcoming) |
| 6 | Running | **Tournament in progress (LIVE!)** |
| 7 | Finished | Tournament completed |
| 8 | PaymentPending | Payment pending |
| 9 | Paid | Payment completed |

> **Key for live detection:** Status = 6 means tournament is currently running

### Tournament Type (partial list)
| Code | Type |
|------|------|
| 0 | Grand Slam |
| 15 | National Tour |
| 32 | Major Series |
| 33 | World Tour Finals |
| 34 | Continental Championship |
| 35 | Test (**skip these!**) |
| 36 | Snow Volleyball |
| 38-42 | World Tour 5-Star to 1-Star |
| 50 | King of the Court |
| 51 | Beach Pro Tour Futures |
| 52 | Beach Pro Tour Challenge |
| 53 | Beach Pro Tour Elite16 |

### Match Status (BeachMatchStatus enum)
| Code | Status | Category |
|------|--------|----------|
| 1 | Scheduled | Scheduled |
| 2 | ReadyToStart | Break (ready) |
| 3 | InSet1 | **LIVE** |
| 4 | Set1Finished | Break |
| 5 | InSet2 | **LIVE** |
| 6 | Set2Finished | Break |
| 7 | InSet3 | **LIVE** |
| 8 | Set3Finished | Break |
| 9 | InSet4 | **LIVE** |
| 10 | Set4Finished | Break |
| 11 | InSet5 | **LIVE** |
| 12 | Finished | Finished |
| 13 | OfficialResult | Finished |
| 14 | Corrected | Finished |
| 15 | Closed | Finished |

**Live Detection Summary:**
- **LIVE (in set):** 3, 5, 7, 9, 11
- **BREAK (between sets):** 2, 4, 6, 8, 10
- **FINISHED:** 12, 13, 14, 15
- **SCHEDULED:** 1

---

## Important API Behaviors

### 1. No BeachTournamentFilter
**GetBeachTournamentList does NOT support filtering** - it returns ALL tournaments (~8600+).

**Workaround:** Filter data on the PHP side after receiving response:

```php
// API returns all tournaments - must filter in PHP
$tournaments_2025 = array_filter($tournaments, function($t) {
    return $t['season'] === 2025;
});

// Filter running tournaments
$running = array_filter($tournaments, function($t) {
    return $t['status_code'] === 6; // Running
});
```

### 2. Filter Element Format
For list requests that support filtering (GetBeachMatchList, GetBeachTeamList), filters **must be child elements**:

```xml
<!-- CORRECT -->
<Request Type="GetBeachMatchList" Fields="No Status">
    <Filter NoTournament="502"/>
</Request>

<!-- WRONG - will not filter! -->
<Request Type="GetBeachMatchList" NoTournament="502" Fields="No Status"/>
```

### 3. Large Response Sizes
- Tournament list: ~1.6 MB (8600+ tournaments)
- Use `LIBXML_PARSEHUGE` flag when parsing large responses
- **Must cache aggressively** to avoid repeated large downloads

### 4. Response Time
- Typical response: 500-1500ms
- Set appropriate timeout (10-15 seconds)

### 5. Attribute-Based XML
Responses use attributes, not child elements:
```xml
<!-- Response format -->
<BeachTournament No="123" Title="Event Name" StartDate="2025-01-01" />

<!-- NOT this -->
<BeachTournament>
    <No>123</No>
    <Title>Event Name</Title>
</BeachTournament>
```

---

## PHP Implementation Example

### Making a Request
```php
$api_url = 'https://www.fivb.org/vis2009/XmlRequest.asmx';

$xml_request = '<?xml version="1.0" encoding="utf-8"?>
<Request Type="GetBeachTournamentList"
    Fields="No Title Code StartDate EndDate CountryCode CountryName Gender Type Status" />';

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $api_url,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $xml_request,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: text/xml; charset=utf-8',
    ],
    CURLOPT_TIMEOUT => 15,
]);

$response = curl_exec($ch);
curl_close($ch);
```

### Parsing Response
```php
$xml = simplexml_load_string($response);

foreach ($xml->xpath('//BeachTournament') as $tournament) {
    $data = [
        'id' => (int) $tournament['No'],
        'title' => (string) $tournament['Title'],
        'start_date' => (string) $tournament['StartDate'],
        'gender' => (int) $tournament['Gender'] === 0 ? 'M' : 'W',
        'type' => (int) $tournament['Type'],
        'status' => (int) $tournament['Status'],
    ];
}
```

---

## Recommended Cache Strategy

| Data | TTL | Reason |
|------|-----|--------|
| Tournament list | 6 hours | Large data, rarely changes |
| Single tournament | 2 hours | Semi-static |
| Match list (finished) | 24 hours | Never changes |
| Match list (live) | 30 seconds | Real-time updates |
| Team data | 24 hours | Static during tournament |
| Rankings | 1 hour | Changes daily at most |

---

## Testing the API

Use `test-api.php` in project root to verify API access:

```bash
php test-api.php
```

Expected output:
- HTTP 200 response
- XML with BeachTournament elements
- Parsed tournament data
