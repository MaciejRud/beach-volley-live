# FIVB VIS API Documentation

> This documentation is compiled from multiple sources (Python/R clients, official FIVB docs snippets, API testing) to serve as local reference for Claude Code.

## API Endpoint

```
POST https://www.fivb.org/vis2009/XmlRequest.asmx
Content-Type: text/xml; charset=utf-8
```

## Request Format

All requests use XML format wrapped in `<Requests>` element. Multiple requests can be batched:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Requests>
  <Request Type="RequestTypeName" 
    Fields="Field1 Field2 Field3"
    Filter="FilterExpression">
  </Request>
</Requests>
```

### Key Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| Type | Yes | Request type name (e.g., `GetBeachTournamentList`) |
| Fields | No | Space-separated list of fields to return (optimization!) |
| Filter | No | Filter expression (e.g., `StartDate>=2025-01-01`) |
| No | Sometimes | Item ID for single-item requests |

---

## Beach Volleyball Requests

### 1. GetBeachTournamentList

Returns list of beach volleyball tournaments.

**Fields available:**
```
No Title Code Name ShortName ShortNameOrName
StartDate EndDate Season
City CountryCode CountryName
Gender Type Status
Actions ContainsLiveScores ContainsMatches ContainsMatchResults
ContainsPlayers ContainsTeams ContainsRanking ContainsStatistics
IsVisManaged IsFreeEntrance PublishOnMsdp
NoEvent NoConfederation NoArticlePresentation
OrganizerCode OrganizerType TeamType
MaxNbTeams MaxNbPlayersO2 MaxNbPlayersO2A MaxNbPlayersO2bis
DeadlineO2 DeadlineO2A DeadlineO2bis
WebSite BuyTicketsUrl
Version
```

**Filter examples:**
```xml
<!-- Season filter -->
Filter="Season=2025"

<!-- Date range -->
Filter="StartDate>=2025-01-01 AND EndDate<=2025-12-31"

<!-- Status filter (4=Finished, could be others) -->
Filter="Status=4"

<!-- Type filter -->
Filter="Type=16"

<!-- Combined -->
Filter="Season=2025 AND Gender=1"
```

**Example request:**
```xml
<Request Type="GetBeachTournamentList" 
  Fields="No Title StartDate EndDate City CountryCode Gender Type Status"
  Filter="Season=2025">
</Request>
```

**Example response:**
```xml
<BeachTournament No="1234" Title="Paris Elite16" City="Paris" 
  CountryCode="FRA" StartDate="2025-06-11" EndDate="2025-06-15" 
  Gender="1" Type="16" Status="2"/>
<BeachTournament No="1235" Title="Doha Elite16" City="Doha"
  CountryCode="QAT" StartDate="2025-02-12" EndDate="2025-02-16"
  Gender="1" Type="16" Status="4"/>
```

---

### 2. GetBeachTournament

Returns single tournament details.

**Request:**
```xml
<Request Type="GetBeachTournament" No="1234"
  Fields="No Title StartDate EndDate City CountryCode Gender Type Status">
</Request>
```

---

### 3. GetBeachMatchList

Returns list of matches for a tournament.

**Fields available:**
```
No NoTournament NoInTournament
TeamA TeamB TeamAName TeamBName TeamANo TeamBNo
TeamACountryCode TeamBCountryCode TeamACountry TeamBCountry
PointsTeamA PointsTeamB DurationSet1 DurationSet2 DurationSet3
Duration MatchPointsA MatchPointsB
Court Round Pool Phase
LocalDate LocalTime DateTimeLocal DateTimeUtc
MatchStatus Status
NoReferee1 NoReferee2 Referee1 Referee2
Weather Temperature Wind
NoPlayersA1 NoPlayersA2 NoPlayersB1 NoPlayersB2
PlayersA1 PlayersA2 PlayersB1 PlayersB2
Version
```

**Filter examples:**
```xml
<!-- By tournament -->
Filter="NoTournament=1234"

<!-- Live matches only -->
Filter="NoTournament=1234 AND MatchStatus=2"

<!-- Finished matches -->
Filter="NoTournament=1234 AND MatchStatus=4"
```

**Example request:**
```xml
<Request Type="GetBeachMatchList" 
  Fields="No TeamAName TeamBName TeamACountryCode TeamBCountryCode PointsTeamA PointsTeamB MatchStatus Round LocalDate LocalTime"
  Filter="NoTournament=1234">
</Request>
```

**Example response:**
```xml
<BeachMatch No="5001" TeamAName="Bryl/Losiak" TeamBName="Mol/Sorum"
  TeamACountryCode="POL" TeamBCountryCode="NOR"
  PointsTeamA="2" PointsTeamB="1" MatchStatus="4"
  Round="Semi Final" LocalDate="2025-06-14" LocalTime="15:30"/>
```

---

### 4. GetBeachMatch

Returns single match with full details including set scores.

**Additional fields for single match:**
```
Set1A Set1B Set2A Set2B Set3A Set3B
DurationSet1 DurationSet2 DurationSet3 Duration
PointsTeamASet1 PointsTeamBSet1 
PointsTeamASet2 PointsTeamBSet2
PointsTeamASet3 PointsTeamBSet3
MatchResultText SetsResultsText
```

**Example request:**
```xml
<Request Type="GetBeachMatch" No="5001"
  Fields="No TeamAName TeamBName TeamACountryCode TeamBCountryCode Set1A Set1B Set2A Set2B Set3A Set3B MatchStatus Round">
</Request>
```

---

### 5. GetBeachTeamList

Returns list of teams (pairs) for a tournament.

**Fields available:**
```
No NoTournament
Name Players Player1 Player2
Player1No Player2No
CountryCode Country
Rank RankSeed EntryType
IsQualifier QualifierRank
Height1 Height2
NoImageFlag
Version
```

**Example request:**
```xml
<Request Type="GetBeachTeamList" 
  Fields="No Name Player1 Player2 CountryCode Rank"
  Filter="NoTournament=1234">
</Request>
```

---

### 6. GetBeachTeam

Single team details.

**Example request:**
```xml
<Request Type="GetBeachTeam" No="9876"
  Fields="No Name Player1 Player2 CountryCode Height1 Height2">
</Request>
```

---

### 7. GetBeachRoundList

Returns rounds/phases of a tournament.

**Fields available:**
```
No NoTournament Name Code
Phase Pool RoundType
StartDate EndDate
NbMatches NbTeams
Status
Version
```

---

### 8. GetBeachTournamentRanking

Returns final ranking of a tournament.

**Fields available:**
```
Position NoTeam Team TeamName
CountryCode Country
Points PrizeMoney
NoPlayer1 NoPlayer2 Player1 Player2
Version
```

**Example request:**
```xml
<Request Type="GetBeachTournamentRanking" 
  Fields="Position TeamName CountryCode Points"
  Filter="NoTournament=1234">
</Request>
```

---

### 9. GetBeachStatisticList (for live data)

Returns live statistics for ongoing matches.

---

## Field Value Mappings

### Gender
```
0 = Unknown/Both
1 = Men
2 = Women
```

### Tournament Type
```
1 = World Championship
2 = Continental Championship
8 = World Tour Finals
10 = Olympics
14 = Challenge
16 = Elite16
17 = Futures
```

### Match Status
```
0 = Unknown
1 = Scheduled
2 = Running (Live)
3 = Completed (Set in progress finished)
4 = Finished
5 = Cancelled
6 = Postponed
```

### Tournament Status
```
0 = Unknown
1 = Planned
2 = Running
3 = Completed
4 = Finished
5 = Cancelled
```

---

## Optimization Tips

### 1. Always Specify Fields
```xml
<!-- BAD: returns ALL fields (huge response) -->
<Request Type="GetBeachTournamentList"/>

<!-- GOOD: only what you need -->
<Request Type="GetBeachTournamentList" 
  Fields="No Title City StartDate EndDate Status"/>
```

### 2. Use Filters
```xml
<!-- BAD: all tournaments ever -->
<Request Type="GetBeachTournamentList"/>

<!-- GOOD: only 2025 season -->
<Request Type="GetBeachTournamentList" 
  Fields="No Title"
  Filter="Season=2025"/>
```

### 3. Batch Requests
```xml
<Requests>
  <Request Type="GetBeachTournamentList" Fields="No Title Status" Filter="Season=2025"/>
  <Request Type="GetBeachMatchList" Fields="No TeamAName TeamBName" Filter="NoTournament=1234 AND MatchStatus=2"/>
</Requests>
```

### 4. Cache Aggressively
- Tournament list: 6+ hours (rarely changes)
- Finished matches: 24+ hours (never changes)
- Live matches: 30 seconds max

---

## Common Response Patterns

### Empty result
```xml
<Responses>
  <!-- No elements = no data matching filter -->
</Responses>
```

### Error response
```xml
<Responses>
  <Error Code="1001" Message="Invalid request type"/>
</Responses>
```

### Large response warning
The API can return very large XML files. Always use Fields to limit data.

---

## PHP Implementation Example

```php
function fivb_request(string $type, array $fields = [], string $filter = ''): array {
    $fieldsStr = implode(' ', $fields);
    
    $xml = '<?xml version="1.0" encoding="utf-8"?>';
    $xml .= '<Requests>';
    $xml .= '<Request Type="' . $type . '"';
    if ($fieldsStr) {
        $xml .= ' Fields="' . $fieldsStr . '"';
    }
    if ($filter) {
        $xml .= ' Filter="' . htmlspecialchars($filter, ENT_QUOTES, 'UTF-8') . '"';
    }
    $xml .= '></Request>';
    $xml .= '</Requests>';
    
    $response = wp_remote_post('https://www.fivb.org/vis2009/XmlRequest.asmx', [
        'headers' => ['Content-Type' => 'text/xml; charset=utf-8'],
        'body' => $xml,
        'timeout' => 15,
    ]);
    
    if (is_wp_error($response)) {
        return ['error' => $response->get_error_message()];
    }
    
    $body = wp_remote_retrieve_body($response);
    $xml = simplexml_load_string($body);
    
    // Convert to array
    $result = [];
    foreach ($xml->children() as $child) {
        $item = [];
        foreach ($child->attributes() as $key => $value) {
            $item[$key] = (string) $value;
        }
        $result[] = $item;
    }
    
    return $result;
}

// Usage
$tournaments = fivb_request(
    'GetBeachTournamentList',
    ['No', 'Title', 'City', 'CountryCode', 'StartDate', 'EndDate', 'Status'],
    'Season=2025'
);
```

---

## Testing the API

### Simple cURL test:
```bash
curl -X POST "https://www.fivb.org/vis2009/XmlRequest.asmx" \
  -H "Content-Type: text/xml; charset=utf-8" \
  -d '<?xml version="1.0" encoding="utf-8"?><Requests><Request Type="GetBeachTournamentList" Fields="No Title City" Filter="Season=2025"></Request></Requests>'
```

### PHP test script:
```php
<?php
// test-api.php - run on your server to verify API access

$xml = '<?xml version="1.0" encoding="utf-8"?>
<Requests>
  <Request Type="GetBeachTournamentList" 
    Fields="No Title City CountryCode StartDate EndDate Gender Type Status"
    Filter="Season=2025">
  </Request>
</Requests>';

$ch = curl_init('https://www.fivb.org/vis2009/XmlRequest.asmx');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $xml);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: text/xml; charset=utf-8']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n\n";
echo "Response:\n";
echo $response;
```

---

## Notes

1. **API is public** - no authentication required
2. **No known rate limits** - but be reasonable, cache results
3. **XML only** - no JSON endpoint
4. **UTF-8 encoding** - for international names (Polish: ł, ó, etc.)
5. **All dates in ISO format** - YYYY-MM-DD
6. **Times are local** - to tournament location

---

## TODO: Fields to verify on live API

When you test the API, verify these field names are correct:
- [ ] Exact field names for set scores (Set1A vs PointsTeamASet1?)
- [ ] Live match detection (MatchStatus=2?)
- [ ] Player names format (Player1 vs PlayersA1?)
- [ ] Country codes (2-letter ISO or 3-letter?)

Run the test script and update this doc with actual response format.
