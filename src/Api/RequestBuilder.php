<?php
/**
 * XML Request Builder for FIVB VIS API
 *
 * @package BeachVolleyResults
 */

declare(strict_types=1);

namespace BeachVolleyResults\Api;

/**
 * Builds XML requests for FIVB VIS API
 */
class RequestBuilder
{
    /**
     * Build XML request
     *
     * @param string $type Request type (e.g., 'GetBeachTournamentList')
     * @param array $fields Fields to request
     * @param array $params Additional parameters (e.g., ['No' => 123])
     * @return string XML request string
     */
    public function build(string $type, array $fields = [], array $params = []): string
    {
        $xml = new \DOMDocument('1.0', 'utf-8');
        $xml->formatOutput = false;

        // Create Request element
        $request = $xml->createElement('Request');
        $request->setAttribute('Type', $type);

        // Add fields if provided
        if (!empty($fields)) {
            $request->setAttribute('Fields', implode(' ', $fields));
        }

        // Add parameters
        foreach ($params as $name => $value) {
            // Convert parameter name to PascalCase if needed
            $name = $this->toPascalCase($name);
            $request->setAttribute($name, (string) $value);
        }

        $xml->appendChild($request);

        return $xml->saveXML();
    }

    /**
     * Build batch request with multiple queries
     *
     * @param array $requests Array of ['type' => string, 'fields' => array, 'params' => array]
     * @return string XML request string
     */
    public function buildBatch(array $requests): string
    {
        $xml = new \DOMDocument('1.0', 'utf-8');
        $xml->formatOutput = false;

        $root = $xml->createElement('Requests');

        foreach ($requests as $req) {
            $request = $xml->createElement('Request');
            $request->setAttribute('Type', $req['type']);

            if (!empty($req['fields'])) {
                $request->setAttribute('Fields', implode(' ', $req['fields']));
            }

            foreach ($req['params'] ?? [] as $name => $value) {
                $name = $this->toPascalCase($name);
                $request->setAttribute($name, (string) $value);
            }

            $root->appendChild($request);
        }

        $xml->appendChild($root);

        return $xml->saveXML();
    }

    /**
     * Build request for tournaments list
     *
     * @param array|null $fields Custom fields or null for defaults
     * @return string XML request string
     */
    public function buildTournamentsRequest(?array $fields = null): string
    {
        $fields = $fields ?? [
            'No', 'Title', 'Code', 'Name',
            'StartDate', 'EndDate',
            'City', 'CountryCode', 'CountryName',
            'Gender', 'Type', 'Status', 'Season',
        ];

        return $this->build('GetBeachTournamentList', $fields);
    }

    /**
     * Build request for single tournament
     *
     * @param int $tournamentNo Tournament number
     * @param array|null $fields Custom fields or null for defaults
     * @return string XML request string
     */
    public function buildTournamentRequest(int $tournamentNo, ?array $fields = null): string
    {
        $fields = $fields ?? [
            'No', 'Title', 'Code', 'Name',
            'StartDate', 'EndDate', 'StartDateMainDraw', 'EndDateMainDraw',
            'City', 'CountryCode', 'CountryName',
            'Gender', 'Type', 'Status', 'Season',
            'NbTeamsMainDraw', 'NbTeamsQualification',
        ];

        return $this->build('GetBeachTournament', $fields, ['No' => $tournamentNo]);
    }

    /**
     * Build request for matches list
     *
     * @param int $tournamentNo Tournament number
     * @param array|null $fields Custom fields or null for defaults
     * @return string XML request string
     */
    public function buildMatchesRequest(int $tournamentNo, ?array $fields = null): string
    {
        $fields = $fields ?? [
            'No', 'NoTournament',
            'TeamAName', 'TeamBName',
            'TeamAFederationCode', 'TeamBFederationCode',
            'PointsTeamASet1', 'PointsTeamBSet1',
            'PointsTeamASet2', 'PointsTeamBSet2',
            'PointsTeamASet3', 'PointsTeamBSet3',
            'MatchPointsA', 'MatchPointsB',
            'Status', 'LocalDate', 'LocalTime',
            'RoundName', 'Court',
        ];

        return $this->buildWithFilter('GetBeachMatchList', $fields, ['NoTournament' => $tournamentNo]);
    }

    /**
     * Build request for single match
     *
     * @param int $matchNo Match number
     * @param array|null $fields Custom fields or null for defaults
     * @return string XML request string
     */
    public function buildMatchRequest(int $matchNo, ?array $fields = null): string
    {
        $fields = $fields ?? [
            'No', 'NoTournament',
            'TeamAName', 'TeamBName',
            'TeamAFederationCode', 'TeamBFederationCode',
            'PointsTeamASet1', 'PointsTeamBSet1',
            'PointsTeamASet2', 'PointsTeamBSet2',
            'PointsTeamASet3', 'PointsTeamBSet3',
            'DurationSet1', 'DurationSet2', 'DurationSet3',
            'MatchPointsA', 'MatchPointsB',
            'Status', 'ResultType', 'MatchResultText',
            'LocalDate', 'LocalTime',
            'RoundName', 'Court', 'Venue',
            'TournamentName', 'TournamentTitle',
        ];

        return $this->build('GetBeachMatch', $fields, ['No' => $matchNo]);
    }

    /**
     * Build request for teams list
     *
     * @param int $tournamentNo Tournament number
     * @param array|null $fields Custom fields or null for defaults
     * @return string XML request string
     */
    public function buildTeamsRequest(int $tournamentNo, ?array $fields = null): string
    {
        $fields = $fields ?? [
            'No', 'NoTournament', 'Name',
            'CountryCode', 'FederationCode',
            'Player1FirstName', 'Player1LastName',
            'Player2FirstName', 'Player2LastName',
            'Status', 'Rank', 'MainDrawSeed',
        ];

        return $this->buildWithFilter('GetBeachTeamList', $fields, ['NoTournament' => $tournamentNo]);
    }

    /**
     * Build XML request with Filter child element
     *
     * FIVB VIS API requires filter parameters as child <Filter> element for list requests.
     * Example: <Request Type="GetBeachMatchList" Fields="..."><Filter NoTournament="502"/></Request>
     *
     * @param string $type Request type (e.g., 'GetBeachMatchList')
     * @param array $fields Fields to request
     * @param array $filterParams Filter parameters (e.g., ['NoTournament' => 502])
     * @return string XML request string
     */
    public function buildWithFilter(string $type, array $fields = [], array $filterParams = []): string
    {
        $xml = new \DOMDocument('1.0', 'utf-8');
        $xml->formatOutput = false;

        // Create Request element
        $request = $xml->createElement('Request');
        $request->setAttribute('Type', $type);

        // Add fields if provided
        if (!empty($fields)) {
            $request->setAttribute('Fields', implode(' ', $fields));
        }

        // Add Filter as child element (FIVB API requirement for list requests)
        if (!empty($filterParams)) {
            $filter = $xml->createElement('Filter');
            foreach ($filterParams as $name => $value) {
                $name = $this->toPascalCase($name);
                if (is_bool($value)) {
                    $value = $value ? 'true' : 'false';
                }
                $filter->setAttribute($name, (string) $value);
            }
            $request->appendChild($filter);
        }

        $xml->appendChild($request);

        return $xml->saveXML();
    }

    /**
     * Convert string to PascalCase
     *
     * @param string $string Input string (snake_case or camelCase)
     * @return string PascalCase string
     */
    private function toPascalCase(string $string): string
    {
        // If already PascalCase, return as is
        if (ctype_upper($string[0])) {
            return $string;
        }

        // Convert snake_case to PascalCase
        $string = str_replace('_', ' ', $string);
        $string = ucwords($string);
        return str_replace(' ', '', $string);
    }
}
