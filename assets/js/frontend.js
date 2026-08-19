/**
 * Beach Volley Results - Frontend JavaScript
 *
 * @package BeachVolleyResults
 */

(function() {
    'use strict';

    /**
     * Auto-refresh class for live data
     */
    class BVRAutoRefresh {
        constructor(container, endpoint, interval = 30000) {
            this.container = container;
            this.endpoint = endpoint;
            this.interval = interval;
            this.timer = null;
            this.isRefreshing = false;
        }

        start() {
            if (this.timer) return;

            this.timer = setInterval(() => this.refresh(), this.interval);

            // Also refresh immediately on visibility change
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.timer) {
                    this.refresh();
                }
            });
        }

        stop() {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }

        async refresh() {
            // Skip if tab is hidden or already refreshing
            if (document.hidden || this.isRefreshing) return;

            this.isRefreshing = true;

            try {
                const response = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        action: 'bvr_refresh_live',
                        nonce: bvrConfig.nonce,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();

                if (data.success && data.data.html) {
                    this.container.innerHTML = data.data.html;
                }
            } catch (error) {
                console.error('[BVR] Refresh error:', error);
            } finally {
                this.isRefreshing = false;
            }
        }
    }

    /**
     * Load country matches via AJAX
     */
    async function loadCountryMatches(widget, countryCode) {
        const content = widget.querySelector('.bvr-widget__content');
        const limit = widget.dataset.limit || 12;

        widget.classList.add('bvr-country-widget--loading');
        widget.dataset.country = countryCode;

        try {
            const response = await fetch(bvrConfig.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'bvr_get_country_matches',
                    nonce: bvrConfig.nonce,
                    country: countryCode,
                    limit: limit,
                }),
            });

            const data = await response.json();

            if (data.success && data.data.html) {
                content.innerHTML = data.data.html;

                // Re-initialize carousel for new content
                const carousel = content.querySelector('.bvr-carousel');
                if (carousel) {
                    new BVRCarousel(carousel);
                }
            }
        } catch (error) {
            console.error('[BVR] Country load error:', error);
        } finally {
            widget.classList.remove('bvr-country-widget--loading');
        }
    }

    /**
     * Vertical carousel with touch support
     * Shows N cards per page stacked vertically, swipe left/right for more
     */
    class BVRCarousel {
        constructor(element) {
            this.element = element;
            this.track = element.querySelector('.bvr-carousel__track');
            this.prevBtn = element.querySelector('.bvr-carousel__nav--prev');
            this.nextBtn = element.querySelector('.bvr-carousel__nav--next');
            this.dots = element.querySelectorAll('.bvr-carousel__dot');
            this.cards = Array.from(element.querySelectorAll('.bvr-compact-card, .bvr-compact-card__link'));

            this.currentPage = 0;
            // Read cards per page from data attribute or default to 3
            this.cardsPerPage = parseInt(element.dataset.cardsPerPage, 10) || 3;
            this.totalPages = Math.ceil(this.cards.length / this.cardsPerPage);

            // Touch handling
            this.touchStartX = 0;
            this.touchEndX = 0;

            this.bindEvents();
            this.showPage(0);
        }

        bindEvents() {
            // Navigation buttons
            if (this.prevBtn) {
                this.prevBtn.addEventListener('click', () => this.prev());
            }
            if (this.nextBtn) {
                this.nextBtn.addEventListener('click', () => this.next());
            }

            // Dots navigation
            this.dots.forEach((dot, index) => {
                dot.addEventListener('click', () => this.goToPage(index));
            });

            // Touch events for swipe
            this.track.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
            this.track.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        }

        handleTouchStart(e) {
            this.touchStartX = e.touches[0].clientX;
        }

        handleTouchEnd(e) {
            this.touchEndX = e.changedTouches[0].clientX;
            this.handleSwipe();
        }

        handleSwipe() {
            const diff = this.touchStartX - this.touchEndX;
            const threshold = 50; // Minimum swipe distance

            if (Math.abs(diff) < threshold) return;

            if (diff > 0) {
                // Swipe left -> next
                this.next();
            } else {
                // Swipe right -> prev
                this.prev();
            }
        }

        prev() {
            if (this.currentPage > 0) {
                this.goToPage(this.currentPage - 1);
            }
        }

        next() {
            if (this.currentPage < this.totalPages - 1) {
                this.goToPage(this.currentPage + 1);
            }
        }

        goToPage(page) {
            this.currentPage = Math.max(0, Math.min(page, this.totalPages - 1));
            this.showPage(this.currentPage);
        }

        showPage(page) {
            const startIndex = page * this.cardsPerPage;
            const endIndex = startIndex + this.cardsPerPage;

            // Show/hide cards based on current page
            this.cards.forEach((card, index) => {
                if (index >= startIndex && index < endIndex) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });

            this.updateButtons();
            this.updateDots();
        }

        updateButtons() {
            if (this.prevBtn) {
                this.prevBtn.disabled = this.currentPage === 0;
            }
            if (this.nextBtn) {
                this.nextBtn.disabled = this.currentPage >= this.totalPages - 1;
            }
        }

        updateDots() {
            this.dots.forEach((dot, index) => {
                dot.classList.toggle('bvr-carousel__dot--active', index === this.currentPage);
            });
        }
    }

    /**
     * Initialize all BVR components on the page
     */
    function init() {
        // Initialize live widgets with auto-refresh
        if (typeof bvrConfig !== 'undefined' && bvrConfig.autoRefresh) {
            const liveWidgets = document.querySelectorAll('.bvr-live-widget[data-auto-refresh="true"]');

            liveWidgets.forEach(widget => {
                const refresher = new BVRAutoRefresh(
                    widget.querySelector('.bvr-widget__content'),
                    bvrConfig.ajaxUrl,
                    bvrConfig.refreshInterval
                );
                refresher.start();
            });
        }

        // Initialize country widgets
        initCountryWidgets();

        // Initialize carousels
        initCarousels();

        // Initialize tabs
        initTabs();

        // Initialize filters
        initFilters();

        // Initialize section toggles (Recent collapsed)
        initSections();

        // Initialize load more buttons (per-section)
        initLoadMore();

        // Initialize expandable team rows
        initTeamExpand();
    }

    /**
     * Initialize country selector widgets with custom dropdown
     */
    function initCountryWidgets() {
        document.querySelectorAll('.bvr-country-widget').forEach(widget => {
            const dropdown = widget.querySelector('.bvr-country-dropdown');
            const trigger = dropdown?.querySelector('.bvr-country-dropdown__trigger');
            const list = dropdown?.querySelector('.bvr-country-dropdown__list');

            if (!trigger || !list) return;

            // Toggle dropdown on trigger click
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('bvr-country-dropdown--open');
            });

            // Select country on list item click
            list.querySelectorAll('li').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const code = item.dataset.code;
                    const flag = item.dataset.flag;
                    const name = item.dataset.name;

                    // Update trigger display
                    const flagEl = trigger.querySelector('.bvr-country-dropdown__flag');
                    const nameEl = trigger.querySelector('.bvr-country-dropdown__name');
                    if (flagEl) flagEl.textContent = flag;
                    if (nameEl) nameEl.textContent = name;

                    // Close dropdown
                    dropdown.classList.remove('bvr-country-dropdown--open');

                    // Load new country matches
                    loadCountryMatches(widget, code);
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('bvr-country-dropdown--open');
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    dropdown.classList.remove('bvr-country-dropdown--open');
                }
            });
        });
    }

    /**
     * Initialize carousels
     */
    function initCarousels() {
        const carousels = document.querySelectorAll('.bvr-carousel');
        carousels.forEach(carousel => {
            new BVRCarousel(carousel);
        });
    }

    /**
     * Initialize tab switching for results page
     */
    function initTabs() {
        // Results page tabs
        const tabContainers = document.querySelectorAll('.bvr-results');

        tabContainers.forEach(container => {
            const tabs = container.querySelectorAll('.bvr-results__tab');
            const panels = container.querySelectorAll('.bvr-results__panel');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.dataset.tab;

                    // Update active tab
                    tabs.forEach(t => t.classList.remove('bvr-results__tab--active'));
                    tab.classList.add('bvr-results__tab--active');

                    // Update active panel
                    panels.forEach(panel => {
                        panel.hidden = panel.id !== targetId;
                    });
                });
            });
        });

        // Tournament detail tabs (Matches, Ranking, Teams)
        initTournamentTabs();
    }

    /**
     * Initialize tournament detail tabs
     */
    function initTournamentTabs() {
        const tournamentContainers = document.querySelectorAll('.bvr-tournament-detail');

        tournamentContainers.forEach(container => {
            const tabs = container.querySelectorAll('.bvr-tab');
            const contents = container.querySelectorAll('.bvr-tab-content');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.dataset.tab;

                    // Update active tab
                    tabs.forEach(t => t.classList.remove('bvr-tab--active'));
                    tab.classList.add('bvr-tab--active');

                    // Update active content
                    contents.forEach(content => {
                        if (content.id === 'tab-' + targetTab) {
                            content.classList.add('bvr-tab-content--active');
                        } else {
                            content.classList.remove('bvr-tab-content--active');
                        }
                    });
                });
            });
        });
    }

    /**
     * Initialize expandable team rows
     */
    function initTeamExpand() {
        document.querySelectorAll('.bvr-team-row--expandable .bvr-team-row__main').forEach(trigger => {
            trigger.addEventListener('click', () => {
                const row = trigger.closest('.bvr-team-row');
                const isExpanded = row.classList.toggle('bvr-team-row--expanded');
                trigger.setAttribute('aria-expanded', isExpanded);
            });

            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    trigger.click();
                }
            });
        });
    }

    /**
     * Initialize section toggles (Recent section collapsed by default)
     */
    function initSections() {
        document.querySelectorAll('.bvr-section__toggle').forEach(button => {
            button.addEventListener('click', () => {
                const section = button.closest('.bvr-section');
                if (!section) return;

                const content = section.querySelector('.bvr-section__content--collapsed');
                if (content) {
                    content.classList.remove('bvr-section__content--collapsed');
                    button.classList.add('bvr-section__toggle--active');
                }
            });
        });
    }

    /**
     * Initialize Load More buttons (per-section)
     */
    function initLoadMore() {
        document.querySelectorAll('.bvr-load-more').forEach(button => {
            button.addEventListener('click', () => {
                // Find the closest list within the same section
                const section = button.closest('.bvr-section__content') || button.closest('.bvr-results__content');
                const list = section?.querySelector('.bvr-results__list');
                if (!list) return;

                const step = parseInt(button.dataset.step, 10) || 20;
                const current = parseInt(button.dataset.current, 10) || 0;
                const total = parseInt(button.dataset.total, 10) || 0;

                // Reveal next batch of hidden cards
                const hiddenCards = list.querySelectorAll('.bvr-section__hidden-card');
                let revealed = 0;

                for (const wrapper of hiddenCards) {
                    if (revealed >= step) break;
                    // Unwrap: move the inner tournament card out of wrapper
                    const inner = wrapper.querySelector('.bvr-tournament-card');
                    if (inner) {
                        wrapper.replaceWith(inner);
                    } else {
                        wrapper.style.display = '';
                    }
                    revealed++;
                }

                const newCurrent = current + revealed;
                button.dataset.current = newCurrent;

                const remaining = total - newCurrent;
                if (remaining <= 0) {
                    button.remove();
                } else {
                    button.textContent = `Show more (${remaining} remaining)`;
                }
            });
        });
    }

    /**
     * Initialize filter dropdowns
     */
    function initFilters() {
        const filterSelects = document.querySelectorAll('.bvr-results__filter');

        filterSelects.forEach(select => {
            select.addEventListener('change', () => {
                const form = select.closest('form');
                if (form) {
                    form.submit();
                } else {
                    // Handle AJAX filter update
                    const container = select.closest('.bvr-results');
                    if (container) {
                        updateResults(container);
                    }
                }
            });
        });

    }

    /**
     * Update results via AJAX
     */
    async function updateResults(container) {
        const filters = {};
        container.querySelectorAll('.bvr-results__filter').forEach(filter => {
            filters[filter.name] = filter.value;
        });

        container.classList.add('bvr-loading');

        try {
            const response = await fetch(bvrConfig.ajaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    action: 'bvr_filter_results',
                    nonce: bvrConfig.nonce,
                    ...filters,
                }),
            });

            const data = await response.json();

            if (data.success && data.data.html) {
                const content = container.querySelector('.bvr-results__content');
                if (content) {
                    content.innerHTML = data.data.html;
                }
            }
        } catch (error) {
            console.error('[BVR] Filter error:', error);
        } finally {
            container.classList.remove('bvr-loading');
        }
    }

    /**
     * Format date to DD-MM-YYYY
     */
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose utilities for external use
    window.BVR = {
        AutoRefresh: BVRAutoRefresh,
        formatDate: formatDate,
    };

    /**
     * Global function to apply filters via URL navigation
     * Called from inline onchange handlers
     */
    window.bvrApplyFilters = function() {
        const container = document.querySelector('.bvr-results');
        if (!container) return;

        const genderSelect = container.querySelector('select[name="gender"]');
        const seasonSelect = container.querySelector('select[name="season"]');

        const gender = genderSelect ? genderSelect.value : 'all';
        const season = seasonSelect ? seasonSelect.value : new Date().getFullYear();

        // Build URL with filter parameters
        const url = new URL(window.location.href);

        // Remove tournament param if present (go back to list view)
        url.searchParams.delete('bvr_tournament');

        // Set filter params
        if (gender !== 'all') {
            url.searchParams.set('bvr_gender', gender);
        } else {
            url.searchParams.delete('bvr_gender');
        }

        if (season !== String(new Date().getFullYear())) {
            url.searchParams.set('bvr_season', season);
        } else {
            url.searchParams.delete('bvr_season');
        }

        // Navigate to filtered URL
        window.location.href = url.toString();
    };
})();
