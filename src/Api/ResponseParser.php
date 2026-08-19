<?php
/**
 * XML Response Parser for FIVB VIS API
 *
 * @package BeachVolleyResults
 */

declare(strict_types=1);

namespace BeachVolleyResults\Api;

/**
 * Parses XML responses from FIVB VIS API
 */
class ResponseParser
{
    /**
     * Gender code mapping (from official FIVB API documentation)
     *
     * "M" or "1" = Men
     * "W" or "2" = Women
     * "MW" or "3" = Both
     * "Mixed" = Mixed teams
     * "0" = Unknown
     */
    private const GENDER_MAP = [
        '0' => 'U',      // Unknown
        '1' => 'M',      // Men
        '2' => 'W',      // Women
        '3' => 'MW',     // Both
        'M' => 'M',
        'W' => 'W',
        'MW' => 'MW',
        'Mixed' => 'Mixed',
    ];

    /**
     * Tournament status code mapping (from official FIVB API documentation)
     *
     * 0 = NotOpen
     * 1 = Open (accepting registrations = upcoming)
     * 6 = Running (tournament in progress!)
     * 7 = Finished
     * 8 = PaymentPending
     * 9 = Paid
     */
    private const TOURNAMENT_STATUS_MAP = [
        0 => 'not_open',
        1 => 'upcoming',        // Open - accepting registrations
        6 => 'running',         // Running - tournament is LIVE!
        7 => 'finished',        // Finished
        8 => 'payment_pending', // PaymentPending
        9 => 'paid',            // Paid (completed)
    ];

    /**
     * Tournament status codes
     */
    public const TOURNAMENT_RUNNING = 6;
    public const TOURNAMENT_UPCOMING = 1;
    public const TOURNAMENT_FINISHED = 7;

    /**
     * Match status code mapping (from official FIVB API documentation)
     *
     * LIVE (in set): 3, 5, 7, 9, 11
     * BREAK (between sets): 2, 4, 6, 8, 10
     * FINISHED: 12, 13, 14, 15
     * SCHEDULED: 1
     */
    private const MATCH_STATUS_MAP = [
        1 => 'scheduled',
        2 => 'ready',           // ReadyToStart
        3 => 'live',            // InSet1
        4 => 'break',           // Set1Finished
        5 => 'live',            // InSet2
        6 => 'break',           // Set2Finished
        7 => 'live',            // InSet3
        8 => 'break',           // Set3Finished
        9 => 'live',            // InSet4
        10 => 'break',          // Set4Finished
        11 => 'live',           // InSet5
        12 => 'finished',       // Finished
        13 => 'finished',       // OfficialResult
        14 => 'finished',       // Corrected
        15 => 'finished',       // Closed
    ];

    /**
     * Live status codes (match in progress during a set)
     */
    public const LIVE_STATUS_CODES = [3, 5, 7, 9, 11];

    /**
     * Break status codes (between sets)
     */
    public const BREAK_STATUS_CODES = [2, 4, 6, 8, 10];

    /**
     * Finished status codes
     */
    public const FINISHED_STATUS_CODES = [12, 13, 14, 15];

    /**
     * Tournament type code mapping (from official FIVB API documentation)
     */
    private const TOURNAMENT_TYPE_MAP = [
        0 => 'Grand Slam',
        1 => 'Open',
        2 => 'Challenger',
        3 => 'World Series',
        4 => 'World Championship',
        5 => 'Olympic Games',
        6 => 'Satellite',
        7 => 'Continental Championship',
        8 => 'Other Continental',
        9 => 'Other',
        10 => 'CEV Masters',
        11 => 'Continental Cup',
        12 => 'Continental Tour',
        13 => 'Junior World Championship',
        14 => 'Youth World Championship',
        15 => 'National Tour',
        16 => 'National Tour U23',
        17 => 'National Tour U21',
        18 => 'National Tour U20',
        19 => 'National Tour U19',
        20 => 'National Tour U18',
        21 => 'National Tour U17',
        22 => 'Continental Championship U22',
        23 => 'Continental Championship U20',
        24 => 'Continental Championship U18',
        25 => 'World Championship U23',
        26 => 'World Championship U21',
        27 => 'World Championship U19',
        28 => 'National Tour U16',
        29 => 'National Tour U15',
        30 => 'National Tour U14',
        31 => 'World Championship U17',
        32 => 'Major Series',
        33 => 'World Tour Finals',
        34 => 'Zonal Tour',
        35 => 'Test',               // SKIP THESE!
        36 => 'Snow Volleyball',
        37 => 'Continental Cup Final',
        38 => 'World Tour 5-Star',
        39 => 'World Tour 4-Star',
        40 => 'World Tour 3-Star',
        41 => 'World Tour 2-Star',
        42 => 'World Tour 1-Star',
        43 => 'Youth Olympic Games',
        44 => 'Multi-Sport Event',
        45 => 'National Snow Volleyball',
        46 => 'National Tour U13',
        47 => 'Continental Championship U21',
        48 => 'Continental Championship U19',
        49 => 'Olympic Qualification',
        50 => 'King of the Court',
        51 => 'Beach Pro Tour Elite16',
        52 => 'Beach Pro Tour Challenge',
        53 => 'Beach Pro Tour Futures',
    ];

    /**
     * Test tournament type code (to be skipped)
     */
    public const TOURNAMENT_TYPE_TEST = 35;

    /**
     * Parse tournaments list response
     *
     * @param string $xml XML response
     * @return array Array of tournament data
     */
    public function parseTournaments(string $xml): array
    {
        $tournaments = [];

        $doc = $this->loadXml($xml);
        if ($doc === null) {
            return [];
        }

        $nodes = $doc->getElementsByTagName('BeachTournament');

        foreach ($nodes as $node) {
            $tournament = $this->parseTournamentNode($node);
            if ($tournament !== null) {
                $tournaments[] = $tournament;
            }
        }

        return $tournaments;
    }

    /**
     * Parse single tournament response
     *
     * @param string $xml XML response
     * @return array|null Tournament data or null if not found
     */
    public function parseSingleTournament(string $xml): ?array
    {
        $doc = $this->loadXml($xml);
        if ($doc === null) {
            return null;
        }

        $nodes = $doc->getElementsByTagName('BeachTournament');

        if ($nodes->length === 0) {
            return null;
        }

        return $this->parseTournamentNode($nodes->item(0));
    }

    /**
     * Parse matches list response
     *
     * @param string $xml XML response
     * @return array Array of match data
     */
    public function parseMatches(string $xml): array
    {
        $matches = [];

        $doc = $this->loadXml($xml);
        if ($doc === null) {
            return [];
        }

        $nodes = $doc->getElementsByTagName('BeachMatch');

        foreach ($nodes as $node) {
            $match = $this->parseMatchNode($node);
            if ($match !== null) {
                $matches[] = $match;
            }
        }

        return $matches;
    }

    /**
     * Parse single match response
     *
     * @param string $xml XML response
     * @return array|null Match data or null if not found
     */
    public function parseSingleMatch(string $xml): ?array
    {
        $doc = $this->loadXml($xml);
        if ($doc === null) {
            return null;
        }

        $nodes = $doc->getElementsByTagName('BeachMatch');

        if ($nodes->length === 0) {
            return null;
        }

        return $this->parseMatchNode($nodes->item(0));
    }

    /**
     * Parse teams list response
     *
     * @param string $xml XML response
     * @return array Array of team data
     */
    public function parseTeams(string $xml): array
    {
        $teams = [];

        $doc = $this->loadXml($xml);
        if ($doc === null) {
            return [];
        }

        $nodes = $doc->getElementsByTagName('BeachTeam');

        foreach ($nodes as $node) {
            $team = $this->parseTeamNode($node);
            if ($team !== null) {
                $teams[] = $team;
            }
        }

        return $teams;
    }

    /**
     * Parse tournament XML node
     *
     * @param \DOMElement $node XML node
     * @return array|null Tournament data
     */
    private function parseTournamentNode(\DOMElement $node): ?array
    {
        $no = $this->getAttr($node, 'No');
        if ($no === null) {
            return null;
        }

        $genderCode = $this->getAttr($node, 'Gender');
        $statusCode = $this->getAttr($node, 'Status');
        $typeCode = $this->getAttr($node, 'Type');

        return [
            'id' => (int) $no,
            'title' => $this->getAttr($node, 'Title') ?? $this->getAttr($node, 'Name') ?? '',
            'code' => $this->getAttr($node, 'Code') ?? '',
            'city' => $this->getAttr($node, 'City') ?? '',
            'country_code' => $this->getAttr($node, 'CountryCode') ?? '',
            'country_name' => $this->getAttr($node, 'CountryName') ?? '',
            'start_date' => $this->getAttr($node, 'StartDate') ?? '',
            'end_date' => $this->getAttr($node, 'EndDate') ?? '',
            'start_date_main' => $this->getAttr($node, 'StartDateMainDraw') ?? '',
            'end_date_main' => $this->getAttr($node, 'EndDateMainDraw') ?? '',
            'gender' => self::GENDER_MAP[$genderCode] ?? $genderCode,
            'gender_code' => (int) $genderCode,
            'type' => self::TOURNAMENT_TYPE_MAP[(int) $typeCode] ?? "Type {$typeCode}",
            'type_code' => (int) $typeCode,
            'status' => self::TOURNAMENT_STATUS_MAP[(int) $statusCode] ?? 'unknown',
            'status_code' => (int) $statusCode,
            'season' => (int) ($this->getAttr($node, 'Season') ?? date('Y')),
            'teams_main_draw' => (int) ($this->getAttr($node, 'NbTeamsMainDraw') ?? 0),
            'teams_qualification' => (int) ($this->getAttr($node, 'NbTeamsQualification') ?? 0),
            'website' => $this->getAttr($node, 'WebSite') ?? '',
        ];
    }

    /**
     * Parse match XML node
     *
     * @param \DOMElement $node XML node
     * @return array|null Match data
     */
    private function parseMatchNode(\DOMElement $node): ?array
    {
        $no = $this->getAttr($node, 'No');
        if ($no === null) {
            return null;
        }

        $statusCode = $this->getAttr($node, 'Status');

        // Parse scores with duration
        $scores = [];
        for ($i = 1; $i <= 5; $i++) {
            $teamA = $this->getAttr($node, "PointsTeamASet{$i}");
            $teamB = $this->getAttr($node, "PointsTeamBSet{$i}");

            if ($teamA !== null && $teamB !== null && ($teamA !== '0' || $teamB !== '0' || $i <= 2)) {
                $durationRaw = $this->getAttr($node, "DurationSet{$i}");
                $durationSecs = $durationRaw !== null ? (int) $durationRaw : null;

                $scores[] = [
                    'set' => $i,
                    'team_a' => (int) $teamA,
                    'team_b' => (int) $teamB,
                    'duration' => $durationSecs,
                    'duration_formatted' => $durationSecs !== null ? self::formatDuration($durationSecs) : null,
                ];
            }
        }

        // Determine winner
        $matchPointsA = (int) ($this->getAttr($node, 'MatchPointsA') ?? 0);
        $matchPointsB = (int) ($this->getAttr($node, 'MatchPointsB') ?? 0);
        $winner = null;
        if ($matchPointsA > $matchPointsB) {
            $winner = 'a';
        } elseif ($matchPointsB > $matchPointsA) {
            $winner = 'b';
        }

        return [
            'id' => (int) $no,
            'tournament_id' => (int) ($this->getAttr($node, 'NoTournament') ?? 0),
            'tournament_name' => $this->getAttr($node, 'TournamentTitle')
                ?? $this->getAttr($node, 'TournamentName') ?? '',
            'team_a' => [
                'id' => (int) ($this->getAttr($node, 'NoTeamA') ?? 0),
                'name' => $this->getAttr($node, 'TeamAName') ?? '',
                'country_code' => $this->getAttr($node, 'TeamAFederationCode') ?? '',
            ],
            'team_b' => [
                'id' => (int) ($this->getAttr($node, 'NoTeamB') ?? 0),
                'name' => $this->getAttr($node, 'TeamBName') ?? '',
                'country_code' => $this->getAttr($node, 'TeamBFederationCode') ?? '',
            ],
            'scores' => $scores,
            'match_points' => [
                'team_a' => $matchPointsA,
                'team_b' => $matchPointsB,
            ],
            'winner' => $winner,
            'status' => self::MATCH_STATUS_MAP[(int) $statusCode] ?? 'unknown',
            'status_code' => (int) $statusCode,
            'round' => $this->getAttr($node, 'RoundName') ?? '',
            'round_code' => $this->getAttr($node, 'RoundCode') ?? '',
            'round_phase' => $this->getAttr($node, 'RoundPhase') ?? '',
            'court' => $this->getAttr($node, 'Court') ?? '',
            'venue' => $this->getAttr($node, 'Venue') ?? '',
            'city' => $this->getAttr($node, 'City') ?? '',
            'date' => $this->getAttr($node, 'LocalDate') ?? '',
            'time' => $this->getAttr($node, 'LocalTime') ?? '',
            'result_text' => $this->getAttr($node, 'MatchResultText') ?? '',
        ];
    }

    /**
     * Parse team XML node
     *
     * @param \DOMElement $node XML node
     * @return array|null Team data
     */
    private function parseTeamNode(\DOMElement $node): ?array
    {
        $no = $this->getAttr($node, 'No');
        if ($no === null) {
            return null;
        }

        // Parse player birth dates to calculate age
        $p1Birth = $this->getAttr($node, 'Player1BirthDate');
        $p2Birth = $this->getAttr($node, 'Player2BirthDate');

        return [
            'id' => (int) $no,
            'tournament_id' => (int) ($this->getAttr($node, 'NoTournament') ?? 0),
            'name' => $this->getAttr($node, 'Name') ?? '',
            'country_code' => $this->getAttr($node, 'CountryCode')
                ?? $this->getAttr($node, 'FederationCode') ?? '',
            'player1' => [
                'id' => (int) ($this->getAttr($node, 'NoPlayer1') ?? 0),
                'first_name' => $this->getAttr($node, 'Player1FirstName') ?? '',
                'last_name' => $this->getAttr($node, 'Player1LastName') ?? '',
                'height' => self::normalizeHeight((int) ($this->getAttr($node, 'Player1Height') ?? 0)),
                'weight' => self::normalizeWeight((int) ($this->getAttr($node, 'Player1Weight') ?? 0)),
                'birth_date' => $p1Birth ?? '',
                'age' => $p1Birth ? self::calculateAge($p1Birth) : null,
                'position' => $this->getAttr($node, 'Player1BeachPosition') ?? '',
            ],
            'player2' => [
                'id' => (int) ($this->getAttr($node, 'NoPlayer2') ?? 0),
                'first_name' => $this->getAttr($node, 'Player2FirstName') ?? '',
                'last_name' => $this->getAttr($node, 'Player2LastName') ?? '',
                'height' => self::normalizeHeight((int) ($this->getAttr($node, 'Player2Height') ?? 0)),
                'weight' => self::normalizeWeight((int) ($this->getAttr($node, 'Player2Weight') ?? 0)),
                'birth_date' => $p2Birth ?? '',
                'age' => $p2Birth ? self::calculateAge($p2Birth) : null,
                'position' => $this->getAttr($node, 'Player2BeachPosition') ?? '',
            ],
            'rank' => (int) ($this->getAttr($node, 'Rank') ?? 0),
            'seed' => (int) ($this->getAttr($node, 'MainDrawSeed') ?? 0),
            'in_main_draw' => $this->getAttr($node, 'IsInMainDraw') === 'true',
            'in_qualification' => $this->getAttr($node, 'IsInQualification') === 'true',
            'position_main_draw' => (int) ($this->getAttr($node, 'PositionInMainDraw') ?? 0),
            'position_qualification' => (int) ($this->getAttr($node, 'PositionInQualification') ?? 0),
            'entry_points' => (int) ($this->getAttr($node, 'EntryPoints') ?? 0),
            'earned_points' => (int) ($this->getAttr($node, 'EarnedPointsTeam') ?? 0),
            'earnings' => (int) ($this->getAttr($node, 'EarningsTeam') ?? 0),
        ];
    }

    // NOTE: parseRanking() and parseRankingEntryNode() removed
    // FIVB API GetBeachTournamentRanking endpoint returns HTTP 400 (disabled)
    // Ranking is now built from match results in Plugin::buildRankingFromMatches()

    /**
     * Load XML string into DOMDocument
     *
     * @param string $xml XML string
     * @return \DOMDocument|null DOMDocument or null on error
     */
    private function loadXml(string $xml): ?\DOMDocument
    {
        if (empty($xml)) {
            return null;
        }

        libxml_use_internal_errors(true);

        $doc = new \DOMDocument();

        // Build options with LIBXML_PARSEHUGE for large tournament lists (~8600+ items)
        $options = LIBXML_NONET | LIBXML_NOBLANKS | LIBXML_COMPACT;
        if (defined('LIBXML_PARSEHUGE')) {
            $options |= LIBXML_PARSEHUGE;
        }

        $success = $doc->loadXML($xml, $options);

        if (!$success) {
            $errors = libxml_get_errors();
            libxml_clear_errors();

            if (defined('WP_DEBUG') && WP_DEBUG && !empty($errors)) {
                foreach ($errors as $error) {
                    error_log('[BVR] XML Parse Error: ' . trim($error->message));
                }
            }

            return null;
        }

        return $doc;
    }

    /**
     * Get attribute value from XML node
     *
     * @param \DOMElement $node XML node
     * @param string $name Attribute name
     * @return string|null Attribute value or null if not exists
     */
    private function getAttr(\DOMElement $node, string $name): ?string
    {
        if (!$node->hasAttribute($name)) {
            return null;
        }

        $value = $node->getAttribute($name);
        return $value !== '' ? $value : null;
    }

    /**
     * Get gender label
     *
     * @param int|string $code Gender code
     * @return string Gender label
     */
    public static function getGenderLabel($code): string
    {
        return match ((string) $code) {
            '0', 'U' => '', // Unknown/unspecified - show nothing instead of "Unknown"
            '1', 'M' => __('Men', 'beach-volley-results'),
            '2', 'W' => __('Women', 'beach-volley-results'),
            '3', 'MW' => __('Mixed', 'beach-volley-results'),
            'Mixed' => __('Mixed', 'beach-volley-results'),
            default => '',
        };
    }

    /**
     * Get tournament status label
     *
     * @param string $status Status key
     * @return string Status label
     */
    public static function getTournamentStatusLabel(string $status): string
    {
        return match ($status) {
            'not_open' => __('Not Open', 'beach-volley-results'),
            'upcoming' => __('Upcoming', 'beach-volley-results'),
            'running' => __('Live', 'beach-volley-results'),
            'finished' => __('Finished', 'beach-volley-results'),
            'payment_pending' => __('Completed', 'beach-volley-results'),
            'paid' => __('Completed', 'beach-volley-results'),
            default => __('Unknown', 'beach-volley-results'),
        };
    }

    /**
     * Get match status label
     *
     * @param string $status Status key
     * @return string Status label
     */
    public static function getMatchStatusLabel(string $status): string
    {
        return match ($status) {
            'scheduled' => __('Scheduled', 'beach-volley-results'),
            'ready' => __('Starting', 'beach-volley-results'),
            'live' => __('Live', 'beach-volley-results'),
            'break' => __('Break', 'beach-volley-results'),
            'finished' => __('Finished', 'beach-volley-results'),
            'cancelled' => __('Cancelled', 'beach-volley-results'),
            'postponed' => __('Postponed', 'beach-volley-results'),
            default => __('Unknown', 'beach-volley-results'),
        };
    }

    /**
     * Get detailed status text from status code
     *
     * @param int $statusCode Status code from API
     * @return string Human-readable status
     */
    public static function getMatchStatusText(int $statusCode): string
    {
        $texts = [
            1 => __('Scheduled', 'beach-volley-results'),
            2 => __('Starting soon', 'beach-volley-results'),
            3 => __('Set 1', 'beach-volley-results'),
            4 => __('Break', 'beach-volley-results'),
            5 => __('Set 2', 'beach-volley-results'),
            6 => __('Break', 'beach-volley-results'),
            7 => __('Set 3', 'beach-volley-results'),
            8 => __('Break', 'beach-volley-results'),
            9 => __('Set 4', 'beach-volley-results'),
            10 => __('Break', 'beach-volley-results'),
            11 => __('Set 5', 'beach-volley-results'),
            12 => __('Finished', 'beach-volley-results'),
            13 => __('Final', 'beach-volley-results'),
            14 => __('Final', 'beach-volley-results'),
            15 => __('Final', 'beach-volley-results'),
        ];
        return $texts[$statusCode] ?? __('Unknown', 'beach-volley-results');
    }

    /**
     * Check if match status code indicates LIVE (in progress during a set)
     *
     * @param int $statusCode Status code from API
     * @return bool True if match is live
     */
    public static function isMatchLive(int $statusCode): bool
    {
        return in_array($statusCode, self::LIVE_STATUS_CODES, true);
    }

    /**
     * Check if match status code indicates break between sets
     *
     * @param int $statusCode Status code from API
     * @return bool True if match is in break
     */
    public static function isMatchInBreak(int $statusCode): bool
    {
        return in_array($statusCode, self::BREAK_STATUS_CODES, true);
    }

    /**
     * Check if match status code indicates finished
     *
     * @param int $statusCode Status code from API
     * @return bool True if match is finished
     */
    public static function isMatchFinished(int $statusCode): bool
    {
        return in_array($statusCode, self::FINISHED_STATUS_CODES, true);
    }

    /**
     * Check if match is currently active (live or in break)
     *
     * @param int $statusCode Status code from API
     * @return bool True if match is active
     */
    public static function isMatchActive(int $statusCode): bool
    {
        return self::isMatchLive($statusCode) || self::isMatchInBreak($statusCode);
    }

    /**
     * Calculate age from birth date string
     *
     * @param string $birthDate Date string (YYYY-MM-DD)
     * @return int|null Age in years or null if invalid
     */
    public static function calculateAge(string $birthDate): ?int
    {
        $birth = \DateTime::createFromFormat('Y-m-d', $birthDate);
        if (!$birth) {
            return null;
        }

        $now = new \DateTime();
        return (int) $now->diff($birth)->y;
    }

    /**
     * Normalize height from FIVB API value to centimeters
     *
     * FIVB API returns height in an internal unit (~10000 per cm).
     * Values > 300 are treated as needing conversion.
     *
     * @param int $raw Raw height value from API
     * @return int Height in centimeters
     */
    public static function normalizeHeight(int $raw): int
    {
        if ($raw <= 0) {
            return 0;
        }
        // Reasonable cm range: 140-230
        if ($raw >= 140 && $raw <= 300) {
            return $raw;
        }
        // API returns height * 10000 (e.g., 1830000 = 183cm)
        $converted = (int) round($raw / 10000);
        return ($converted >= 100 && $converted <= 300) ? $converted : 0;
    }

    /**
     * Normalize weight from FIVB API value to kilograms
     *
     * FIVB API returns weight in an internal unit (~1000000 per kg).
     * Values > 200 are treated as needing conversion.
     *
     * @param int $raw Raw weight value from API
     * @return int Weight in kilograms
     */
    public static function normalizeWeight(int $raw): int
    {
        if ($raw <= 0) {
            return 0;
        }
        // Reasonable kg range: 40-150
        if ($raw >= 40 && $raw <= 200) {
            return $raw;
        }
        // API returns weight * 1000000 (e.g., 83000000 = 83kg)
        $converted = (int) round($raw / 1000000);
        return ($converted >= 30 && $converted <= 200) ? $converted : 0;
    }

    /**
     * Format duration in seconds to human-readable string (e.g., "17:48")
     *
     * @param int $seconds Duration in seconds
     * @return string Formatted duration
     */
    public static function formatDuration(int $seconds): string
    {
        if ($seconds <= 0) {
            return '0:00';
        }

        $minutes = (int) floor($seconds / 60);
        $secs = $seconds % 60;

        return sprintf('%d:%02d', $minutes, $secs);
    }
}
