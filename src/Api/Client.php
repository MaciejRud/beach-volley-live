<?php
/**
 * FIVB VIS API Client
 *
 * @package BeachVolleyResults
 */

declare(strict_types=1);

namespace BeachVolleyResults\Api;

use BeachVolleyResults\Cache\CacheManager;

/**
 * HTTP client for FIVB VIS API
 */
class Client
{
    /**
     * API endpoint URL
     */
    private const API_URL = 'https://www.fivb.org/vis2009/XmlRequest.asmx';

    /**
     * Request builder instance
     */
    private RequestBuilder $requestBuilder;

    /**
     * Response parser instance
     */
    private ResponseParser $responseParser;

    /**
     * Cache manager instance
     */
    private CacheManager $cache;

    /**
     * API timeout in seconds
     */
    private int $timeout;

    /**
     * Constructor
     */
    public function __construct(?CacheManager $cache = null, int $timeout = 10)
    {
        $this->requestBuilder = new RequestBuilder();
        $this->responseParser = new ResponseParser();
        $this->cache = $cache ?? new CacheManager();
        $this->timeout = $timeout;
    }

    /**
     * Get list of beach tournaments
     *
     * @param int|null $season Filter by season year
     * @return array Array of tournament data
     */
    public function getTournaments(?int $season = null): array
    {
        $season = $season ?? (int) date('Y');
        $cacheKey = "bvr_tournaments_{$season}";

        // Try cache first
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Build request
        $fields = [
            'No', 'Title', 'Code', 'Name',
            'StartDate', 'EndDate', 'StartDateMainDraw', 'EndDateMainDraw',
            'City', 'CountryCode', 'CountryName',
            'Gender', 'Type', 'Status', 'Season',
        ];

        $xml = $this->requestBuilder->build('GetBeachTournamentList', $fields);

        // Make request
        $response = $this->makeRequest($xml);
        if ($response === null) {
            return [];
        }

        // Parse response - but filter during parsing to save memory!
        // The full tournament list is ~8600 items and can exhaust memory
        $allTournaments = $this->responseParser->parseTournaments($response);

        // Free memory - we don't need the raw XML anymore
        unset($response);

        // Filter tournaments immediately to reduce memory usage
        $tournaments = [];
        $seasonStr = (string) $season;

        foreach ($allTournaments as $t) {
            // Must have start date in requested season
            $startDate = $t['start_date'] ?? $t['start_date_main'] ?? '';
            if (empty($startDate) || !str_starts_with($startDate, $seasonStr)) {
                continue;
            }

            // Skip test tournaments (Type=35 only!)
            if ($t['type_code'] === ResponseParser::TOURNAMENT_TYPE_TEST) {
                continue;
            }

            $tournaments[] = $t;
        }

        // Free memory from full list
        unset($allTournaments);

        // Cache filtered tournaments for 6 hours
        $this->cache->set($cacheKey, $tournaments, 21600);

        return $tournaments;
    }

    /**
     * Get single tournament details
     *
     * @param int $tournamentNo Tournament number
     * @return array|null Tournament data or null if not found
     */
    public function getTournament(int $tournamentNo): ?array
    {
        $cacheKey = "bvr_tournament_{$tournamentNo}";

        // Try cache first
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Build request
        $fields = [
            'No', 'Title', 'Code', 'Name',
            'StartDate', 'EndDate', 'StartDateMainDraw', 'EndDateMainDraw',
            'City', 'CountryCode', 'CountryName',
            'Gender', 'Type', 'Status', 'Season',
            'NbTeamsMainDraw', 'NbTeamsQualification',
            'WebSite',
        ];

        $xml = $this->requestBuilder->build('GetBeachTournament', $fields, ['No' => $tournamentNo]);

        // Make request
        $response = $this->makeRequest($xml);
        if ($response === null) {
            return null;
        }

        // Parse response
        $tournament = $this->responseParser->parseSingleTournament($response);

        if ($tournament === null) {
            return null;
        }

        // Cache for 2 hours
        $this->cache->set($cacheKey, $tournament, 7200);

        return $tournament;
    }

    /**
     * Get matches for a tournament
     *
     * @param int $tournamentNo Tournament number
     * @param bool $liveOnly Only return live matches
     * @return array Array of match data
     */
    public function getMatches(int $tournamentNo, bool $liveOnly = false): array
    {
        $cacheKey = $liveOnly
            ? "bvr_live_{$tournamentNo}"
            : "bvr_matches_{$tournamentNo}";

        $cacheTtl = $liveOnly ? 30 : 86400;

        // Try cache first
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Build request
        $fields = [
            'No', 'NoTournament', 'NoRound',
            'NoTeamA', 'NoTeamB',
            'TeamAName', 'TeamBName',
            'TeamAFederationCode', 'TeamBFederationCode',
            'PointsTeamASet1', 'PointsTeamBSet1',
            'PointsTeamASet2', 'PointsTeamBSet2',
            'PointsTeamASet3', 'PointsTeamBSet3',
            'MatchPointsA', 'MatchPointsB',
            'Status', 'ResultType',
            'LocalDate', 'LocalTime',
            'Court', 'Venue',
            'RoundName', 'RoundCode', 'RoundPhase',
            'TournamentName', 'TournamentTitle',
        ];

        $xml = $this->requestBuilder->buildWithFilter(
            'GetBeachMatchList',
            $fields,
            ['NoTournament' => $tournamentNo]
        );

        // Make request
        $response = $this->makeRequest($xml);
        if ($response === null) {
            return [];
        }

        // Parse response
        $matches = $this->responseParser->parseMatches($response);

        // Filter live matches if requested
        if ($liveOnly) {
            $matches = array_filter($matches, fn($m) => $m['status'] === 'live');
            $matches = array_values($matches);
        }

        // Cache
        $this->cache->set($cacheKey, $matches, $cacheTtl);

        return $matches;
    }

    /**
     * Get single match details
     *
     * @param int $matchNo Match number
     * @return array|null Match data or null if not found
     */
    public function getMatch(int $matchNo): ?array
    {
        $cacheKey = "bvr_match_{$matchNo}";

        // Try cache first
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Build request
        $fields = [
            'No', 'NoTournament', 'NoRound',
            'TeamAName', 'TeamBName',
            'TeamAFederationCode', 'TeamBFederationCode',
            'PointsTeamASet1', 'PointsTeamBSet1',
            'PointsTeamASet2', 'PointsTeamBSet2',
            'PointsTeamASet3', 'PointsTeamBSet3',
            'DurationSet1', 'DurationSet2', 'DurationSet3',
            'MatchPointsA', 'MatchPointsB',
            'Status', 'ResultType', 'MatchResultText',
            'LocalDate', 'LocalTime',
            'Court', 'Venue', 'City',
            'RoundName', 'RoundPhase',
            'TournamentName', 'TournamentTitle', 'TournamentType',
            'NoPlayerA1', 'NoPlayerA2', 'NoPlayerB1', 'NoPlayerB2',
        ];

        $xml = $this->requestBuilder->build('GetBeachMatch', $fields, ['No' => $matchNo]);

        // Make request
        $response = $this->makeRequest($xml);
        if ($response === null) {
            return null;
        }

        // Parse response
        $match = $this->responseParser->parseSingleMatch($response);

        if ($match === null) {
            return null;
        }

        // Cache for 30 seconds (might be live)
        $this->cache->set($cacheKey, $match, 30);

        return $match;
    }

    /**
     * Get teams for a tournament
     *
     * @param int $tournamentNo Tournament number
     * @return array Array of team data
     */
    public function getTeams(int $tournamentNo): array
    {
        $cacheKey = "bvr_teams_{$tournamentNo}";

        // Try cache first
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Build request with extended fields for team categorization + player details
        $fields = [
            'No', 'NoTournament', 'Name',
            'CountryCode', 'FederationCode',
            'NoPlayer1', 'NoPlayer2',
            'Player1FirstName', 'Player1LastName',
            'Player2FirstName', 'Player2LastName',
            'Player1Height', 'Player2Height',
            'Player1Weight', 'Player2Weight',
            'Player1BirthDate', 'Player2BirthDate',
            'Player1BeachPosition', 'Player2BeachPosition',
            'Status', 'Rank',
            'IsInMainDraw', 'IsInQualification',
            'MainDrawSeed', 'PositionInMainDraw', 'PositionInQualification',
            'EntryPoints', 'EarnedPointsTeam', 'EarningsTeam',
        ];

        $xml = $this->requestBuilder->buildWithFilter(
            'GetBeachTeamList',
            $fields,
            ['NoTournament' => $tournamentNo]
        );

        // Make request
        $response = $this->makeRequest($xml);
        if ($response === null) {
            return [];
        }

        // Parse response
        $teams = $this->responseParser->parseTeams($response);

        // Cache for 2 hours
        $this->cache->set($cacheKey, $teams, 7200);

        return $teams;
    }

    // NOTE: getTournamentRanking() removed - FIVB API endpoint returns HTTP 400 (disabled)
    // Ranking is now built from match results in Plugin::buildRankingFromMatches()

    /**
     * Blacklisted tournament IDs (test tournaments with huge data)
     */
    private const BLACKLISTED_TOURNAMENTS = [2];

    /**
     * Get tournaments currently in progress (Status=6 Running)
     *
     * According to FIVB API documentation:
     * - Status=6 means "Running" (tournament is in progress)
     *
     * @return array Array of running tournaments
     */
    public function getCurrentTournaments(): array
    {
        $cacheKey = 'bvr_current_tournaments';

        // Try cache first (5 minutes)
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Get all tournaments (uses its own cache)
        $tournaments = $this->getTournaments();

        $current = [];

        foreach ($tournaments as $t) {
            // Skip blacklisted tournaments
            if (in_array($t['id'], self::BLACKLISTED_TOURNAMENTS, true)) {
                continue;
            }

            // Skip test tournaments (Type=35)
            if ($t['type_code'] === ResponseParser::TOURNAMENT_TYPE_TEST) {
                continue;
            }

            // Status=6 means Running (tournament in progress!)
            if ($t['status_code'] === ResponseParser::TOURNAMENT_RUNNING) {
                $current[] = $t;
            }
        }

        // Cache for 5 minutes
        $this->cache->set($cacheKey, $current, 300);

        return $current;
    }

    /**
     * Get all live matches across currently running tournaments
     *
     * Uses proper logic according to FIVB API documentation:
     * 1. Get tournaments with Status=6 (Running)
     * 2. Fetch matches for each running tournament
     * 3. Filter matches by Status in [3,5,7,9,11] for live
     *
     * @return array ['live' => [...], 'break' => [...], 'tournaments' => [...]]
     */
    public function getAllLiveMatches(): array
    {
        $cacheKey = 'bvr_all_live_matches';

        // Try cache first (60 seconds for live data)
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Get currently running tournaments (Status=6)
        $runningTournaments = $this->getCurrentTournaments();

        $liveMatches = [];
        $breakMatches = [];

        foreach ($runningTournaments as $tournament) {
            // Skip blacklisted
            if (in_array($tournament['id'], self::BLACKLISTED_TOURNAMENTS, true)) {
                continue;
            }

            // Get matches for this tournament (short cache for running tournaments)
            $matches = $this->getMatches($tournament['id']);

            foreach ($matches as $match) {
                $statusCode = $match['status_code'] ?? 0;

                // Check if match is LIVE (in a set: Status 3,5,7,9,11)
                if (ResponseParser::isMatchLive($statusCode)) {
                    $match['tournament'] = $tournament;
                    $match['status_text'] = ResponseParser::getMatchStatusText($statusCode);
                    $liveMatches[] = $match;
                }
                // Check if match is in break between sets (Status 2,4,6,8,10)
                elseif (ResponseParser::isMatchInBreak($statusCode)) {
                    $match['tournament'] = $tournament;
                    $match['status_text'] = ResponseParser::getMatchStatusText($statusCode);
                    $breakMatches[] = $match;
                }
            }
        }

        // Sort live matches by court/time
        usort($liveMatches, function ($a, $b) {
            return strcmp($a['court'] ?? '', $b['court'] ?? '');
        });

        $result = [
            'live' => $liveMatches,
            'break' => $breakMatches,
            'tournaments' => $runningTournaments,
        ];

        // Cache for 60 seconds
        $this->cache->set($cacheKey, $result, 60);

        return $result;
    }

    /**
     * Get upcoming tournaments (Status=1 Open, with future start date)
     *
     * According to FIVB API documentation:
     * - Status=1 means "Open" (accepting registrations)
     * - Use StartDateMainDraw for the actual tournament start
     *
     * @param int $limit Max number of tournaments
     * @return array Array of upcoming tournaments
     */
    public function getUpcomingTournaments(int $limit = 5): array
    {
        $tournaments = $this->getTournaments();

        $today = date('Y-m-d');
        $upcoming = [];

        foreach ($tournaments as $t) {
            // Skip blacklisted and test tournaments
            if (in_array($t['id'], self::BLACKLISTED_TOURNAMENTS, true)) {
                continue;
            }
            if ($t['type_code'] === ResponseParser::TOURNAMENT_TYPE_TEST) {
                continue;
            }

            // Status=1 (Open) means upcoming
            if ($t['status_code'] === ResponseParser::TOURNAMENT_UPCOMING) {
                // Use main draw date as the start date
                $startDate = $t['start_date_main'] ?? $t['start_date'] ?? '';

                // Only include if start date is in the future
                if (!empty($startDate) && $startDate >= $today) {
                    $upcoming[] = $t;
                }
            }
        }

        // Sort by start date ascending (nearest first)
        usort($upcoming, function ($a, $b) {
            $dateA = $a['start_date_main'] ?? $a['start_date'] ?? '';
            $dateB = $b['start_date_main'] ?? $b['start_date'] ?? '';
            return strcmp($dateA, $dateB);
        });

        return array_slice($upcoming, 0, $limit);
    }

    /**
     * Get recently finished tournaments (Status=7)
     *
     * @param int $limit Max number of tournaments
     * @param int $daysBack How many days back to look
     * @return array Array of recently finished tournaments
     */
    public function getRecentlyFinishedTournaments(int $limit = 5, int $daysBack = 14): array
    {
        $tournaments = $this->getTournaments();

        $cutoffDate = date('Y-m-d', strtotime("-{$daysBack} days"));
        $recent = [];

        foreach ($tournaments as $t) {
            // Skip blacklisted and test tournaments
            if (in_array($t['id'], self::BLACKLISTED_TOURNAMENTS, true)) {
                continue;
            }
            if ($t['type_code'] === ResponseParser::TOURNAMENT_TYPE_TEST) {
                continue;
            }

            // Status=7 (Finished)
            if ($t['status_code'] === ResponseParser::TOURNAMENT_FINISHED) {
                $endDate = $t['end_date_main'] ?? $t['end_date'] ?? '';

                // Only include if ended within the cutoff period
                if (!empty($endDate) && $endDate >= $cutoffDate) {
                    $recent[] = $t;
                }
            }
        }

        // Sort by end date descending (most recent first)
        usort($recent, function ($a, $b) {
            $dateA = $a['end_date_main'] ?? $a['end_date'] ?? '';
            $dateB = $b['end_date_main'] ?? $b['end_date'] ?? '';
            return strcmp($dateB, $dateA);
        });

        return array_slice($recent, 0, $limit);
    }

    /**
     * Get matches for a specific country
     *
     * @param string $countryCode ISO 3-letter country code
     * @param int $limit Maximum number of matches
     * @param bool $includeLive Include live matches
     * @param bool $includeFinished Include finished matches
     * @return array Array of matches
     */
    public function getMatchesByCountry(
        string $countryCode,
        int $limit = 10,
        bool $includeLive = true,
        bool $includeFinished = true
    ): array {
        $cacheKey = "bvr_country_{$countryCode}_{$limit}";

        // Try cache first
        $cached = $this->cache->get($cacheKey);
        if ($cached !== false) {
            return $cached;
        }

        // Get current season tournaments
        $tournaments = $this->getTournaments();

        $countryMatches = [];

        foreach ($tournaments as $tournament) {
            // Skip if tournament not active
            // Note: 'running' is the correct status for live tournaments (from TOURNAMENT_STATUS_MAP)
            if (!in_array($tournament['status'], ['running', 'finished', 'paid', 'payment_pending'])) {
                continue;
            }

            $matches = $this->getMatches($tournament['id']);

            foreach ($matches as $match) {
                // Check if country is involved
                $teamACountry = $match['team_a']['country_code'] ?? '';
                $teamBCountry = $match['team_b']['country_code'] ?? '';

                if ($teamACountry !== $countryCode && $teamBCountry !== $countryCode) {
                    continue;
                }

                // Filter by status
                if ($match['status'] === 'live' && !$includeLive) {
                    continue;
                }
                if ($match['status'] === 'finished' && !$includeFinished) {
                    continue;
                }

                $match['tournament'] = $tournament;
                $countryMatches[] = $match;
            }
        }

        // Sort: live first, then by date desc
        usort($countryMatches, function ($a, $b) {
            if ($a['status'] === 'live' && $b['status'] !== 'live') return -1;
            if ($a['status'] !== 'live' && $b['status'] === 'live') return 1;

            $dateA = $a['date'] . ' ' . $a['time'];
            $dateB = $b['date'] . ' ' . $b['time'];
            return strcmp($dateB, $dateA); // Descending
        });

        // Limit results
        $countryMatches = array_slice($countryMatches, 0, $limit);

        // Cache for 5 minutes
        $this->cache->set($cacheKey, $countryMatches, 300);

        return $countryMatches;
    }

    /**
     * Make HTTP request to API
     *
     * @param string $xml XML request body
     * @return string|null Response body or null on error
     */
    private function makeRequest(string $xml): ?string
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL => self::API_URL,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $xml,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: text/xml; charset=utf-8',
                'Content-Length: ' . strlen($xml),
            ],
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        // Log errors in debug mode
        if ($error || $httpCode !== 200) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log(sprintf(
                    '[BVR] API Error: HTTP %d, cURL error: %s',
                    $httpCode,
                    $error ?: 'none'
                ));
            }
            return null;
        }

        return $response ?: null;
    }
}
