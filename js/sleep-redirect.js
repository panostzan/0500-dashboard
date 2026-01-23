// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP REDIRECT - Auto-route to mobile or desktop sleep page
// ═══════════════════════════════════════════════════════════════════════════════

(function() {
    // Detect if user is on mobile device
    function isMobile() {
        // Check viewport width
        if (window.innerWidth <= 768) return true;

        // Check user agent for mobile devices
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        if (mobileRegex.test(navigator.userAgent)) return true;

        // Check for touch capability (not definitive but helpful)
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            // Only consider it mobile if also narrow viewport
            if (window.innerWidth <= 1024) return true;
        }

        return false;
    }

    // Get the appropriate sleep page URL
    function getSleepPageUrl() {
        return isMobile() ? 'sleep.html' : 'sleep-desktop.html';
    }

    // Navigate to sleep page
    function goToSleepPage() {
        window.location.href = getSleepPageUrl();
    }

    // Expose functions globally
    window.SleepRedirect = {
        isMobile: isMobile,
        getUrl: getSleepPageUrl,
        go: goToSleepPage
    };
})();
