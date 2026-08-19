<?php
/**
 * Main plugin class
 *
 * @package BeachVolleyResults
 */

declare(strict_types=1);

namespace BeachVolleyResults;

use BeachVolleyResults\Api\Client;
use BeachVolleyResults\Api\ResponseParser;
use BeachVolleyResults\Cache\CacheManager;
use BeachVolleyResults\Utils\CountryHelper;

/**
 * Plugin singleton class
 */
final class Plugin
{
    /**
     * Allowed tournament types (international professional events only)
     */
    private const ALLOWED_TOURNAMENT_TYPES = [
        51, 52, 53,             // BPT Elite16, Challenge, Futures
        4,                      // World Championship
        5,                      // Olympic Games
        7,                      // Continental Championship
        13, 14,                 // Junior/Youth World Championship
        22, 23, 24, 47, 48,    // Continental Championship U18-U22
        25, 26, 27, 31,         // World Championship U17-U23
        49,                     // Olympic Qualification
        43,                     // Youth Olympic Games
        44,                     // Multi-Sport Event (incl. European Games)
    ];

    /**
     * Plugin instance
     */
    private static ?Plugin $instance = null;

    /**
     * Plugin settings
     */
    private array $settings = [];

    /**
     * API Client instance
     */
    private ?Client $apiClient = null;

    /**
     * Cache Manager instance
     */
    private ?CacheManager $cacheManager = null;

    /**
     * Get plugin instance
     */
    public static function getInstance(): Plugin
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Private constructor (singleton)
     */
    private function __construct()
    {
        $this->loadSettings();
        $this->initServices();
        $this->initHooks();
    }

    /**
     * Initialize services (API client, cache)
     */
    private function initServices(): void
    {
        $this->cacheManager = new CacheManager();
        $this->apiClient = new Client(
            $this->cacheManager,
            $this->settings['api_timeout']
        );
    }

    /**
     * Get API client
     */
    public function getApiClient(): Client
    {
        if ($this->apiClient === null) {
            $this->initServices();
        }
        return $this->apiClient;
    }

    /**
     * Get cache manager
     */
    public function getCacheManager(): CacheManager
    {
        if ($this->cacheManager === null) {
            $this->initServices();
        }
        return $this->cacheManager;
    }

    /**
     * Prevent cloning
     */
    private function __clone()
    {
    }

    /**
     * Prevent unserialization
     */
    public function __wakeup(): void
    {
        throw new \Exception('Cannot unserialize singleton');
    }

    /**
     * Load plugin settings
     */
    private function loadSettings(): void
    {
        $defaults = [
            'cache_live' => 30,
            'cache_tournaments' => 21600,
            'cache_finished' => 86400,
            'default_season' => (int) date('Y'),
            'default_limit' => 20,
            'auto_refresh_enabled' => true,
            'api_timeout' => 10,
            'primary_color' => '#01224d',
            'custom_css' => '',
        ];

        $saved = get_option('bvr_settings', []);
        $this->settings = wp_parse_args($saved, $defaults);
    }

    /**
     * Initialize WordPress hooks
     */
    private function initHooks(): void
    {
        // Load text domain
        add_action('init', [$this, 'loadTextDomain']);

        // Initialize components when WordPress is ready
        add_action('init', [$this, 'initComponents'], 10);

        // Admin hooks
        if (is_admin()) {
            add_action('admin_menu', [$this, 'registerAdminMenu']);
            add_action('admin_init', [$this, 'registerSettings']);
        }

        // Frontend hooks
        add_action('wp_enqueue_scripts', [$this, 'enqueueAssets']);

        // AJAX hooks
        add_action('wp_ajax_bvr_refresh_live', [$this, 'ajaxRefreshLive']);
        add_action('wp_ajax_nopriv_bvr_refresh_live', [$this, 'ajaxRefreshLive']);
        add_action('wp_ajax_bvr_get_country_matches', [$this, 'ajaxGetCountryMatches']);
        add_action('wp_ajax_nopriv_bvr_get_country_matches', [$this, 'ajaxGetCountryMatches']);
    }

    /**
     * Load plugin text domain for translations
     */
    public function loadTextDomain(): void
    {
        load_plugin_textdomain(
            'beach-volley-results',
            false,
            dirname(BVR_PLUGIN_BASENAME) . '/languages'
        );
    }

    /**
     * Initialize plugin components
     */
    public function initComponents(): void
    {
        // Register shortcodes
        $this->registerShortcodes();
    }

    /**
     * Register all shortcodes
     */
    private function registerShortcodes(): void
    {
        // [bvr_live_widget]
        add_shortcode('bvr_live_widget', [$this, 'renderLiveWidget']);

        // [bvr_results]
        add_shortcode('bvr_results', [$this, 'renderResults']);

        // [bvr_polish_teams]
        add_shortcode('bvr_polish_teams', [$this, 'renderPolishTeams']);

        // [bvr_tournament]
        add_shortcode('bvr_tournament', [$this, 'renderTournament']);

        // [bvr_match_center]
        add_shortcode('bvr_match_center', [$this, 'renderMatchCenter']);
    }

    /**
     * Render [bvr_live_widget] shortcode
     */
    public function renderLiveWidget(array $atts): string
    {
        $atts = shortcode_atts([
            'title' => __('Beach Volley Live', 'beach-volley-results'),
            'limit' => 5,
            'show_link' => true,
            'link_url' => '',
        ], $atts, 'bvr_live_widget');

        $limit = absint($atts['limit']);
        $title = sanitize_text_field($atts['title']);
        $showLink = filter_var($atts['show_link'], FILTER_VALIDATE_BOOLEAN);
        $linkUrl = esc_url($atts['link_url']);

        // Get live matches using proper logic:
        // 1. Get tournaments by date range (not API status filter)
        // 2. Fetch matches per tournament
        // 3. Filter by Status code in PHP
        $liveData = $this->apiClient->getAllLiveMatches();

        $liveMatches = array_slice($liveData['live'] ?? [], 0, $limit);
        $breakMatches = array_slice($liveData['break'] ?? [], 0, $limit);

        // Determine what to show - ONLY live/break matches or "no matches"
        $hasLiveMatches = !empty($liveMatches);
        $hasBreakMatches = !empty($breakMatches);

        // Build output
        ob_start();
        ?>
        <div class="bvr-live-widget" data-auto-refresh="<?php echo $this->settings['auto_refresh_enabled'] ? 'true' : 'false'; ?>">
            <div class="bvr-widget__header">
                <span class="bvr-icon">🏐</span>
                <h3><?php echo esc_html($title); ?></h3>
                <?php if ($hasLiveMatches): ?>
                    <span class="bvr-live-dot"></span>
                <?php endif; ?>
            </div>
            <div class="bvr-widget__content">
                <?php if ($hasLiveMatches): ?>
                    <!-- LIVE matches (in progress during a set) -->
                    <?php foreach ($liveMatches as $match): ?>
                        <?php echo $this->renderLiveMatchCard($match); ?>
                    <?php endforeach; ?>

                <?php elseif ($hasBreakMatches): ?>
                    <!-- Matches in break between sets -->
                    <p class="bvr-widget__info">
                        <?php esc_html_e('Break between sets:', 'beach-volley-results'); ?>
                    </p>
                    <?php foreach ($breakMatches as $match): ?>
                        <?php echo $this->renderLiveMatchCard($match); ?>
                    <?php endforeach; ?>

                <?php else: ?>
                    <?php
                    // Show next upcoming tournament instead of blank message
                    $upcoming = $this->apiClient->getUpcomingTournaments(1);
                    if (!empty($upcoming)):
                        $next = $upcoming[0];
                        $nextDate = $next['start_date_main'] ?? $next['start_date'] ?? '';
                        $daysUntil = !empty($nextDate) ? max(0, (int) ((strtotime($nextDate) - time()) / 86400)) : null;
                        $nextFlag = CountryHelper::getFlag($next['country_code'] ?? '');
                    ?>
                        <div class="bvr-empty-state">
                            <span class="bvr-empty-state__icon">&#x1F3D0;</span>
                            <p class="bvr-empty-state__text"><?php esc_html_e('No live matches right now', 'beach-volley-results'); ?></p>
                            <div class="bvr-empty-state__next">
                                <span class="bvr-empty-state__label"><?php esc_html_e('Next:', 'beach-volley-results'); ?></span>
                                <span class="bvr-empty-state__tournament">
                                    <?php if ($nextFlag): ?>
                                        <?php echo esc_html($nextFlag); ?>
                                    <?php endif; ?>
                                    <?php echo esc_html($next['title']); ?>
                                </span>
                                <?php if ($daysUntil !== null): ?>
                                    <span class="bvr-empty-state__countdown">
                                        <?php if ($daysUntil === 0): ?>
                                            <?php esc_html_e('Starting today', 'beach-volley-results'); ?>
                                        <?php elseif ($daysUntil === 1): ?>
                                            <?php esc_html_e('Tomorrow', 'beach-volley-results'); ?>
                                        <?php else: ?>
                                            <?php printf(esc_html__('In %d days', 'beach-volley-results'), $daysUntil); ?>
                                        <?php endif; ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php else: ?>
                        <p class="bvr-empty"><?php esc_html_e('No matches currently', 'beach-volley-results'); ?></p>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
            <?php if ($showLink): ?>
                <a href="<?php echo esc_url($linkUrl ?: '#'); ?>" class="bvr-widget__link">
                    <?php esc_html_e('View All Results', 'beach-volley-results'); ?> &rarr;
                </a>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render a live match card with status indicator
     */
    private function renderLiveMatchCard(array $match): string
    {
        $isLive = ($match['status'] ?? '') === 'live';
        $isBreak = ($match['status'] ?? '') === 'break';
        $statusText = $match['status_text'] ?? '';

        $classes = ['bvr-match-card'];
        if ($isLive) $classes[] = 'bvr-match-card--live';
        elseif ($isBreak) $classes[] = 'bvr-match-card--break';

        ob_start();
        ?>
        <div class="<?php echo esc_attr(implode(' ', $classes)); ?>" data-match-id="<?php echo esc_attr($match['id']); ?>">
            <div class="bvr-match-card__status-bar">
                <?php if ($isLive): ?>
                    <span class="bvr-status-live"><?php echo esc_html($statusText ?: 'LIVE'); ?></span>
                <?php elseif ($isBreak): ?>
                    <span class="bvr-status-break"><?php echo esc_html($statusText ?: 'Break'); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['court'])): ?>
                    <span class="bvr-match-card__court"><?php echo esc_html($match['court']); ?></span>
                <?php endif; ?>
            </div>
            <div class="bvr-match-card__teams">
                <div class="bvr-match-card__team">
                    <span class="bvr-match-card__team-name">
                        <span class="bvr-match-card__flag"><?php echo esc_html($match['team_a']['country_code']); ?></span>
                        <?php echo esc_html($match['team_a']['name']); ?>
                    </span>
                    <span class="bvr-match-card__score <?php echo ($match['winner'] === 'a') ? 'bvr-match-card__score--winner' : ''; ?>">
                        <?php echo esc_html($match['match_points']['team_a']); ?>
                    </span>
                </div>
                <div class="bvr-match-card__team">
                    <span class="bvr-match-card__team-name">
                        <span class="bvr-match-card__flag"><?php echo esc_html($match['team_b']['country_code']); ?></span>
                        <?php echo esc_html($match['team_b']['name']); ?>
                    </span>
                    <span class="bvr-match-card__score <?php echo ($match['winner'] === 'b') ? 'bvr-match-card__score--winner' : ''; ?>">
                        <?php echo esc_html($match['match_points']['team_b']); ?>
                    </span>
                </div>
            </div>
            <?php if (!empty($match['scores'])): ?>
                <div class="bvr-match-card__sets">
                    <?php foreach ($match['scores'] as $set): ?>
                        <span>(<?php echo esc_html($set['team_a'] . '-' . $set['team_b']); ?>)</span>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
            <?php if (!empty($match['tournament']['title'])): ?>
                <div class="bvr-match-card__tournament">
                    <?php echo esc_html($match['tournament']['title']); ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render a single match card
     */
    private function renderMatchCard(array $match): string
    {
        $isLive = $match['status'] === 'live';
        $isHighlighted = false; // Could check for favorite country

        $classes = ['bvr-match-card'];
        if ($isLive) $classes[] = 'bvr-match-card--live';
        elseif ($match['status'] === 'finished') $classes[] = 'bvr-match-card--finished';
        if ($isHighlighted) $classes[] = 'bvr-match-card--highlighted';

        ob_start();
        ?>
        <div class="<?php echo esc_attr(implode(' ', $classes)); ?>" data-match-id="<?php echo esc_attr($match['id']); ?>">
            <div class="bvr-match-card__teams">
                <div class="bvr-match-card__team">
                    <span class="bvr-match-card__team-name">
                        <span class="bvr-match-card__flag"><?php echo esc_html($match['team_a']['country_code']); ?></span>
                        <?php echo esc_html($match['team_a']['name']); ?>
                    </span>
                    <span class="bvr-match-card__score <?php echo ($match['winner'] === 'a') ? 'bvr-match-card__score--winner' : ''; ?>">
                        <?php echo esc_html($match['match_points']['team_a']); ?>
                    </span>
                </div>
                <div class="bvr-match-card__team">
                    <span class="bvr-match-card__team-name">
                        <span class="bvr-match-card__flag"><?php echo esc_html($match['team_b']['country_code']); ?></span>
                        <?php echo esc_html($match['team_b']['name']); ?>
                    </span>
                    <span class="bvr-match-card__score <?php echo ($match['winner'] === 'b') ? 'bvr-match-card__score--winner' : ''; ?>">
                        <?php echo esc_html($match['match_points']['team_b']); ?>
                    </span>
                </div>
            </div>
            <?php if (!empty($match['scores'])): ?>
                <div class="bvr-match-card__sets">
                    <?php foreach ($match['scores'] as $set): ?>
                        <span>(<?php echo esc_html($set['team_a'] . '-' . $set['team_b']); ?>)</span>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
            <div class="bvr-match-card__meta">
                <?php if (!empty($match['round'])): ?>
                    <span><?php echo esc_html($match['round']); ?></span>
                <?php endif; ?>
                <?php if ($isLive): ?>
                    <span class="bvr-status-live"><?php esc_html_e('LIVE', 'beach-volley-results'); ?></span>
                <?php elseif (!empty($match['date'])): ?>
                    <span><?php echo esc_html($this->formatDate($match['date'])); ?></span>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Format date to DD-MM-YYYY
     */
    private function formatDate(string $date): string
    {
        if (empty($date)) return '';
        $timestamp = strtotime($date);
        if ($timestamp === false) return $date;
        return date('d-m-Y', $timestamp);
    }

    /**
     * Render [bvr_results] shortcode
     */
    public function renderResults(array $atts): string
    {
        $atts = shortcode_atts([
            'preset' => 'all',
            'season' => (int) date('Y'),
            'gender' => 'all',
            'type' => '',
            'limit' => $this->settings['default_limit'],
            'auto_refresh' => 0,
            'show_pagination' => true,
            'show_filters' => true,
        ], $atts, 'bvr_results');

        // Check if viewing a specific match (Match Center with back button)
        $matchId = isset($_GET['bvr_match']) ? absint($_GET['bvr_match']) : 0;
        $tournamentIdForBack = isset($_GET['bvr_tournament']) ? absint($_GET['bvr_tournament']) : 0;
        if ($matchId > 0) {
            return $this->renderMatchCenterWithBackButton($matchId, $tournamentIdForBack);
        }

        // Check if viewing a specific tournament
        $tournamentId = isset($_GET['bvr_tournament']) ? absint($_GET['bvr_tournament']) : 0;
        if ($tournamentId > 0) {
            return $this->renderTournamentDetail($tournamentId);
        }

        // Get filter values from URL parameters (allows filter persistence)
        $season = isset($_GET['bvr_season']) ? absint($_GET['bvr_season']) : absint($atts['season']);
        $gender = isset($_GET['bvr_gender']) ? sanitize_text_field($_GET['bvr_gender']) : sanitize_text_field($atts['gender']);
        $limit = absint($atts['limit']);
        $preset = sanitize_text_field($atts['preset']);

        // Get tournaments
        $tournaments = $this->apiClient->getTournaments($season);

        // Filter by whitelist of allowed tournament types
        $tournaments = array_filter($tournaments, fn($t) => in_array($t['type_code'] ?? 0, self::ALLOWED_TOURNAMENT_TYPES, true));

        // Filter by gender
        // Note: MW (both genders) tournaments should appear in both M and W filters
        if ($gender !== 'all') {
            $tournaments = array_filter($tournaments, function ($t) use ($gender) {
                $tGender = $t['gender'] ?? '';
                return $tGender === $gender || $tGender === 'MW' || $tGender === 'Mixed';
            });
        }

        // Filter by preset
        if ($preset === 'live') {
            $tournaments = array_filter($tournaments, fn($t) => $t['status'] === 'running');
        } elseif ($preset === 'elite') {
            $eliteTypes = [0, 32, 33, 38, 39, 40, 53];
            $tournaments = array_filter($tournaments, fn($t) => in_array($t['type_code'], $eliteTypes, true));
        }

        // Split into three sections by status
        $live = array_filter($tournaments, fn($t) => $t['status'] === 'running');
        $upcoming = array_filter($tournaments, fn($t) => in_array($t['status'], ['upcoming', 'not_open'], true));
        $recent = array_filter($tournaments, fn($t) => in_array($t['status'], ['finished', 'paid', 'payment_pending'], true));

        // Sort each section
        usort($live, fn($a, $b) => strcmp($a['start_date'], $b['start_date']));
        usort($upcoming, fn($a, $b) => strcmp($a['start_date'], $b['start_date']));
        usort($recent, fn($a, $b) => strcmp($b['start_date'], $a['start_date']));

        // Group M/W tournaments of the same event into single rows
        $liveGroups = $this->groupTournamentsByEvent($live);
        $upcomingGroups = $this->groupTournamentsByEvent($upcoming);
        $recentGroups = $this->groupTournamentsByEvent($recent);

        $totalCount = count($liveGroups) + count($upcomingGroups) + count($recentGroups);
        $initialLimit = $limit;

        // Build filter URL base
        $currentUrl = remove_query_arg(['bvr_tournament', 'bvr_match', 'bvr_season', 'bvr_gender']);

        ob_start();
        ?>
        <div class="bvr-results" data-base-url="<?php echo esc_url($currentUrl); ?>">
            <div class="bvr-results__header">
                <div class="bvr-results__tabs">
                    <button class="bvr-results__tab bvr-results__tab--active" data-tab="tournaments">
                        <?php esc_html_e('Tournaments', 'beach-volley-results'); ?>
                        <span class="bvr-results__count">(<?php echo esc_html($totalCount); ?>)</span>
                    </button>
                </div>
                <?php if (filter_var($atts['show_filters'], FILTER_VALIDATE_BOOLEAN)): ?>
                <div class="bvr-results__filters">
                    <select class="bvr-results__filter" name="gender" onchange="bvrApplyFilters(this)">
                        <option value="all"><?php esc_html_e('All Genders', 'beach-volley-results'); ?></option>
                        <option value="M" <?php selected($gender, 'M'); ?>><?php esc_html_e('Men', 'beach-volley-results'); ?></option>
                        <option value="W" <?php selected($gender, 'W'); ?>><?php esc_html_e('Women', 'beach-volley-results'); ?></option>
                    </select>
                    <select class="bvr-results__filter" name="season" onchange="bvrApplyFilters(this)">
                        <?php for ($y = date('Y'); $y >= 2020; $y--): ?>
                            <option value="<?php echo $y; ?>" <?php selected($season, $y); ?>><?php echo $y; ?></option>
                        <?php endfor; ?>
                    </select>
                </div>
                <?php endif; ?>
            </div>
            <div class="bvr-results__content">
                <?php if (empty($totalCount)): ?>
                    <p class="bvr-empty"><?php esc_html_e('No tournaments found', 'beach-volley-results'); ?></p>
                <?php else: ?>

                    <?php // === LIVE SECTION === ?>
                    <?php if (!empty($liveGroups)): ?>
                    <div class="bvr-section bvr-section--live">
                        <div class="bvr-section__header bvr-section__header--live">
                            <span class="bvr-section__live-dot"></span>
                            <?php esc_html_e('Live', 'beach-volley-results'); ?>
                            <span class="bvr-section__count">(<?php echo count($liveGroups); ?>)</span>
                        </div>
                        <div class="bvr-section__content">
                            <div class="bvr-results__list">
                                <?php foreach ($liveGroups as $group): ?>
                                    <?php echo $this->renderTournamentCard($group); ?>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <?php endif; ?>

                    <?php // === UPCOMING SECTION === ?>
                    <?php if (!empty($upcomingGroups)): ?>
                    <div class="bvr-section bvr-section--upcoming">
                        <div class="bvr-section__header">
                            <?php esc_html_e('Upcoming', 'beach-volley-results'); ?>
                            <span class="bvr-section__count">(<?php echo count($upcomingGroups); ?>)</span>
                        </div>
                        <div class="bvr-section__content">
                            <div class="bvr-results__list">
                                <?php foreach ($upcomingGroups as $index => $group): ?>
                                    <?php if ($index >= $initialLimit): ?>
                                        <div class="bvr-section__hidden-card">
                                            <?php echo $this->renderTournamentCard($group); ?>
                                        </div>
                                    <?php else: ?>
                                        <?php echo $this->renderTournamentCard($group); ?>
                                    <?php endif; ?>
                                <?php endforeach; ?>
                            </div>
                            <?php if (count($upcomingGroups) > $initialLimit): ?>
                                <?php $remaining = count($upcomingGroups) - $initialLimit; ?>
                                <button type="button" class="bvr-load-more" data-step="<?php echo esc_attr($initialLimit); ?>" data-current="<?php echo esc_attr($initialLimit); ?>" data-total="<?php echo esc_attr(count($upcomingGroups)); ?>">
                                    <?php printf(
                                        esc_html__('Show more (%d remaining)', 'beach-volley-results'),
                                        $remaining
                                    ); ?>
                                </button>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php endif; ?>

                    <?php // === RECENT SECTION (collapsed by default) === ?>
                    <?php if (!empty($recentGroups)): ?>
                    <div class="bvr-section bvr-section--recent">
                        <button type="button" class="bvr-section__toggle">
                            <?php printf(
                                esc_html__('Show past tournaments (%d)', 'beach-volley-results'),
                                count($recentGroups)
                            ); ?>
                        </button>
                        <div class="bvr-section__content bvr-section__content--collapsed">
                            <div class="bvr-section__header">
                                <?php esc_html_e('Recent', 'beach-volley-results'); ?>
                                <span class="bvr-section__count">(<?php echo count($recentGroups); ?>)</span>
                            </div>
                            <div class="bvr-results__list">
                                <?php foreach ($recentGroups as $index => $group): ?>
                                    <?php if ($index >= $initialLimit): ?>
                                        <div class="bvr-section__hidden-card">
                                            <?php echo $this->renderTournamentCard($group); ?>
                                        </div>
                                    <?php else: ?>
                                        <?php echo $this->renderTournamentCard($group); ?>
                                    <?php endif; ?>
                                <?php endforeach; ?>
                            </div>
                            <?php if (count($recentGroups) > $initialLimit): ?>
                                <?php $remaining = count($recentGroups) - $initialLimit; ?>
                                <button type="button" class="bvr-load-more" data-step="<?php echo esc_attr($initialLimit); ?>" data-current="<?php echo esc_attr($initialLimit); ?>" data-total="<?php echo esc_attr(count($recentGroups)); ?>">
                                    <?php printf(
                                        esc_html__('Show more (%d remaining)', 'beach-volley-results'),
                                        $remaining
                                    ); ?>
                                </button>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php endif; ?>

                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render Match Center with back button to tournament
     */
    private function renderMatchCenterWithBackButton(int $matchId, int $tournamentId): string
    {
        // Get match details from API
        $match = $this->apiClient->getMatch($matchId);
        if ($match === null) {
            return '<div class="bvr-match-center bvr-match-center--error">' .
                '<p>' . esc_html__('Match not found.', 'beach-volley-results') . '</p>' .
                '</div>';
        }

        $teamAFlag = CountryHelper::getFlag($match['team_a']['country_code'] ?? '');
        $teamBFlag = CountryHelper::getFlag($match['team_b']['country_code'] ?? '');

        $isLive = ($match['status'] ?? '') === 'live';
        $isFinished = ($match['status'] ?? '') === 'finished';
        $statusClass = $isLive ? 'bvr-match-center--live' : '';

        // Calculate total duration from set durations
        $totalDuration = 0;
        foreach ($match['scores'] ?? [] as $set) {
            if (!empty($set['duration'])) {
                $totalDuration += $set['duration'];
            }
        }

        // Build back URL
        $backUrl = $tournamentId > 0
            ? add_query_arg('bvr_tournament', $tournamentId, remove_query_arg('bvr_match'))
            : remove_query_arg(['bvr_match', 'bvr_tournament']);

        ob_start();
        ?>
        <div class="bvr-match-center <?php echo esc_attr($statusClass); ?>" data-match-id="<?php echo esc_attr($matchId); ?>">
            <a href="<?php echo esc_url($backUrl); ?>" class="bvr-match-center__back">
                <span class="bvr-match-center__back-icon">&larr;</span>
                <?php if ($tournamentId > 0): ?>
                    <?php esc_html_e('Back to tournament', 'beach-volley-results'); ?>
                <?php else: ?>
                    <?php esc_html_e('Back to results', 'beach-volley-results'); ?>
                <?php endif; ?>
            </a>

            <div class="bvr-match-center__header">
                <?php if ($isLive): ?>
                    <span class="bvr-status-live">LIVE</span>
                <?php endif; ?>
                <?php if (!empty($match['tournament']['title'])): ?>
                    <span class="bvr-match-center__tournament"><?php echo esc_html($match['tournament']['title']); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['round'])): ?>
                    <span class="bvr-match-center__round"><?php echo esc_html($match['round']); ?></span>
                <?php endif; ?>
            </div>

            <div class="bvr-scoreboard">
                <div class="bvr-scoreboard__team<?php echo ($match['winner'] ?? '') === 'a' ? ' bvr-scoreboard__team--winner' : ''; ?>">
                    <span class="bvr-scoreboard__flag"><?php echo esc_html($teamAFlag); ?></span>
                    <span class="bvr-scoreboard__name"><?php echo esc_html($match['team_a']['name'] ?? ''); ?></span>
                </div>
                <div class="bvr-scoreboard__score">
                    <span class="bvr-scoreboard__points<?php echo ($match['winner'] ?? '') === 'a' ? ' bvr-scoreboard__points--winner' : ''; ?>"><?php echo esc_html($match['match_points']['team_a'] ?? '0'); ?></span>
                    <span class="bvr-scoreboard__vs">vs</span>
                    <span class="bvr-scoreboard__points<?php echo ($match['winner'] ?? '') === 'b' ? ' bvr-scoreboard__points--winner' : ''; ?>"><?php echo esc_html($match['match_points']['team_b'] ?? '0'); ?></span>
                </div>
                <div class="bvr-scoreboard__team<?php echo ($match['winner'] ?? '') === 'b' ? ' bvr-scoreboard__team--winner' : ''; ?>">
                    <span class="bvr-scoreboard__flag"><?php echo esc_html($teamBFlag); ?></span>
                    <span class="bvr-scoreboard__name"><?php echo esc_html($match['team_b']['name'] ?? ''); ?></span>
                </div>
            </div>

            <?php if (!empty($match['scores'])): ?>
            <div class="bvr-match-center__sets">
                <div class="bvr-match-center__sets-grid">
                    <?php foreach ($match['scores'] as $index => $set):
                        $setWinnerA = $set['team_a'] > $set['team_b'];
                        $setWinnerB = $set['team_b'] > $set['team_a'];
                    ?>
                        <div class="bvr-set-pill">
                            <span class="bvr-set-pill__label"><?php printf(esc_html__('Set %d', 'beach-volley-results'), $index + 1); ?></span>
                            <span class="bvr-set-pill__score">
                                <span class="<?php echo $setWinnerA ? 'bvr-set-pill__score--winner' : ''; ?>"><?php echo esc_html($set['team_a']); ?></span>
                                <span class="bvr-set-pill__dash">-</span>
                                <span class="<?php echo $setWinnerB ? 'bvr-set-pill__score--winner' : ''; ?>"><?php echo esc_html($set['team_b']); ?></span>
                            </span>
                            <?php if (!empty($set['duration_formatted'])): ?>
                                <span class="bvr-set-pill__duration"><?php echo esc_html($set['duration_formatted']); ?></span>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>

            <div class="bvr-match-center__meta">
                <?php if (!empty($match['date'])): ?>
                    <span><?php echo esc_html($this->formatDate($match['date'])); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['time'])): ?>
                    <span><?php echo esc_html($match['time']); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['court'])): ?>
                    <span><?php printf(esc_html__('Court %s', 'beach-volley-results'), esc_html($match['court'])); ?></span>
                <?php endif; ?>
                <?php if ($totalDuration > 0): ?>
                    <span><?php printf(esc_html__('Duration: %s', 'beach-volley-results'), esc_html(ResponseParser::formatDuration($totalDuration))); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['venue'])): ?>
                    <span><?php echo esc_html($match['venue']); ?></span>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render tournament detail view with tabs
     */
    private function renderTournamentDetail(int $tournamentId): string
    {
        // Get tournament details
        $tournament = $this->apiClient->getTournament($tournamentId);
        if ($tournament === null) {
            return '<div class="bvr-error">' .
                esc_html__('Tournament not found.', 'beach-volley-results') .
                '</div>';
        }

        // Get matches
        $matches = $this->apiClient->getMatches($tournamentId);

        // Get teams
        $teams = $this->apiClient->getTeams($tournamentId);

        // Build ranking from match results (FIVB API endpoint is disabled)
        $ranking = $this->buildRankingFromMatches($matches);

        // Group matches by round
        $matchesByRound = $this->groupMatchesByRound($matches);

        $statusClass = match ($tournament['status']) {
            'running' => 'bvr-tournament-card__status--live',
            'finished', 'paid', 'payment_pending' => 'bvr-tournament-card__status--finished',
            default => 'bvr-tournament-card__status--upcoming',
        };

        // Back URL (remove tournament param)
        $backUrl = remove_query_arg('bvr_tournament');

        ob_start();
        ?>
        <div class="bvr-tournament-detail">
            <a href="<?php echo esc_url($backUrl); ?>" class="bvr-tournament-detail__back">
                ← <?php esc_html_e('Back to tournaments', 'beach-volley-results'); ?>
            </a>

            <div class="bvr-tournament-detail__header">
                <div class="bvr-tournament-detail__title-row">
                    <h2 class="bvr-tournament-detail__title"><?php echo esc_html($tournament['title']); ?></h2>
                    <span class="bvr-tournament-card__status <?php echo esc_attr($statusClass); ?>">
                        <?php echo esc_html(ResponseParser::getTournamentStatusLabel($tournament['status'])); ?>
                    </span>
                </div>
                <div class="bvr-tournament-detail__meta">
                    <span class="bvr-tournament-detail__location">
                        <?php
                        $locationParts = array_filter([
                            $tournament['city'] ?? '',
                            $tournament['country_name'] ?? '',
                        ]);
                        echo esc_html(implode(', ', $locationParts));
                        ?>
                    </span>
                    <span class="bvr-tournament-detail__dates">
                        <?php echo esc_html($this->formatDate($tournament['start_date'])); ?>
                        <?php if (!empty($tournament['end_date']) && $tournament['end_date'] !== $tournament['start_date']): ?>
                            - <?php echo esc_html($this->formatDate($tournament['end_date'])); ?>
                        <?php endif; ?>
                    </span>
                    <span class="bvr-tournament-detail__type">
                        <?php
                        $genderLabel = ResponseParser::getGenderLabel($tournament['gender']);
                        echo esc_html($genderLabel ? $genderLabel . ' • ' . $tournament['type'] : $tournament['type']);
                        ?>
                    </span>
                </div>
            </div>

            <!-- Tabs -->
            <div class="bvr-tabs">
                <button class="bvr-tab bvr-tab--active" data-tab="matches">
                    <?php esc_html_e('Matches', 'beach-volley-results'); ?>
                    <span class="bvr-tab__count">(<?php echo count($matches); ?>)</span>
                </button>
                <?php if (!empty($ranking)): ?>
                <button class="bvr-tab" data-tab="ranking">
                    <?php esc_html_e('Standings', 'beach-volley-results'); ?>
                </button>
                <?php endif; ?>
                <button class="bvr-tab" data-tab="teams">
                    <?php esc_html_e('Teams', 'beach-volley-results'); ?>
                    <span class="bvr-tab__count">(<?php echo count($teams); ?>)</span>
                </button>
            </div>

            <!-- Tab: Matches -->
            <div class="bvr-tab-content bvr-tab-content--active" id="tab-matches">
                <?php echo $this->renderMatchesTab($matchesByRound, $tournamentId); ?>
            </div>

            <!-- Tab: Ranking -->
            <?php if (!empty($ranking)): ?>
            <div class="bvr-tab-content" id="tab-ranking">
                <?php echo $this->renderRankingTab($ranking); ?>
            </div>
            <?php endif; ?>

            <!-- Tab: Teams -->
            <div class="bvr-tab-content" id="tab-teams">
                <?php echo $this->renderTeamsTab($teams); ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Group matches by round and sort (Finals first)
     */
    private function groupMatchesByRound(array $matches): array
    {
        $matchesByRound = [];
        foreach ($matches as $match) {
            $roundName = $match['round'] ?? __('Other', 'beach-volley-results');
            $matchesByRound[$roundName][] = $match;
        }

        // Sort rounds (Finals first, Pool Play last)
        // Based on ACTUAL FIVB API response data
        $roundOrder = [
            // Finals - actual API names
            'Final 1st Place', 'Final 3rd Place',
            // Legacy names (fallback for older tournaments)
            'Gold Medal Match', 'Bronze Medal Match',
            // Semifinals/Quarters
            'Semifinals', 'Quarterfinals',
            // Elimination rounds (sorted by size - smaller rounds first)
            'Round of 12', 'Round of 16', 'Round of 18', 'Round of 24', 'Round of 32', 'Round of 48',
            // Pool play
            'Pool A', 'Pool B', 'Pool C', 'Pool D', 'Pool E', 'Pool F', 'Pool G', 'Pool H',
            'Pool I', 'Pool J', 'Pool K', 'Pool L',
            'Pool Play',
            // Qualification rounds (at the end)
            'Round 2', 'Round 1',
        ];

        uksort($matchesByRound, function($a, $b) use ($roundOrder) {
            $posA = array_search($a, $roundOrder);
            $posB = array_search($b, $roundOrder);
            if ($posA === false) $posA = 999;
            if ($posB === false) $posB = 999;
            return $posA - $posB;
        });

        return $matchesByRound;
    }

    /**
     * Render Matches tab content
     */
    private function renderMatchesTab(array $matchesByRound, int $tournamentId): string
    {
        if (empty($matchesByRound)) {
            return '<p class="bvr-empty">' . esc_html__('No matches available yet.', 'beach-volley-results') . '</p>';
        }

        ob_start();
        foreach ($matchesByRound as $roundName => $roundMatches): ?>
            <div class="bvr-tournament-detail__round">
                <h4 class="bvr-tournament-detail__round-title"><?php echo esc_html($roundName); ?></h4>
                <div class="bvr-tournament-detail__matches">
                    <?php foreach ($roundMatches as $match): ?>
                        <?php echo $this->renderTournamentMatchCard($match, $tournamentId); ?>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach;
        return ob_get_clean();
    }

    /**
     * Render compact match card for tournament view
     */
    private function renderTournamentMatchCard(array $match, int $tournamentId): string
    {
        $isLive = $match['status'] === 'live' || $match['status'] === 'break';
        $isFinished = $match['status'] === 'finished';

        // Build match URL
        $matchUrl = add_query_arg([
            'bvr_match' => $match['id'],
            'bvr_tournament' => $tournamentId,
        ], get_permalink());

        $classes = ['bvr-tournament-match'];
        if ($isLive) $classes[] = 'bvr-tournament-match--live';

        // Get flags
        $flagA = CountryHelper::getFlag($match['team_a']['country_code'] ?? '');
        $flagB = CountryHelper::getFlag($match['team_b']['country_code'] ?? '');

        // Build set scores string
        $setsA = [];
        $setsB = [];
        foreach ($match['scores'] as $set) {
            if ($set['team_a'] > 0 || $set['team_b'] > 0) {
                $setsA[] = $set['team_a'];
                $setsB[] = $set['team_b'];
            }
        }

        ob_start();
        ?>
        <a href="<?php echo esc_url($matchUrl); ?>" class="<?php echo esc_attr(implode(' ', $classes)); ?>" data-match-id="<?php echo esc_attr($match['id']); ?>">
            <?php if ($isLive): ?>
                <span class="bvr-tournament-match__live-badge"><?php esc_html_e('LIVE', 'beach-volley-results'); ?></span>
            <?php endif; ?>
            <div class="bvr-tournament-match__team">
                <span class="bvr-tournament-match__flag"><?php echo esc_html($flagA ?: $match['team_a']['country_code']); ?></span>
                <span class="bvr-tournament-match__name <?php echo ($match['winner'] === 'a') ? 'bvr-tournament-match__name--winner' : ''; ?>">
                    <?php echo esc_html($match['team_a']['name']); ?>
                </span>
                <?php if (!empty($setsA)): ?>
                    <span class="bvr-tournament-match__sets"><?php echo esc_html(implode(' ', $setsA)); ?></span>
                <?php endif; ?>
                <span class="bvr-tournament-match__score <?php echo ($match['winner'] === 'a') ? 'bvr-tournament-match__score--winner' : ''; ?>">
                    <?php echo esc_html($match['match_points']['team_a']); ?>
                </span>
            </div>
            <div class="bvr-tournament-match__team">
                <span class="bvr-tournament-match__flag"><?php echo esc_html($flagB ?: $match['team_b']['country_code']); ?></span>
                <span class="bvr-tournament-match__name <?php echo ($match['winner'] === 'b') ? 'bvr-tournament-match__name--winner' : ''; ?>">
                    <?php echo esc_html($match['team_b']['name']); ?>
                </span>
                <?php if (!empty($setsB)): ?>
                    <span class="bvr-tournament-match__sets"><?php echo esc_html(implode(' ', $setsB)); ?></span>
                <?php endif; ?>
                <span class="bvr-tournament-match__score <?php echo ($match['winner'] === 'b') ? 'bvr-tournament-match__score--winner' : ''; ?>">
                    <?php echo esc_html($match['match_points']['team_b']); ?>
                </span>
            </div>
        </a>
        <?php
        return ob_get_clean();
    }

    /**
     * Build tournament ranking from match results
     *
     * Since FIVB API GetBeachTournamentRanking returns HTTP 400 (endpoint disabled),
     * we build the ranking based on which team loses in which round.
     *
     * @param array $matches Array of matches from tournament
     * @return array Ranking entries sorted by position
     */
    private function buildRankingFromMatches(array $matches): array
    {
        $ranking = [];

        // Round to position mapping
        // Winner gets 'winner' position, loser gets 'loser' position
        $roundToRank = [
            // Actual API names
            'Final 1st Place' => ['winner' => 1, 'loser' => 2],
            'Final 3rd Place' => ['winner' => 3, 'loser' => 4],
            'Semifinals' => ['loser' => 5],
            'Quarterfinals' => ['loser' => 7],
            'Round of 12' => ['loser' => 11],
            'Round of 18' => ['loser' => 15],
            // Legacy names (for older tournaments)
            'Gold Medal Match' => ['winner' => 1, 'loser' => 2],
            'Bronze Medal Match' => ['winner' => 3, 'loser' => 4],
        ];

        // Rounds where position is shared (ex aequo)
        $sharedRounds = ['Semifinals', 'Quarterfinals', 'Round of 12', 'Round of 18'];

        foreach ($matches as $match) {
            $round = $match['round'] ?? '';
            if (!isset($roundToRank[$round])) {
                continue;
            }

            // Only process finished matches
            if ($match['status'] !== 'finished') {
                continue;
            }

            $config = $roundToRank[$round];
            $isShared = in_array($round, $sharedRounds, true);

            // Determine winner and loser based on match points
            $matchPointsA = $match['match_points']['team_a'] ?? 0;
            $matchPointsB = $match['match_points']['team_b'] ?? 0;

            $teamA = $match['team_a'] ?? [];
            $teamB = $match['team_b'] ?? [];

            if ($matchPointsA > $matchPointsB) {
                $winner = $teamA;
                $loser = $teamB;
            } else {
                $winner = $teamB;
                $loser = $teamA;
            }

            // Add winner to ranking (only for finals)
            if (isset($config['winner']) && !empty($winner['name'])) {
                $ranking[] = [
                    'position' => $config['winner'],
                    'rank_display' => $config['winner'],
                    'team_name' => $winner['name'],
                    'country_code' => $winner['country_code'] ?? '',
                    'is_shared' => false,
                    'points' => 0,
                    'prize' => 0,
                ];
            }

            // Add loser to ranking
            if (isset($config['loser']) && !empty($loser['name'])) {
                $ranking[] = [
                    'position' => $config['loser'],
                    'rank_display' => $config['loser'],
                    'team_name' => $loser['name'],
                    'country_code' => $loser['country_code'] ?? '',
                    'is_shared' => $isShared,
                    'points' => 0,
                    'prize' => 0,
                ];
            }
        }

        // Sort by position
        usort($ranking, fn($a, $b) => $a['position'] - $b['position']);

        return $ranking;
    }

    /**
     * Render Ranking/Standings tab content
     */
    private function renderRankingTab(array $ranking): string
    {
        if (empty($ranking)) {
            return '<p class="bvr-empty">' . esc_html__('Standings not available yet.', 'beach-volley-results') . '</p>';
        }

        ob_start();
        ?>
        <table class="bvr-ranking-table">
            <thead>
                <tr>
                    <th class="bvr-ranking-table__pos">#</th>
                    <th class="bvr-ranking-table__team"><?php esc_html_e('Team', 'beach-volley-results'); ?></th>
                    <th class="bvr-ranking-table__points"><?php esc_html_e('Points', 'beach-volley-results'); ?></th>
                    <th class="bvr-ranking-table__prize"><?php esc_html_e('Prize', 'beach-volley-results'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($ranking as $entry):
                    $rowClass = '';
                    if ($entry['rank_display'] === 1) $rowClass = 'bvr-ranking-row--gold';
                    elseif ($entry['rank_display'] === 2) $rowClass = 'bvr-ranking-row--silver';
                    elseif ($entry['rank_display'] === 3) $rowClass = 'bvr-ranking-row--bronze';

                    $flag = CountryHelper::getFlag($entry['country_code'] ?? '');
                ?>
                <tr class="bvr-ranking-row <?php echo esc_attr($rowClass); ?>">
                    <td class="bvr-ranking-table__pos">
                        <?php echo esc_html($entry['rank_display']); ?>
                        <?php if ($entry['is_shared']): ?>
                            <span class="bvr-ranking-table__shared">=</span>
                        <?php endif; ?>
                    </td>
                    <td class="bvr-ranking-table__team">
                        <span class="bvr-ranking-table__flag"><?php echo esc_html($flag ?: $entry['country_code']); ?></span>
                        <?php echo esc_html($entry['team_name']); ?>
                    </td>
                    <td class="bvr-ranking-table__points"><?php echo esc_html(number_format($entry['points'])); ?></td>
                    <td class="bvr-ranking-table__prize">
                        <?php if ($entry['prize'] > 0): ?>
                            $<?php echo esc_html(number_format($entry['prize'] / 100)); ?>
                        <?php else: ?>
                            -
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php
        return ob_get_clean();
    }

    /**
     * Render Teams tab content with sections
     */
    private function renderTeamsTab(array $teams): string
    {
        if (empty($teams)) {
            return '<p class="bvr-empty">' . esc_html__('No teams registered yet.', 'beach-volley-results') . '</p>';
        }

        // Separate teams into categories
        $mainDraw = [];
        $qualification = [];
        $other = [];

        foreach ($teams as $team) {
            if ($team['in_main_draw']) {
                $mainDraw[] = $team;
            } elseif ($team['in_qualification']) {
                $qualification[] = $team;
            } else {
                $other[] = $team;
            }
        }

        // Sort main draw by seed (seeded first), then by entry points
        usort($mainDraw, function($a, $b) {
            if ($a['seed'] > 0 && $b['seed'] === 0) return -1;
            if ($a['seed'] === 0 && $b['seed'] > 0) return 1;
            if ($a['seed'] > 0 && $b['seed'] > 0) return $a['seed'] - $b['seed'];
            return $b['entry_points'] - $a['entry_points'];
        });

        // Sort qualification by position or entry points
        usort($qualification, function($a, $b) {
            if ($a['position_qualification'] > 0 && $b['position_qualification'] > 0) {
                return $a['position_qualification'] - $b['position_qualification'];
            }
            return $b['entry_points'] - $a['entry_points'];
        });

        ob_start();
        ?>
        <div class="bvr-teams-section">
            <?php if (!empty($mainDraw)): ?>
            <div class="bvr-teams-group">
                <h4 class="bvr-teams-group__title">
                    <?php esc_html_e('Main Draw', 'beach-volley-results'); ?>
                    <span class="bvr-teams-group__count">(<?php echo count($mainDraw); ?>)</span>
                </h4>
                <div class="bvr-teams-list">
                    <?php $pos = 1; foreach ($mainDraw as $team): ?>
                        <?php echo $this->renderTeamRow($team, $pos++); ?>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>

            <?php if (!empty($qualification)): ?>
            <div class="bvr-teams-group">
                <h4 class="bvr-teams-group__title">
                    <?php esc_html_e('Qualification', 'beach-volley-results'); ?>
                    <span class="bvr-teams-group__count">(<?php echo count($qualification); ?>)</span>
                </h4>
                <div class="bvr-teams-list">
                    <?php $pos = 1; foreach ($qualification as $team): ?>
                        <?php echo $this->renderTeamRow($team, $pos++); ?>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>

            <?php if (!empty($other)): ?>
            <div class="bvr-teams-group">
                <h4 class="bvr-teams-group__title">
                    <?php esc_html_e('Other', 'beach-volley-results'); ?>
                    <span class="bvr-teams-group__count">(<?php echo count($other); ?>)</span>
                </h4>
                <div class="bvr-teams-list">
                    <?php $pos = 1; foreach ($other as $team): ?>
                        <?php echo $this->renderTeamRow($team, $pos++); ?>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render a single team row in teams list (expandable)
     */
    private function renderTeamRow(array $team, int $position): string
    {
        $flag = CountryHelper::getFlag($team['country_code'] ?? '');
        $hasDetails = $this->hasPlayerDetails($team);
        $uniqueId = 'bvr-team-' . $team['id'];

        ob_start();
        ?>
        <div class="bvr-team-row<?php echo $hasDetails ? ' bvr-team-row--expandable' : ''; ?>">
            <div class="bvr-team-row__main"<?php if ($hasDetails): ?> role="button" tabindex="0" aria-expanded="false" aria-controls="<?php echo esc_attr($uniqueId); ?>"<?php endif; ?>>
                <span class="bvr-team-row__position"><?php echo esc_html($position); ?>.</span>
                <span class="bvr-team-row__flag"><?php echo esc_html($flag ?: $team['country_code']); ?></span>
                <span class="bvr-team-row__name"><?php echo esc_html($team['name']); ?></span>
                <?php if ($team['seed'] > 0): ?>
                    <span class="bvr-team-row__seed">#<?php echo esc_html($team['seed']); ?></span>
                <?php endif; ?>
                <?php if ($team['entry_points'] > 0): ?>
                    <span class="bvr-team-row__points"><?php echo esc_html(number_format($team['entry_points'])); ?> pts</span>
                <?php endif; ?>
                <?php if ($hasDetails): ?>
                    <span class="bvr-team-row__toggle">+</span>
                <?php endif; ?>
            </div>
            <?php if ($hasDetails): ?>
            <div class="bvr-team-row__details" id="<?php echo esc_attr($uniqueId); ?>">
                <?php echo $this->renderPlayerDetail($team['player1']); ?>
                <?php echo $this->renderPlayerDetail($team['player2']); ?>
            </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Check if team has any expandable player details
     */
    private function hasPlayerDetails(array $team): bool
    {
        foreach (['player1', 'player2'] as $key) {
            $p = $team[$key] ?? [];
            if (!empty($p['height']) || !empty($p['age']) || !empty($p['position'])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Render single player detail block
     */
    private function renderPlayerDetail(array $player): string
    {
        $name = trim(($player['first_name'] ?? '') . ' ' . ($player['last_name'] ?? ''));
        if (empty($name)) {
            return '';
        }

        $details = [];
        if (!empty($player['age'])) {
            $details[] = sprintf(__('Age: %d', 'beach-volley-results'), $player['age']);
        }
        if (!empty($player['height'])) {
            $details[] = sprintf(__('Height: %dcm', 'beach-volley-results'), $player['height']);
        }
        if (!empty($player['weight'])) {
            $details[] = sprintf(__('Weight: %dkg', 'beach-volley-results'), $player['weight']);
        }
        if (!empty($player['position'])) {
            $details[] = esc_html($player['position']);
        }

        if (empty($details)) {
            return '';
        }

        ob_start();
        ?>
        <div class="bvr-player-detail">
            <span class="bvr-player-detail__name"><?php echo esc_html($name); ?></span>
            <span class="bvr-player-detail__info"><?php echo esc_html(implode(' · ', $details)); ?></span>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Get CSS tier class for tournament type
     */
    private function getTierClass(int $typeCode): string
    {
        return match ($typeCode) {
            51 => 'bvr-tournament-card--elite',
            52 => 'bvr-tournament-card--challenge',
            53 => 'bvr-tournament-card--futures',
            default => '',
        };
    }

    /**
     * Group tournaments by event — same title + date + country = one row with M/W links
     */
    private function groupTournamentsByEvent(array $tournaments): array
    {
        $groups = [];
        foreach ($tournaments as $t) {
            $key = ($t['title'] ?? '') . '|' . ($t['start_date'] ?? '') . '|' . ($t['country_code'] ?? '');
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'base' => $t,
                    'genders' => [],
                ];
            }
            $gender = $t['gender'] ?? '';
            $groups[$key]['genders'][$gender ?: 'all'] = $t['id'];
        }
        return array_values($groups);
    }

    /**
     * Format a date range compactly
     * Same month: "4–8 Mar 2026", different month: "28 Mar – 2 Apr 2026"
     */
    private function formatDateRange(string $startDate, string $endDate): string
    {
        if (empty($startDate)) return '';
        $start = new \DateTimeImmutable($startDate);
        if ($start === false) return $this->formatDate($startDate);

        if (empty($endDate) || $endDate === $startDate) {
            return $start->format('j M Y');
        }

        $end = new \DateTimeImmutable($endDate);
        if ($end === false) return $start->format('j M Y');

        if ($start->format('Y-m') === $end->format('Y-m')) {
            return $start->format('j') . '–' . $end->format('j M Y');
        } elseif ($start->format('Y') === $end->format('Y')) {
            return $start->format('j M') . ' – ' . $end->format('j M Y');
        }
        return $start->format('j M Y') . ' – ' . $end->format('j M Y');
    }

    /**
     * Get short type label for BPT tournament types
     */
    private function getShortTypeName(int $typeCode, string $fullName): string
    {
        return match ($typeCode) {
            51 => 'Elite16',
            52 => 'Challenge',
            53 => 'Futures',
            default => $fullName,
        };
    }

    /**
     * Render tournament card (accepts a grouped event with gender links)
     */
    private function renderTournamentCard(array $group): string
    {
        $t = $group['base'];
        $genders = $group['genders'];

        // Fix FIVB API quirk: Women's tournaments have gender_code=0 ("U" = Unknown).
        // When paired with "M", "U" means Women. Standalone "U" also treated as "W".
        if (isset($genders['U'])) {
            $genders['W'] = $genders['U'];
            unset($genders['U']);
        }

        // Ensure consistent order: M before W
        $ordered = [];
        foreach (['M', 'W', 'MW', 'Mixed', 'all'] as $g) {
            if (isset($genders[$g])) $ordered[$g] = $genders[$g];
        }
        $genders = $ordered ?: $genders;

        $tierClass = $this->getTierClass($t['type_code'] ?? 0);
        $flag = CountryHelper::getFlag($t['country_code'] ?? '');

        // Prefer main draw dates (actual play dates), fall back to registration dates
        $startDate = !empty($t['start_date_main']) ? $t['start_date_main'] : ($t['start_date'] ?? '');
        $endDate = !empty($t['end_date_main']) ? $t['end_date_main'] : ($t['end_date'] ?? '');

        $singleGender = count($genders) === 1;
        $primaryId = reset($genders);
        $primaryUrl = add_query_arg('bvr_tournament', $primaryId, get_permalink());

        $cardClasses = ['bvr-tournament-card'];
        if ($singleGender) $cardClasses[] = 'bvr-tournament-card--clickable';
        if ($tierClass) $cardClasses[] = $tierClass;

        $shortType = $this->getShortTypeName($t['type_code'] ?? 0, $t['type'] ?? '');

        ob_start();
        ?>
        <div class="<?php echo esc_attr(implode(' ', $cardClasses)); ?>">
            <div class="bvr-tournament-card__info">
                <h4 class="bvr-tournament-card__title">
                    <?php if ($singleGender): ?>
                        <a href="<?php echo esc_url($primaryUrl); ?>" class="bvr-tournament-card__link bvr-stretched-link">
                            <?php echo esc_html($t['title']); ?>
                        </a>
                    <?php else: ?>
                        <?php echo esc_html($t['title']); ?>
                    <?php endif; ?>
                </h4>
                <div class="bvr-tournament-card__meta-row">
                    <?php if ($flag): ?>
                        <span class="bvr-tournament-card__flag"><?php echo esc_html($flag); ?></span>
                    <?php endif; ?>
                    <span><?php echo esc_html($t['country_name']); ?></span>
                    <span class="bvr-tournament-card__sep">&middot;</span>
                    <span><?php echo esc_html($this->formatDateRange($startDate, $endDate)); ?></span>
                </div>
            </div>
            <div class="bvr-tournament-card__right">
                <span class="bvr-tournament-card__type-pill bvr-tournament-card__type-pill--<?php echo esc_attr($this->getTypePillClass($t['type_code'] ?? 0)); ?>">
                    <?php echo esc_html($shortType); ?>
                </span>
                <div class="bvr-tournament-card__genders">
                    <?php foreach ($genders as $gender => $tournamentId): ?>
                        <a href="<?php echo esc_url(add_query_arg('bvr_tournament', $tournamentId, get_permalink())); ?>"
                           class="bvr-tournament-card__gender-link"
                           title="<?php echo esc_attr($gender === 'M' ? 'Men' : ($gender === 'W' ? 'Women' : $gender)); ?>">
                            <?php echo esc_html($gender === 'all' ? '→' : $gender); ?>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Get pill CSS class for tournament type
     */
    private function getTypePillClass(int $typeCode): string
    {
        return match ($typeCode) {
            51 => 'elite',
            52 => 'challenge',
            53 => 'futures',
            default => 'other',
        };
    }

    /**
     * Render [bvr_polish_teams] shortcode - Country Teams Widget with carousel
     */
    public function renderPolishTeams(array $atts): string
    {
        $atts = shortcode_atts([
            'country' => 'POL',
            'limit' => 12,
            'show_live' => true,
            'show_finished' => true,
        ], $atts, 'bvr_polish_teams');

        $countryCode = strtoupper(sanitize_text_field($atts['country']));
        $limit = absint($atts['limit']);
        $showLive = filter_var($atts['show_live'], FILTER_VALIDATE_BOOLEAN);
        $showFinished = filter_var($atts['show_finished'], FILTER_VALIDATE_BOOLEAN);

        // Get matches for this country
        $matches = $this->apiClient->getMatchesByCountry($countryCode, $limit, $showLive, $showFinished);

        // Get all countries for dropdown
        $countries = CountryHelper::getAllCountries();
        $currentCountry = CountryHelper::getCountry($countryCode);
        $currentFlag = $currentCountry['flag'] ?? '';
        $currentName = $currentCountry['name'] ?? $countryCode;

        $hasLive = !empty(array_filter($matches, fn($m) => $m['status'] === 'live'));

        ob_start();
        ?>
        <div class="bvr-country-widget" data-country="<?php echo esc_attr($countryCode); ?>" data-limit="<?php echo esc_attr($limit); ?>">
            <div class="bvr-widget__header">
                <div class="bvr-country-dropdown">
                    <button type="button" class="bvr-country-dropdown__trigger">
                        <span class="bvr-country-dropdown__flag"><?php echo esc_html($currentFlag); ?></span>
                        <span class="bvr-country-dropdown__name"><?php echo esc_html($currentName); ?></span>
                        <span class="bvr-country-dropdown__arrow">▼</span>
                    </button>
                    <ul class="bvr-country-dropdown__list">
                        <?php foreach ($countries as $code => $data): ?>
                            <li data-code="<?php echo esc_attr($code); ?>" data-flag="<?php echo esc_attr($data['flag']); ?>" data-name="<?php echo esc_attr($data['name']); ?>">
                                <?php echo esc_html($data['flag'] . ' ' . $data['name']); ?>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <?php if ($hasLive): ?>
                    <span class="bvr-live-dot"></span>
                <?php endif; ?>
            </div>
            <div class="bvr-widget__content">
                <?php echo $this->renderCountryMatchesCarousel($matches, $countryCode); ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render carousel with country matches
     */
    private function renderCountryMatchesCarousel(array $matches, string $highlightCountry): string
    {
        $countryData = CountryHelper::getCountry($highlightCountry);
        $countryName = $countryData['name'] ?? $highlightCountry;

        if (empty($matches)) {
            return '<p class="bvr-empty">' . sprintf(
                /* translators: %s: country name */
                esc_html__('No matches for %s', 'beach-volley-results'),
                esc_html($countryName)
            ) . '</p>';
        }

        $totalMatches = count($matches);
        $totalPages = ceil($totalMatches / 3);

        ob_start();
        ?>
        <div class="bvr-carousel" data-total-pages="<?php echo esc_attr($totalPages); ?>" data-cards-per-page="3">
            <?php if ($totalPages > 1): ?>
            <button type="button" class="bvr-carousel__nav bvr-carousel__nav--prev" aria-label="<?php esc_attr_e('Previous', 'beach-volley-results'); ?>" disabled>
                <span>‹</span>
            </button>
            <?php endif; ?>

            <div class="bvr-carousel__viewport">
                <div class="bvr-carousel__track">
                    <?php foreach ($matches as $index => $match): ?>
                        <?php echo $this->renderCompactMatchCard($match, $highlightCountry); ?>
                    <?php endforeach; ?>
                </div>
            </div>

            <?php if ($totalPages > 1): ?>
            <button type="button" class="bvr-carousel__nav bvr-carousel__nav--next" aria-label="<?php esc_attr_e('Next', 'beach-volley-results'); ?>">
                <span>›</span>
            </button>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render compact match card for carousel
     */
    private function renderCompactMatchCard(array $match, string $highlightCountry): string
    {
        $teamAHighlighted = ($match['team_a']['country_code'] ?? '') === $highlightCountry;
        $teamBHighlighted = ($match['team_b']['country_code'] ?? '') === $highlightCountry;
        $isLive = ($match['status'] ?? '') === 'live';
        $isBreak = ($match['status'] ?? '') === 'break';

        $teamAFlag = CountryHelper::getFlag($match['team_a']['country_code'] ?? '');
        $teamBFlag = CountryHelper::getFlag($match['team_b']['country_code'] ?? '');

        // Format team names (shorter version)
        $teamAName = $this->formatTeamNameShort($match['team_a']['name'] ?? '');
        $teamBName = $this->formatTeamNameShort($match['team_b']['name'] ?? '');

        // Build set scores for each team
        $teamASets = [];
        $teamBSets = [];
        if (!empty($match['scores'])) {
            foreach ($match['scores'] as $set) {
                $teamASets[] = $set['team_a'];
                $teamBSets[] = $set['team_b'];
            }
        }

        // Tournament and round info
        $tournamentTitle = $match['tournament']['title'] ?? '';
        $round = $match['round'] ?? '';
        $date = !empty($match['date']) ? $this->formatDate($match['date']) : '';

        // Match center URL
        $matchId = $match['id'] ?? $match['no'] ?? null;
        $matchUrl = $matchId ? add_query_arg('bvr_match', absint($matchId), get_permalink()) : '';

        $classes = ['bvr-compact-card'];
        if ($isLive) $classes[] = 'bvr-compact-card--live';
        elseif ($isBreak) $classes[] = 'bvr-compact-card--break';

        // Time
        $time = $match['time'] ?? '';

        ob_start();
        ?>
        <?php if ($matchUrl): ?>
        <a href="<?php echo esc_url($matchUrl); ?>" class="bvr-compact-card__link" data-match-id="<?php echo esc_attr($matchId); ?>">
        <?php endif; ?>
        <div class="<?php echo esc_attr(implode(' ', $classes)); ?>">
            <div class="bvr-compact-card__header">
                <?php if ($isLive): ?>
                    <span class="bvr-status-live">LIVE</span>
                <?php elseif ($isBreak): ?>
                    <span class="bvr-status-break">Break</span>
                <?php elseif ($date || $time): ?>
                    <span class="bvr-compact-card__datetime">
                        <?php echo esc_html(trim($date . ' ' . $time)); ?>
                    </span>
                <?php endif; ?>
            </div>
            <div class="bvr-compact-card__teams">
                <div class="bvr-compact-card__team<?php echo $teamAHighlighted ? ' bvr-compact-card__team--highlighted' : ''; ?>">
                    <span class="bvr-compact-card__flag"><?php echo esc_html($teamAFlag); ?></span>
                    <span class="bvr-compact-card__name"><?php echo esc_html($teamAName); ?></span>
                    <?php if (!empty($teamASets)): ?>
                    <span class="bvr-compact-card__sets"><?php echo esc_html(implode(' ', $teamASets)); ?></span>
                    <?php endif; ?>
                    <span class="bvr-compact-card__points<?php echo ($match['winner'] ?? '') === 'a' ? ' bvr-compact-card__points--winner' : ''; ?>"><?php echo esc_html($match['match_points']['team_a'] ?? '0'); ?></span>
                </div>
                <div class="bvr-compact-card__team<?php echo $teamBHighlighted ? ' bvr-compact-card__team--highlighted' : ''; ?>">
                    <span class="bvr-compact-card__flag"><?php echo esc_html($teamBFlag); ?></span>
                    <span class="bvr-compact-card__name"><?php echo esc_html($teamBName); ?></span>
                    <?php if (!empty($teamBSets)): ?>
                    <span class="bvr-compact-card__sets"><?php echo esc_html(implode(' ', $teamBSets)); ?></span>
                    <?php endif; ?>
                    <span class="bvr-compact-card__points<?php echo ($match['winner'] ?? '') === 'b' ? ' bvr-compact-card__points--winner' : ''; ?>"><?php echo esc_html($match['match_points']['team_b'] ?? '0'); ?></span>
                </div>
            </div>
            <?php if ($tournamentTitle || $round): ?>
            <div class="bvr-compact-card__footer">
                <?php
                $footerParts = array_filter([$tournamentTitle, $round]);
                echo esc_html(implode(' • ', $footerParts));
                ?>
            </div>
            <?php endif; ?>
        </div>
        <?php if ($matchUrl): ?>
        </a>
        <?php endif; ?>
        <?php
        return ob_get_clean();
    }

    /**
     * Format team name to shorter version (surnames only)
     */
    private function formatTeamNameShort(string $name): string
    {
        // If name contains "/" it's already in format "Surname/Surname"
        if (str_contains($name, '/')) {
            return $name;
        }

        // Try to extract surnames from "First Last / First Last" format
        $parts = preg_split('/\s*[-\/]\s*/', $name);
        if (count($parts) === 2) {
            $surnames = [];
            foreach ($parts as $part) {
                $words = explode(' ', trim($part));
                $surnames[] = end($words); // Take last word as surname
            }
            return implode('/', $surnames);
        }

        return $name;
    }

    /**
     * Render match card with country highlight
     */
    private function renderMatchCardHighlighted(array $match, string $highlightCountry): string
    {
        $teamAHighlighted = ($match['team_a']['country_code'] ?? '') === $highlightCountry;
        $teamBHighlighted = ($match['team_b']['country_code'] ?? '') === $highlightCountry;

        $classes = ['bvr-match-card', 'bvr-match-card--highlighted'];
        if ($match['status'] === 'live') $classes[] = 'bvr-match-card--live';

        ob_start();
        ?>
        <div class="<?php echo esc_attr(implode(' ', $classes)); ?>" data-match-id="<?php echo esc_attr($match['id']); ?>">
            <div class="bvr-match-card__teams">
                <div class="bvr-match-card__team" <?php echo $teamAHighlighted ? 'style="font-weight: 700;"' : ''; ?>>
                    <span class="bvr-match-card__team-name">
                        <span class="bvr-match-card__flag"><?php echo esc_html($match['team_a']['country_code']); ?></span>
                        <?php echo esc_html($match['team_a']['name']); ?>
                    </span>
                    <span class="bvr-match-card__score <?php echo ($match['winner'] === 'a') ? 'bvr-match-card__score--winner' : ''; ?>">
                        <?php echo esc_html($match['match_points']['team_a']); ?>
                    </span>
                </div>
                <div class="bvr-match-card__team" <?php echo $teamBHighlighted ? 'style="font-weight: 700;"' : ''; ?>>
                    <span class="bvr-match-card__team-name">
                        <span class="bvr-match-card__flag"><?php echo esc_html($match['team_b']['country_code']); ?></span>
                        <?php echo esc_html($match['team_b']['name']); ?>
                    </span>
                    <span class="bvr-match-card__score <?php echo ($match['winner'] === 'b') ? 'bvr-match-card__score--winner' : ''; ?>">
                        <?php echo esc_html($match['match_points']['team_b']); ?>
                    </span>
                </div>
            </div>
            <div class="bvr-match-card__meta">
                <?php if (!empty($match['tournament']['title'])): ?>
                    <span><?php echo esc_html($match['tournament']['title']); ?></span>
                <?php endif; ?>
                <?php if ($match['status'] === 'live'): ?>
                    <span class="bvr-status-live"><?php esc_html_e('LIVE', 'beach-volley-results'); ?></span>
                <?php elseif (!empty($match['date'])): ?>
                    <span><?php echo esc_html($this->formatDate($match['date'])); ?></span>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render [bvr_tournament] shortcode
     */
    public function renderTournament(array $atts): string
    {
        $atts = shortcode_atts([
            'id' => 0,
            'show_bracket' => true,
            'show_matches' => true,
        ], $atts, 'bvr_tournament');

        $tournamentId = absint($atts['id']);
        if ($tournamentId === 0) {
            return '<div class="bvr-error">' .
                esc_html__('Tournament ID is required.', 'beach-volley-results') .
                '</div>';
        }

        // Get tournament details
        $tournament = $this->apiClient->getTournament($tournamentId);
        if ($tournament === null) {
            return '<div class="bvr-error">' .
                esc_html__('Tournament not found.', 'beach-volley-results') .
                '</div>';
        }

        // Get matches if requested
        $matches = [];
        if (filter_var($atts['show_matches'], FILTER_VALIDATE_BOOLEAN)) {
            $matches = $this->apiClient->getMatches($tournamentId);
        }

        ob_start();
        ?>
        <div class="bvr-tournament">
            <div class="bvr-tournament__header">
                <h2><?php echo esc_html($tournament['title']); ?></h2>
                <div class="bvr-tournament__meta">
                    <span><?php echo esc_html($tournament['country_name']); ?></span>
                    <?php if (!empty($tournament['city'])): ?>
                        <span>• <?php echo esc_html($tournament['city']); ?></span>
                    <?php endif; ?>
                    <span>• <?php echo esc_html($this->formatDate($tournament['start_date'])); ?></span>
                    <?php if (!empty($tournament['end_date']) && $tournament['end_date'] !== $tournament['start_date']): ?>
                        - <?php echo esc_html($this->formatDate($tournament['end_date'])); ?>
                    <?php endif; ?>
                </div>
                <div class="bvr-tournament__info">
                    <?php $genderLabel = ResponseParser::getGenderLabel($tournament['gender']); ?>
                    <?php if ($genderLabel): ?>
                        <span><?php echo esc_html($genderLabel); ?></span>
                        <span>•</span>
                    <?php endif; ?>
                    <span><?php echo esc_html($tournament['type']); ?></span>
                    <span>• <?php echo esc_html(ResponseParser::getTournamentStatusLabel($tournament['status'])); ?></span>
                </div>
            </div>

            <?php if (!empty($matches)): ?>
            <div class="bvr-tournament__matches">
                <h3><?php esc_html_e('Matches', 'beach-volley-results'); ?></h3>
                <div class="bvr-results__list">
                    <?php foreach ($matches as $match): ?>
                        <?php echo $this->renderMatchCard($match); ?>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Render [bvr_match_center] shortcode
     * Can be used standalone or reads ?bvr_match from URL
     */
    public function renderMatchCenter(array $atts): string
    {
        $atts = shortcode_atts([
            'id' => 0,
        ], $atts, 'bvr_match_center');

        // Get match ID from attribute or URL parameter
        $matchId = absint($atts['id']);
        if ($matchId === 0 && isset($_GET['bvr_match'])) {
            $matchId = absint($_GET['bvr_match']);
        }

        if ($matchId === 0) {
            return '<div class="bvr-match-center bvr-match-center--empty">' .
                '<p>' . esc_html__('Select a match to view details.', 'beach-volley-results') . '</p>' .
                '</div>';
        }

        // Get match details from API
        $match = $this->apiClient->getMatch($matchId);
        if ($match === null) {
            return '<div class="bvr-match-center bvr-match-center--error">' .
                '<p>' . esc_html__('Match not found.', 'beach-volley-results') . '</p>' .
                '</div>';
        }

        $teamAFlag = CountryHelper::getFlag($match['team_a']['country_code'] ?? '');
        $teamBFlag = CountryHelper::getFlag($match['team_b']['country_code'] ?? '');

        $isLive = ($match['status'] ?? '') === 'live';
        $statusClass = $isLive ? 'bvr-match-center--live' : '';

        ob_start();
        ?>
        <div class="bvr-match-center <?php echo esc_attr($statusClass); ?>" data-match-id="<?php echo esc_attr($matchId); ?>">
            <div class="bvr-match-center__header">
                <?php if ($isLive): ?>
                    <span class="bvr-status-live">LIVE</span>
                <?php endif; ?>
                <?php if (!empty($match['tournament']['title'])): ?>
                    <span class="bvr-match-center__tournament"><?php echo esc_html($match['tournament']['title']); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['round'])): ?>
                    <span class="bvr-match-center__round"><?php echo esc_html($match['round']); ?></span>
                <?php endif; ?>
            </div>

            <div class="bvr-match-center__teams">
                <div class="bvr-match-center__team<?php echo ($match['winner'] ?? '') === 'a' ? ' bvr-match-center__team--winner' : ''; ?>">
                    <span class="bvr-match-center__flag"><?php echo esc_html($teamAFlag); ?></span>
                    <span class="bvr-match-center__name"><?php echo esc_html($match['team_a']['name'] ?? ''); ?></span>
                    <span class="bvr-match-center__points"><?php echo esc_html($match['match_points']['team_a'] ?? '0'); ?></span>
                </div>
                <div class="bvr-match-center__team<?php echo ($match['winner'] ?? '') === 'b' ? ' bvr-match-center__team--winner' : ''; ?>">
                    <span class="bvr-match-center__flag"><?php echo esc_html($teamBFlag); ?></span>
                    <span class="bvr-match-center__name"><?php echo esc_html($match['team_b']['name'] ?? ''); ?></span>
                    <span class="bvr-match-center__points"><?php echo esc_html($match['match_points']['team_b'] ?? '0'); ?></span>
                </div>
            </div>

            <?php if (!empty($match['scores'])): ?>
            <div class="bvr-match-center__sets">
                <h4><?php esc_html_e('Set Scores', 'beach-volley-results'); ?></h4>
                <div class="bvr-match-center__sets-grid">
                    <?php foreach ($match['scores'] as $index => $set): ?>
                        <div class="bvr-match-center__set">
                            <span class="bvr-match-center__set-label"><?php printf(esc_html__('Set %d', 'beach-volley-results'), $index + 1); ?></span>
                            <span class="bvr-match-center__set-score">
                                <?php echo esc_html($set['team_a'] . ' - ' . $set['team_b']); ?>
                            </span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>

            <div class="bvr-match-center__meta">
                <?php if (!empty($match['date'])): ?>
                    <span><?php echo esc_html($this->formatDate($match['date'])); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['time'])): ?>
                    <span><?php echo esc_html($match['time']); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['court'])): ?>
                    <span><?php printf(esc_html__('Court %s', 'beach-volley-results'), esc_html($match['court'])); ?></span>
                <?php endif; ?>
                <?php if (!empty($match['duration'])): ?>
                    <span><?php printf(esc_html__('Duration: %s', 'beach-volley-results'), esc_html($match['duration'])); ?></span>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Register admin menu
     */
    public function registerAdminMenu(): void
    {
        add_menu_page(
            __('Beach Volley Results', 'beach-volley-results'),
            __('Beach Volley', 'beach-volley-results'),
            'manage_options',
            'beach-volley-results',
            [$this, 'renderDashboardPage'],
            'dashicons-awards',
            30
        );

        add_submenu_page(
            'beach-volley-results',
            __('Dashboard', 'beach-volley-results'),
            __('Dashboard', 'beach-volley-results'),
            'manage_options',
            'beach-volley-results',
            [$this, 'renderDashboardPage']
        );

        add_submenu_page(
            'beach-volley-results',
            __('Settings', 'beach-volley-results'),
            __('Settings', 'beach-volley-results'),
            'manage_options',
            'bvr-settings',
            [$this, 'renderSettingsPage']
        );

        add_submenu_page(
            'beach-volley-results',
            __('Help', 'beach-volley-results'),
            __('Help', 'beach-volley-results'),
            'manage_options',
            'bvr-help',
            [$this, 'renderHelpPage']
        );
    }

    /**
     * Register plugin settings
     */
    public function registerSettings(): void
    {
        register_setting('bvr_settings_group', 'bvr_settings', [
            'sanitize_callback' => [$this, 'sanitizeSettings'],
        ]);
    }

    /**
     * Sanitize settings before save
     */
    public function sanitizeSettings(array $input): array
    {
        $sanitized = [];

        $sanitized['cache_live'] = absint($input['cache_live'] ?? 30);
        $sanitized['cache_tournaments'] = absint($input['cache_tournaments'] ?? 21600);
        $sanitized['cache_finished'] = absint($input['cache_finished'] ?? 86400);
        $sanitized['default_season'] = absint($input['default_season'] ?? date('Y'));
        $sanitized['default_limit'] = absint($input['default_limit'] ?? 20);
        $sanitized['auto_refresh_enabled'] = !empty($input['auto_refresh_enabled']);
        $sanitized['api_timeout'] = absint($input['api_timeout'] ?? 10);
        $sanitized['primary_color'] = sanitize_hex_color($input['primary_color'] ?? '#01224d');
        $sanitized['custom_css'] = wp_strip_all_tags($input['custom_css'] ?? '');

        return $sanitized;
    }

    /**
     * Render dashboard admin page
     */
    public function renderDashboardPage(): void
    {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Beach Volley Results - Dashboard', 'beach-volley-results'); ?></h1>

            <div class="bvr-admin-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">

                <div class="card" style="padding: 20px;">
                    <h2><?php esc_html_e('API Status', 'beach-volley-results'); ?></h2>
                    <p><strong><?php esc_html_e('Endpoint:', 'beach-volley-results'); ?></strong> FIVB VIS API</p>
                    <p><strong><?php esc_html_e('Status:', 'beach-volley-results'); ?></strong>
                        <span style="color: green;"><?php esc_html_e('Ready', 'beach-volley-results'); ?></span>
                    </p>
                </div>

                <div class="card" style="padding: 20px;">
                    <h2><?php esc_html_e('Cache Status', 'beach-volley-results'); ?></h2>
                    <p><strong><?php esc_html_e('Live cache TTL:', 'beach-volley-results'); ?></strong>
                        <?php echo esc_html($this->settings['cache_live']); ?>s
                    </p>
                    <p><strong><?php esc_html_e('Tournament cache TTL:', 'beach-volley-results'); ?></strong>
                        <?php echo esc_html(round($this->settings['cache_tournaments'] / 3600, 1)); ?>h
                    </p>
                </div>

                <div class="card" style="padding: 20px;">
                    <h2><?php esc_html_e('Quick Start', 'beach-volley-results'); ?></h2>
                    <p><?php esc_html_e('Use these shortcodes:', 'beach-volley-results'); ?></p>
                    <code>[bvr_live_widget]</code><br>
                    <code>[bvr_results]</code><br>
                    <code>[bvr_polish_teams]</code><br>
                    <code>[bvr_tournament id="123"]</code>
                </div>

            </div>
        </div>
        <?php
    }

    /**
     * Render settings admin page
     */
    public function renderSettingsPage(): void
    {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Beach Volley Results - Settings', 'beach-volley-results'); ?></h1>

            <form method="post" action="options.php">
                <?php settings_fields('bvr_settings_group'); ?>

                <h2><?php esc_html_e('Cache Settings', 'beach-volley-results'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="cache_live"><?php esc_html_e('Live scores cache (seconds)', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="number" id="cache_live" name="bvr_settings[cache_live]"
                                value="<?php echo esc_attr($this->settings['cache_live']); ?>" min="10" max="300">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="cache_tournaments"><?php esc_html_e('Tournament list cache (seconds)', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="number" id="cache_tournaments" name="bvr_settings[cache_tournaments]"
                                value="<?php echo esc_attr($this->settings['cache_tournaments']); ?>" min="3600" max="86400">
                            <p class="description"><?php esc_html_e('Recommended: 21600 (6 hours)', 'beach-volley-results'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="cache_finished"><?php esc_html_e('Finished matches cache (seconds)', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="number" id="cache_finished" name="bvr_settings[cache_finished]"
                                value="<?php echo esc_attr($this->settings['cache_finished']); ?>" min="3600" max="604800">
                            <p class="description"><?php esc_html_e('Recommended: 86400 (24 hours)', 'beach-volley-results'); ?></p>
                        </td>
                    </tr>
                </table>

                <h2><?php esc_html_e('Default Settings', 'beach-volley-results'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="default_season"><?php esc_html_e('Default season', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="number" id="default_season" name="bvr_settings[default_season]"
                                value="<?php echo esc_attr($this->settings['default_season']); ?>" min="2020" max="2030">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="default_limit"><?php esc_html_e('Default results per page', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="number" id="default_limit" name="bvr_settings[default_limit]"
                                value="<?php echo esc_attr($this->settings['default_limit']); ?>" min="5" max="100">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="auto_refresh_enabled"><?php esc_html_e('Enable auto-refresh', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="checkbox" id="auto_refresh_enabled" name="bvr_settings[auto_refresh_enabled]"
                                value="1" <?php checked($this->settings['auto_refresh_enabled']); ?>>
                        </td>
                    </tr>
                </table>

                <h2><?php esc_html_e('API Settings', 'beach-volley-results'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="api_timeout"><?php esc_html_e('API timeout (seconds)', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="number" id="api_timeout" name="bvr_settings[api_timeout]"
                                value="<?php echo esc_attr($this->settings['api_timeout']); ?>" min="5" max="60">
                        </td>
                    </tr>
                </table>

                <h2><?php esc_html_e('Appearance', 'beach-volley-results'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="primary_color"><?php esc_html_e('Primary color', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <input type="color" id="primary_color" name="bvr_settings[primary_color]"
                                value="<?php echo esc_attr($this->settings['primary_color']); ?>">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="custom_css"><?php esc_html_e('Custom CSS', 'beach-volley-results'); ?></label>
                        </th>
                        <td>
                            <textarea id="custom_css" name="bvr_settings[custom_css]" rows="5" cols="50"
                                class="large-text code"><?php echo esc_textarea($this->settings['custom_css']); ?></textarea>
                        </td>
                    </tr>
                </table>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    /**
     * Render help admin page
     */
    public function renderHelpPage(): void
    {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Beach Volley Results - Help', 'beach-volley-results'); ?></h1>

            <div class="card" style="max-width: 800px; padding: 20px; margin-top: 20px;">
                <h2><?php esc_html_e('Available Shortcodes', 'beach-volley-results'); ?></h2>

                <h3><code>[bvr_live_widget]</code></h3>
                <p><?php esc_html_e('Compact sidebar widget showing live matches.', 'beach-volley-results'); ?></p>
                <table class="widefat" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Parameter', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Default', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Description', 'beach-volley-results'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>title</td><td>"Beach Volley Live"</td><td><?php esc_html_e('Widget title', 'beach-volley-results'); ?></td></tr>
                        <tr><td>limit</td><td>5</td><td><?php esc_html_e('Max matches to show', 'beach-volley-results'); ?></td></tr>
                        <tr><td>show_link</td><td>true</td><td><?php esc_html_e('Show "View all" link', 'beach-volley-results'); ?></td></tr>
                        <tr><td>link_url</td><td>""</td><td><?php esc_html_e('Custom URL for "View all"', 'beach-volley-results'); ?></td></tr>
                    </tbody>
                </table>

                <h3><code>[bvr_results]</code></h3>
                <p><?php esc_html_e('Full results page with tabs, filters, pagination.', 'beach-volley-results'); ?></p>
                <table class="widefat" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Parameter', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Default', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Description', 'beach-volley-results'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>preset</td><td>"all"</td><td><?php esc_html_e('Preset config (all/live/elite)', 'beach-volley-results'); ?></td></tr>
                        <tr><td>season</td><td><?php echo esc_html(date('Y')); ?></td><td><?php esc_html_e('Season year', 'beach-volley-results'); ?></td></tr>
                        <tr><td>gender</td><td>"all"</td><td><?php esc_html_e('M/W/all', 'beach-volley-results'); ?></td></tr>
                        <tr><td>limit</td><td>20</td><td><?php esc_html_e('Results per page', 'beach-volley-results'); ?></td></tr>
                        <tr><td>auto_refresh</td><td>0</td><td><?php esc_html_e('Seconds (0=off)', 'beach-volley-results'); ?></td></tr>
                    </tbody>
                </table>

                <h3><code>[bvr_polish_teams]</code></h3>
                <p><?php esc_html_e('Dedicated widget for specific country teams.', 'beach-volley-results'); ?></p>
                <table class="widefat" style="margin-bottom: 20px;">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Parameter', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Default', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Description', 'beach-volley-results'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>country</td><td>"POL"</td><td><?php esc_html_e('Country code to highlight', 'beach-volley-results'); ?></td></tr>
                        <tr><td>limit</td><td>6</td><td><?php esc_html_e('Max matches', 'beach-volley-results'); ?></td></tr>
                        <tr><td>show_live</td><td>true</td><td><?php esc_html_e('Include live matches', 'beach-volley-results'); ?></td></tr>
                        <tr><td>show_finished</td><td>true</td><td><?php esc_html_e('Include finished matches', 'beach-volley-results'); ?></td></tr>
                    </tbody>
                </table>

                <h3><code>[bvr_tournament id="X"]</code></h3>
                <p><?php esc_html_e('Single tournament details.', 'beach-volley-results'); ?></p>
                <table class="widefat">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Parameter', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Default', 'beach-volley-results'); ?></th>
                            <th><?php esc_html_e('Description', 'beach-volley-results'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>id</td><td><em><?php esc_html_e('required', 'beach-volley-results'); ?></em></td><td><?php esc_html_e('Tournament No from API', 'beach-volley-results'); ?></td></tr>
                        <tr><td>show_bracket</td><td>true</td><td><?php esc_html_e('Show bracket/phases', 'beach-volley-results'); ?></td></tr>
                        <tr><td>show_matches</td><td>true</td><td><?php esc_html_e('Show match list', 'beach-volley-results'); ?></td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <?php
    }

    /**
     * Enqueue frontend assets
     */
    public function enqueueAssets(): void
    {
        // Only load on pages with our shortcodes
        global $post;
        if (!is_a($post, 'WP_Post')) {
            return;
        }

        $shortcodes = ['bvr_live_widget', 'bvr_results', 'bvr_polish_teams', 'bvr_tournament', 'bvr_match_center'];

        // Check post_content (classic editor, shortcode blocks)
        $has_shortcode = false;
        foreach ($shortcodes as $sc) {
            if (has_shortcode($post->post_content, $sc)) {
                $has_shortcode = true;
                break;
            }
        }

        // Check Elementor data (shortcodes inside Elementor widgets)
        if (!$has_shortcode) {
            $elementor_data = get_post_meta($post->ID, '_elementor_data', true);
            if (!empty($elementor_data)) {
                foreach ($shortcodes as $sc) {
                    if (str_contains($elementor_data, $sc)) {
                        $has_shortcode = true;
                        break;
                    }
                }
            }
        }

        if (!$has_shortcode) {
            return;
        }

        // Enqueue CSS
        wp_enqueue_style(
            'bvr-frontend',
            BVR_PLUGIN_URL . 'assets/css/frontend.css',
            [],
            BVR_VERSION
        );

        // Add custom CSS from settings
        if (!empty($this->settings['custom_css'])) {
            wp_add_inline_style('bvr-frontend', $this->settings['custom_css']);
        }

        // Add CSS variables from settings
        $css_vars = sprintf(
            ':root { --bvr-primary: %s; }',
            esc_attr($this->settings['primary_color'])
        );
        wp_add_inline_style('bvr-frontend', $css_vars);

        // Enqueue JS
        wp_enqueue_script(
            'bvr-frontend',
            BVR_PLUGIN_URL . 'assets/js/frontend.js',
            [],
            BVR_VERSION,
            true
        );

        // Localize script
        wp_localize_script('bvr-frontend', 'bvrConfig', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('bvr_ajax_nonce'),
            'autoRefresh' => $this->settings['auto_refresh_enabled'],
            'refreshInterval' => $this->settings['cache_live'] * 1000,
        ]);
    }

    /**
     * AJAX handler for live refresh
     */
    public function ajaxRefreshLive(): void
    {
        check_ajax_referer('bvr_ajax_nonce', 'nonce');

        // Get live data
        $liveData = $this->apiClient->getAllLiveMatches();
        $liveMatches = $liveData['live'] ?? [];
        $breakMatches = $liveData['break'] ?? [];

        ob_start();
        if (!empty($liveMatches)) {
            foreach ($liveMatches as $match) {
                echo $this->renderLiveMatchCard($match);
            }
        } elseif (!empty($breakMatches)) {
            echo '<p class="bvr-widget__info">' . esc_html__('Break between sets:', 'beach-volley-results') . '</p>';
            foreach ($breakMatches as $match) {
                echo $this->renderLiveMatchCard($match);
            }
        } else {
            echo '<p class="bvr-empty">' . esc_html__('No matches currently', 'beach-volley-results') . '</p>';
        }
        $html = ob_get_clean();

        wp_send_json_success(['html' => $html]);
    }

    /**
     * AJAX handler for country matches
     */
    public function ajaxGetCountryMatches(): void
    {
        check_ajax_referer('bvr_ajax_nonce', 'nonce');

        $countryCode = isset($_POST['country']) ? strtoupper(sanitize_text_field($_POST['country'])) : 'POL';
        $limit = isset($_POST['limit']) ? absint($_POST['limit']) : 12;

        // Validate country code
        $countryData = CountryHelper::getCountry($countryCode);
        if ($countryData === null) {
            wp_send_json_error(['message' => __('Invalid country code', 'beach-volley-results')]);
            return;
        }

        // Get matches
        $matches = $this->apiClient->getMatchesByCountry($countryCode, $limit, true, true);

        // Render carousel HTML
        $html = $this->renderCountryMatchesCarousel($matches, $countryCode);

        wp_send_json_success([
            'html' => $html,
            'country' => $countryCode,
            'flag' => $countryData['flag'],
            'name' => $countryData['name'],
            'matchCount' => count($matches),
        ]);
    }

    /**
     * Get plugin settings
     */
    public function getSettings(): array
    {
        return $this->settings;
    }

    /**
     * Get single setting
     */
    public function getSetting(string $key, mixed $default = null): mixed
    {
        return $this->settings[$key] ?? $default;
    }
}
