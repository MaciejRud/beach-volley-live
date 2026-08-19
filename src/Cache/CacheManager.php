<?php
/**
 * Cache Manager
 *
 * Wrapper for WordPress Transients API with object cache support
 *
 * @package BeachVolleyResults
 */

declare(strict_types=1);

namespace BeachVolleyResults\Cache;

/**
 * Cache manager using WordPress Transients
 */
class CacheManager
{
    /**
     * Cache prefix
     */
    private const PREFIX = 'bvr_';

    /**
     * Default TTL values (in seconds)
     */
    public const TTL_LIVE = 30;           // 30 seconds for live data
    public const TTL_TOURNAMENT = 7200;    // 2 hours for tournament details
    public const TTL_TOURNAMENTS = 21600;  // 6 hours for tournament list
    public const TTL_MATCHES = 86400;      // 24 hours for finished matches
    public const TTL_TEAMS = 7200;         // 2 hours for team data

    /**
     * Whether object cache is available
     */
    private bool $hasObjectCache;

    /**
     * Constructor
     */
    public function __construct()
    {
        // wp_using_ext_object_cache() can return null in some WordPress versions
        $this->hasObjectCache = (bool) wp_using_ext_object_cache();
    }

    /**
     * Get cached value
     *
     * @param string $key Cache key (without prefix)
     * @return mixed Cached value or false if not found
     */
    public function get(string $key): mixed
    {
        $fullKey = $this->prefixKey($key);

        // Try object cache first if available
        if ($this->hasObjectCache) {
            $value = wp_cache_get($fullKey, 'bvr');
            if ($value !== false) {
                return $value;
            }
        }

        // Fall back to transients
        return get_transient($fullKey);
    }

    /**
     * Set cached value
     *
     * @param string $key Cache key (without prefix)
     * @param mixed $value Value to cache
     * @param int $ttl Time to live in seconds
     * @return bool Success
     */
    public function set(string $key, mixed $value, int $ttl = 3600): bool
    {
        $fullKey = $this->prefixKey($key);

        // Store in object cache if available
        if ($this->hasObjectCache) {
            wp_cache_set($fullKey, $value, 'bvr', $ttl);
        }

        // Always store in transients as fallback
        return set_transient($fullKey, $value, $ttl);
    }

    /**
     * Delete cached value
     *
     * @param string $key Cache key (without prefix)
     * @return bool Success
     */
    public function delete(string $key): bool
    {
        $fullKey = $this->prefixKey($key);

        // Delete from object cache
        if ($this->hasObjectCache) {
            wp_cache_delete($fullKey, 'bvr');
        }

        // Delete from transients
        return delete_transient($fullKey);
    }

    /**
     * Check if key exists in cache
     *
     * @param string $key Cache key (without prefix)
     * @return bool Whether key exists
     */
    public function has(string $key): bool
    {
        return $this->get($key) !== false;
    }

    /**
     * Get or set cached value
     *
     * If the key doesn't exist, execute the callback and cache the result.
     *
     * @param string $key Cache key (without prefix)
     * @param callable $callback Callback to generate value
     * @param int $ttl Time to live in seconds
     * @return mixed Cached or generated value
     */
    public function remember(string $key, callable $callback, int $ttl = 3600): mixed
    {
        $value = $this->get($key);

        if ($value !== false) {
            return $value;
        }

        $value = $callback();

        if ($value !== null && $value !== false) {
            $this->set($key, $value, $ttl);
        }

        return $value;
    }

    /**
     * Clear all plugin cache
     *
     * @return int Number of items cleared
     */
    public function flush(): int
    {
        global $wpdb;

        // Clear object cache group
        if ($this->hasObjectCache) {
            wp_cache_flush_group('bvr');
        }

        // Delete all transients with our prefix
        $prefix = self::PREFIX;

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $count = $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
                "_transient_{$prefix}%",
                "_transient_timeout_{$prefix}%"
            )
        );

        return (int) ($count / 2); // Divide by 2 because we delete both transient and timeout
    }

    /**
     * Clear cache for specific tournament
     *
     * @param int $tournamentId Tournament ID
     * @return void
     */
    public function clearTournamentCache(int $tournamentId): void
    {
        $this->delete("tournament_{$tournamentId}");
        $this->delete("matches_{$tournamentId}");
        $this->delete("live_{$tournamentId}");
        $this->delete("teams_{$tournamentId}");
    }

    /**
     * Clear cache for tournaments list
     *
     * @param int|null $season Season year or null for current
     * @return void
     */
    public function clearTournamentsCache(?int $season = null): void
    {
        $season = $season ?? (int) date('Y');
        $this->delete("tournaments_{$season}");
    }

    /**
     * Get cache statistics
     *
     * @return array Cache statistics
     */
    public function getStats(): array
    {
        global $wpdb;

        $prefix = self::PREFIX;

        // Count transients
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $transientCount = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name LIKE %s",
                "_transient_{$prefix}%"
            )
        );

        // Estimate size (rough approximation)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $totalSize = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT SUM(LENGTH(option_value)) FROM {$wpdb->options} WHERE option_name LIKE %s",
                "_transient_{$prefix}%"
            )
        );

        return [
            'transient_count' => $transientCount,
            'estimated_size' => $totalSize,
            'estimated_size_formatted' => $this->formatBytes($totalSize),
            'object_cache_available' => $this->hasObjectCache,
        ];
    }

    /**
     * Prefix cache key
     *
     * @param string $key Original key
     * @return string Prefixed key
     */
    private function prefixKey(string $key): string
    {
        // Don't double-prefix
        if (str_starts_with($key, self::PREFIX)) {
            return $key;
        }

        return self::PREFIX . $key;
    }

    /**
     * Format bytes to human readable
     *
     * @param int $bytes Bytes
     * @return string Formatted string
     */
    private function formatBytes(int $bytes): string
    {
        if ($bytes === 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $factor = (int) floor(log($bytes, 1024));

        return sprintf('%.2f %s', $bytes / pow(1024, $factor), $units[$factor]);
    }
}
