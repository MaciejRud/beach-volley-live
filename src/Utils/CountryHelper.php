<?php
/**
 * Country Helper - country codes, names, and flag emojis
 *
 * @package BeachVolleyResults
 */

declare(strict_types=1);

namespace BeachVolleyResults\Utils;

/**
 * Helper class for country data
 */
class CountryHelper
{
    /**
     * Get all countries with names and flag emojis
     *
     * @return array<string, array{name: string, flag: string}>
     */
    public static function getAllCountries(): array
    {
        return [
            'AFG' => ['name' => 'Afghanistan', 'flag' => '🇦🇫'],
            'ALB' => ['name' => 'Albania', 'flag' => '🇦🇱'],
            'ALG' => ['name' => 'Algeria', 'flag' => '🇩🇿'],
            'AND' => ['name' => 'Andorra', 'flag' => '🇦🇩'],
            'ANG' => ['name' => 'Angola', 'flag' => '🇦🇴'],
            'ANT' => ['name' => 'Antigua and Barbuda', 'flag' => '🇦🇬'],
            'ARG' => ['name' => 'Argentina', 'flag' => '🇦🇷'],
            'ARM' => ['name' => 'Armenia', 'flag' => '🇦🇲'],
            'ARU' => ['name' => 'Aruba', 'flag' => '🇦🇼'],
            'AUS' => ['name' => 'Australia', 'flag' => '🇦🇺'],
            'AUT' => ['name' => 'Austria', 'flag' => '🇦🇹'],
            'AZE' => ['name' => 'Azerbaijan', 'flag' => '🇦🇿'],
            'BAH' => ['name' => 'Bahamas', 'flag' => '🇧🇸'],
            'BAN' => ['name' => 'Bangladesh', 'flag' => '🇧🇩'],
            'BAR' => ['name' => 'Barbados', 'flag' => '🇧🇧'],
            'BDI' => ['name' => 'Burundi', 'flag' => '🇧🇮'],
            'BEL' => ['name' => 'Belgium', 'flag' => '🇧🇪'],
            'BEN' => ['name' => 'Benin', 'flag' => '🇧🇯'],
            'BER' => ['name' => 'Bermuda', 'flag' => '🇧🇲'],
            'BHU' => ['name' => 'Bhutan', 'flag' => '🇧🇹'],
            'BIH' => ['name' => 'Bosnia and Herzegovina', 'flag' => '🇧🇦'],
            'BIZ' => ['name' => 'Belize', 'flag' => '🇧🇿'],
            'BLR' => ['name' => 'Belarus', 'flag' => '🇧🇾'],
            'BOL' => ['name' => 'Bolivia', 'flag' => '🇧🇴'],
            'BOT' => ['name' => 'Botswana', 'flag' => '🇧🇼'],
            'BRA' => ['name' => 'Brazil', 'flag' => '🇧🇷'],
            'BRN' => ['name' => 'Bahrain', 'flag' => '🇧🇭'],
            'BRU' => ['name' => 'Brunei', 'flag' => '🇧🇳'],
            'BUL' => ['name' => 'Bulgaria', 'flag' => '🇧🇬'],
            'BUR' => ['name' => 'Burkina Faso', 'flag' => '🇧🇫'],
            'CAF' => ['name' => 'Central African Republic', 'flag' => '🇨🇫'],
            'CAM' => ['name' => 'Cambodia', 'flag' => '🇰🇭'],
            'CAN' => ['name' => 'Canada', 'flag' => '🇨🇦'],
            'CAY' => ['name' => 'Cayman Islands', 'flag' => '🇰🇾'],
            'CGO' => ['name' => 'Congo', 'flag' => '🇨🇬'],
            'CHA' => ['name' => 'Chad', 'flag' => '🇹🇩'],
            'CHI' => ['name' => 'Chile', 'flag' => '🇨🇱'],
            'CHN' => ['name' => 'China', 'flag' => '🇨🇳'],
            'CIV' => ['name' => 'Ivory Coast', 'flag' => '🇨🇮'],
            'CMR' => ['name' => 'Cameroon', 'flag' => '🇨🇲'],
            'COD' => ['name' => 'DR Congo', 'flag' => '🇨🇩'],
            'COK' => ['name' => 'Cook Islands', 'flag' => '🇨🇰'],
            'COL' => ['name' => 'Colombia', 'flag' => '🇨🇴'],
            'COM' => ['name' => 'Comoros', 'flag' => '🇰🇲'],
            'CPV' => ['name' => 'Cape Verde', 'flag' => '🇨🇻'],
            'CRC' => ['name' => 'Costa Rica', 'flag' => '🇨🇷'],
            'CRO' => ['name' => 'Croatia', 'flag' => '🇭🇷'],
            'CUB' => ['name' => 'Cuba', 'flag' => '🇨🇺'],
            'CYP' => ['name' => 'Cyprus', 'flag' => '🇨🇾'],
            'CZE' => ['name' => 'Czech Republic', 'flag' => '🇨🇿'],
            'DEN' => ['name' => 'Denmark', 'flag' => '🇩🇰'],
            'DJI' => ['name' => 'Djibouti', 'flag' => '🇩🇯'],
            'DMA' => ['name' => 'Dominica', 'flag' => '🇩🇲'],
            'DOM' => ['name' => 'Dominican Republic', 'flag' => '🇩🇴'],
            'ECU' => ['name' => 'Ecuador', 'flag' => '🇪🇨'],
            'EGY' => ['name' => 'Egypt', 'flag' => '🇪🇬'],
            'ERI' => ['name' => 'Eritrea', 'flag' => '🇪🇷'],
            'ESA' => ['name' => 'El Salvador', 'flag' => '🇸🇻'],
            'ESP' => ['name' => 'Spain', 'flag' => '🇪🇸'],
            'EST' => ['name' => 'Estonia', 'flag' => '🇪🇪'],
            'ETH' => ['name' => 'Ethiopia', 'flag' => '🇪🇹'],
            'FIJ' => ['name' => 'Fiji', 'flag' => '🇫🇯'],
            'FIN' => ['name' => 'Finland', 'flag' => '🇫🇮'],
            'FRA' => ['name' => 'France', 'flag' => '🇫🇷'],
            'FSM' => ['name' => 'Micronesia', 'flag' => '🇫🇲'],
            'GAB' => ['name' => 'Gabon', 'flag' => '🇬🇦'],
            'GAM' => ['name' => 'Gambia', 'flag' => '🇬🇲'],
            'GBR' => ['name' => 'Great Britain', 'flag' => '🇬🇧'],
            'GBS' => ['name' => 'Guinea-Bissau', 'flag' => '🇬🇼'],
            'GEO' => ['name' => 'Georgia', 'flag' => '🇬🇪'],
            'GEQ' => ['name' => 'Equatorial Guinea', 'flag' => '🇬🇶'],
            'GER' => ['name' => 'Germany', 'flag' => '🇩🇪'],
            'GHA' => ['name' => 'Ghana', 'flag' => '🇬🇭'],
            'GRE' => ['name' => 'Greece', 'flag' => '🇬🇷'],
            'GRN' => ['name' => 'Grenada', 'flag' => '🇬🇩'],
            'GUA' => ['name' => 'Guatemala', 'flag' => '🇬🇹'],
            'GUI' => ['name' => 'Guinea', 'flag' => '🇬🇳'],
            'GUM' => ['name' => 'Guam', 'flag' => '🇬🇺'],
            'GUY' => ['name' => 'Guyana', 'flag' => '🇬🇾'],
            'HAI' => ['name' => 'Haiti', 'flag' => '🇭🇹'],
            'HKG' => ['name' => 'Hong Kong', 'flag' => '🇭🇰'],
            'HON' => ['name' => 'Honduras', 'flag' => '🇭🇳'],
            'HUN' => ['name' => 'Hungary', 'flag' => '🇭🇺'],
            'INA' => ['name' => 'Indonesia', 'flag' => '🇮🇩'],
            'IND' => ['name' => 'India', 'flag' => '🇮🇳'],
            'IRI' => ['name' => 'Iran', 'flag' => '🇮🇷'],
            'IRL' => ['name' => 'Ireland', 'flag' => '🇮🇪'],
            'IRQ' => ['name' => 'Iraq', 'flag' => '🇮🇶'],
            'ISL' => ['name' => 'Iceland', 'flag' => '🇮🇸'],
            'ISR' => ['name' => 'Israel', 'flag' => '🇮🇱'],
            'ISV' => ['name' => 'US Virgin Islands', 'flag' => '🇻🇮'],
            'ITA' => ['name' => 'Italy', 'flag' => '🇮🇹'],
            'IVB' => ['name' => 'British Virgin Islands', 'flag' => '🇻🇬'],
            'JAM' => ['name' => 'Jamaica', 'flag' => '🇯🇲'],
            'JOR' => ['name' => 'Jordan', 'flag' => '🇯🇴'],
            'JPN' => ['name' => 'Japan', 'flag' => '🇯🇵'],
            'KAZ' => ['name' => 'Kazakhstan', 'flag' => '🇰🇿'],
            'KEN' => ['name' => 'Kenya', 'flag' => '🇰🇪'],
            'KGZ' => ['name' => 'Kyrgyzstan', 'flag' => '🇰🇬'],
            'KIR' => ['name' => 'Kiribati', 'flag' => '🇰🇮'],
            'KOR' => ['name' => 'South Korea', 'flag' => '🇰🇷'],
            'KOS' => ['name' => 'Kosovo', 'flag' => '🇽🇰'],
            'KSA' => ['name' => 'Saudi Arabia', 'flag' => '🇸🇦'],
            'KUW' => ['name' => 'Kuwait', 'flag' => '🇰🇼'],
            'LAO' => ['name' => 'Laos', 'flag' => '🇱🇦'],
            'LAT' => ['name' => 'Latvia', 'flag' => '🇱🇻'],
            'LBA' => ['name' => 'Libya', 'flag' => '🇱🇾'],
            'LBN' => ['name' => 'Lebanon', 'flag' => '🇱🇧'],
            'LBR' => ['name' => 'Liberia', 'flag' => '🇱🇷'],
            'LCA' => ['name' => 'Saint Lucia', 'flag' => '🇱🇨'],
            'LES' => ['name' => 'Lesotho', 'flag' => '🇱🇸'],
            'LIE' => ['name' => 'Liechtenstein', 'flag' => '🇱🇮'],
            'LTU' => ['name' => 'Lithuania', 'flag' => '🇱🇹'],
            'LUX' => ['name' => 'Luxembourg', 'flag' => '🇱🇺'],
            'MAD' => ['name' => 'Madagascar', 'flag' => '🇲🇬'],
            'MAR' => ['name' => 'Morocco', 'flag' => '🇲🇦'],
            'MAS' => ['name' => 'Malaysia', 'flag' => '🇲🇾'],
            'MAW' => ['name' => 'Malawi', 'flag' => '🇲🇼'],
            'MDA' => ['name' => 'Moldova', 'flag' => '🇲🇩'],
            'MDV' => ['name' => 'Maldives', 'flag' => '🇲🇻'],
            'MEX' => ['name' => 'Mexico', 'flag' => '🇲🇽'],
            'MGL' => ['name' => 'Mongolia', 'flag' => '🇲🇳'],
            'MKD' => ['name' => 'North Macedonia', 'flag' => '🇲🇰'],
            'MLI' => ['name' => 'Mali', 'flag' => '🇲🇱'],
            'MLT' => ['name' => 'Malta', 'flag' => '🇲🇹'],
            'MNE' => ['name' => 'Montenegro', 'flag' => '🇲🇪'],
            'MON' => ['name' => 'Monaco', 'flag' => '🇲🇨'],
            'MOZ' => ['name' => 'Mozambique', 'flag' => '🇲🇿'],
            'MRI' => ['name' => 'Mauritius', 'flag' => '🇲🇺'],
            'MTN' => ['name' => 'Mauritania', 'flag' => '🇲🇷'],
            'MYA' => ['name' => 'Myanmar', 'flag' => '🇲🇲'],
            'NAM' => ['name' => 'Namibia', 'flag' => '🇳🇦'],
            'NCA' => ['name' => 'Nicaragua', 'flag' => '🇳🇮'],
            'NED' => ['name' => 'Netherlands', 'flag' => '🇳🇱'],
            'NEP' => ['name' => 'Nepal', 'flag' => '🇳🇵'],
            'NGR' => ['name' => 'Nigeria', 'flag' => '🇳🇬'],
            'NIG' => ['name' => 'Niger', 'flag' => '🇳🇪'],
            'NOR' => ['name' => 'Norway', 'flag' => '🇳🇴'],
            'NRU' => ['name' => 'Nauru', 'flag' => '🇳🇷'],
            'NZL' => ['name' => 'New Zealand', 'flag' => '🇳🇿'],
            'OMA' => ['name' => 'Oman', 'flag' => '🇴🇲'],
            'PAK' => ['name' => 'Pakistan', 'flag' => '🇵🇰'],
            'PAN' => ['name' => 'Panama', 'flag' => '🇵🇦'],
            'PAR' => ['name' => 'Paraguay', 'flag' => '🇵🇾'],
            'PER' => ['name' => 'Peru', 'flag' => '🇵🇪'],
            'PHI' => ['name' => 'Philippines', 'flag' => '🇵🇭'],
            'PLE' => ['name' => 'Palestine', 'flag' => '🇵🇸'],
            'PLW' => ['name' => 'Palau', 'flag' => '🇵🇼'],
            'PNG' => ['name' => 'Papua New Guinea', 'flag' => '🇵🇬'],
            'POL' => ['name' => 'Poland', 'flag' => '🇵🇱'],
            'POR' => ['name' => 'Portugal', 'flag' => '🇵🇹'],
            'PRK' => ['name' => 'North Korea', 'flag' => '🇰🇵'],
            'PUR' => ['name' => 'Puerto Rico', 'flag' => '🇵🇷'],
            'QAT' => ['name' => 'Qatar', 'flag' => '🇶🇦'],
            'ROU' => ['name' => 'Romania', 'flag' => '🇷🇴'],
            'RSA' => ['name' => 'South Africa', 'flag' => '🇿🇦'],
            'RUS' => ['name' => 'Russia', 'flag' => '🇷🇺'],
            'RWA' => ['name' => 'Rwanda', 'flag' => '🇷🇼'],
            'SAM' => ['name' => 'Samoa', 'flag' => '🇼🇸'],
            'SEN' => ['name' => 'Senegal', 'flag' => '🇸🇳'],
            'SEY' => ['name' => 'Seychelles', 'flag' => '🇸🇨'],
            'SIN' => ['name' => 'Singapore', 'flag' => '🇸🇬'],
            'SKN' => ['name' => 'Saint Kitts and Nevis', 'flag' => '🇰🇳'],
            'SLE' => ['name' => 'Sierra Leone', 'flag' => '🇸🇱'],
            'SLO' => ['name' => 'Slovenia', 'flag' => '🇸🇮'],
            'SMR' => ['name' => 'San Marino', 'flag' => '🇸🇲'],
            'SOL' => ['name' => 'Solomon Islands', 'flag' => '🇸🇧'],
            'SOM' => ['name' => 'Somalia', 'flag' => '🇸🇴'],
            'SRB' => ['name' => 'Serbia', 'flag' => '🇷🇸'],
            'SRI' => ['name' => 'Sri Lanka', 'flag' => '🇱🇰'],
            'SSD' => ['name' => 'South Sudan', 'flag' => '🇸🇸'],
            'STP' => ['name' => 'Sao Tome and Principe', 'flag' => '🇸🇹'],
            'SUD' => ['name' => 'Sudan', 'flag' => '🇸🇩'],
            'SUI' => ['name' => 'Switzerland', 'flag' => '🇨🇭'],
            'SUR' => ['name' => 'Suriname', 'flag' => '🇸🇷'],
            'SVK' => ['name' => 'Slovakia', 'flag' => '🇸🇰'],
            'SWE' => ['name' => 'Sweden', 'flag' => '🇸🇪'],
            'SWZ' => ['name' => 'Eswatini', 'flag' => '🇸🇿'],
            'SYR' => ['name' => 'Syria', 'flag' => '🇸🇾'],
            'TAN' => ['name' => 'Tanzania', 'flag' => '🇹🇿'],
            'TGA' => ['name' => 'Tonga', 'flag' => '🇹🇴'],
            'THA' => ['name' => 'Thailand', 'flag' => '🇹🇭'],
            'TJK' => ['name' => 'Tajikistan', 'flag' => '🇹🇯'],
            'TKM' => ['name' => 'Turkmenistan', 'flag' => '🇹🇲'],
            'TLS' => ['name' => 'Timor-Leste', 'flag' => '🇹🇱'],
            'TOG' => ['name' => 'Togo', 'flag' => '🇹🇬'],
            'TPE' => ['name' => 'Chinese Taipei', 'flag' => '🇹🇼'],
            'TTO' => ['name' => 'Trinidad and Tobago', 'flag' => '🇹🇹'],
            'TUN' => ['name' => 'Tunisia', 'flag' => '🇹🇳'],
            'TUR' => ['name' => 'Turkey', 'flag' => '🇹🇷'],
            'TUV' => ['name' => 'Tuvalu', 'flag' => '🇹🇻'],
            'UAE' => ['name' => 'United Arab Emirates', 'flag' => '🇦🇪'],
            'UGA' => ['name' => 'Uganda', 'flag' => '🇺🇬'],
            'UKR' => ['name' => 'Ukraine', 'flag' => '🇺🇦'],
            'URU' => ['name' => 'Uruguay', 'flag' => '🇺🇾'],
            'USA' => ['name' => 'United States', 'flag' => '🇺🇸'],
            'UZB' => ['name' => 'Uzbekistan', 'flag' => '🇺🇿'],
            'VAN' => ['name' => 'Vanuatu', 'flag' => '🇻🇺'],
            'VEN' => ['name' => 'Venezuela', 'flag' => '🇻🇪'],
            'VIE' => ['name' => 'Vietnam', 'flag' => '🇻🇳'],
            'VIN' => ['name' => 'Saint Vincent and the Grenadines', 'flag' => '🇻🇨'],
            'YEM' => ['name' => 'Yemen', 'flag' => '🇾🇪'],
            'ZAM' => ['name' => 'Zambia', 'flag' => '🇿🇲'],
            'ZIM' => ['name' => 'Zimbabwe', 'flag' => '🇿🇼'],
        ];
    }

    /**
     * Get country name by code
     *
     * @param string $code ISO 3-letter country code
     * @return string Country name or code if not found
     */
    public static function getCountryName(string $code): string
    {
        $countries = self::getAllCountries();
        return $countries[$code]['name'] ?? $code;
    }

    /**
     * Get country flag emoji by code
     *
     * @param string $code ISO 3-letter country code
     * @return string Flag emoji or empty string if not found
     */
    public static function getFlag(string $code): string
    {
        $countries = self::getAllCountries();
        if (isset($countries[$code])) {
            return $countries[$code]['flag'];
        }

        // Try alpha-2 code (2-letter ISO 3166-1) — generate flag algorithmically
        if (strlen($code) === 2 && ctype_alpha($code)) {
            return self::flagFromAlpha2($code);
        }

        return '';
    }

    /**
     * Generate flag emoji from ISO 3166-1 alpha-2 code
     *
     * Uses Unicode Regional Indicator Symbols (U+1F1E6..U+1F1FF)
     * to produce flag emojis without needing a lookup table.
     *
     * @param string $code 2-letter country code (e.g., "NZ", "QA")
     * @return string Flag emoji
     */
    public static function flagFromAlpha2(string $code): string
    {
        if (strlen($code) !== 2) {
            return '';
        }
        $code = strtoupper($code);
        $first = mb_chr(0x1F1E6 + ord($code[0]) - ord('A'));
        $second = mb_chr(0x1F1E6 + ord($code[1]) - ord('A'));
        return $first . $second;
    }

    /**
     * Get country data by code
     *
     * @param string $code ISO 3-letter country code
     * @return array{name: string, flag: string}|null Country data or null if not found
     */
    public static function getCountry(string $code): ?array
    {
        $countries = self::getAllCountries();
        return $countries[$code] ?? null;
    }

    /**
     * Search countries by name or code
     *
     * @param string $query Search query
     * @return array<string, array{name: string, flag: string}> Matching countries
     */
    public static function searchCountries(string $query): array
    {
        $query = strtolower(trim($query));
        if (empty($query)) {
            return self::getAllCountries();
        }

        $countries = self::getAllCountries();
        $results = [];

        foreach ($countries as $code => $data) {
            if (
                str_contains(strtolower($code), $query) ||
                str_contains(strtolower($data['name']), $query)
            ) {
                $results[$code] = $data;
            }
        }

        return $results;
    }
}
