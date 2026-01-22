// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATIONS - HUD Number Ticker & Visual Effects
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Animate a number from start to end value
 * Uses requestAnimationFrame for smooth 60fps animation
 * @param {Object} options Animation options
 * @param {HTMLElement} options.element - Target element
 * @param {number} options.start - Starting value
 * @param {number} options.end - Ending value
 * @param {number} options.duration - Animation duration in ms (default: 1000)
 * @param {string} options.format - Format function name: 'integer', 'decimal', 'time', 'temperature'
 * @param {function} options.onComplete - Callback when animation completes
 */
function animateNumber(options) {
    const {
        element,
        start = 0,
        end,
        duration = 1000,
        format = 'integer',
        onComplete = null
    } = options;

    if (!element) return;

    const startTime = performance.now();
    const change = end - start;

    // Ease-out cubic for natural deceleration
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function formatValue(value, formatType) {
        switch (formatType) {
            case 'integer':
                return Math.round(value).toString();
            case 'decimal':
                return value.toFixed(1);
            case 'temperature':
                return Math.round(value) + '°';
            case 'time':
                // Format as H:MM or HH:MM
                const hours = Math.floor(value);
                const minutes = Math.round((value - hours) * 60);
                return `${hours}:${minutes.toString().padStart(2, '0')}`;
            case 'countdown':
                // Format as M:SS
                const mins = Math.floor(value);
                const secs = Math.round((value - mins) * 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            default:
                return Math.round(value).toString();
        }
    }

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const currentValue = start + (change * easedProgress);

        element.textContent = formatValue(currentValue, format);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = formatValue(end, format);
            if (onComplete) onComplete();
        }
    }

    requestAnimationFrame(animate);
}

/**
 * Animate clock time with ticker effect
 * @param {HTMLElement} element - Clock display element
 * @param {string} targetTime - Target time string (e.g., "5:00")
 * @param {number} duration - Animation duration in ms
 */
function animateClockTicker(element, targetTime, duration = 1200) {
    if (!element) return;

    const [targetHours, targetMinutes] = targetTime.split(':').map(Number);
    const startTime = performance.now();

    // Start from random numbers for "booting up" effect
    let displayHours = Math.floor(Math.random() * 12) + 1;
    let displayMinutes = Math.floor(Math.random() * 60);

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 0.6) {
            // Scramble phase - rapid random numbers
            displayHours = Math.floor(Math.random() * 12) + 1;
            displayMinutes = Math.floor(Math.random() * 60);
        } else {
            // Settle phase - ease toward target
            const settleProgress = (progress - 0.6) / 0.4;
            const easedProgress = easeOutExpo(settleProgress);

            displayHours = Math.round(displayHours + (targetHours - displayHours) * easedProgress);
            displayMinutes = Math.round(displayMinutes + (targetMinutes - displayMinutes) * easedProgress);
        }

        element.textContent = `${displayHours}:${displayMinutes.toString().padStart(2, '0')}`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = targetTime;
        }
    }

    requestAnimationFrame(animate);
}

/**
 * Animate timer countdown display
 * @param {HTMLElement} element - Timer display element
 * @param {number} targetMinutes - Target minutes to display
 * @param {number} duration - Animation duration in ms
 * @param {function} onComplete - Callback when done
 */
function animateTimerStart(element, targetMinutes, duration = 800, onComplete = null) {
    if (!element) return;

    const startTime = performance.now();

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);

        // Count up from 0 to target
        const currentMins = Math.floor(targetMinutes * easedProgress);
        const currentSecs = Math.floor(((targetMinutes * easedProgress) - currentMins) * 60);

        element.textContent = `${currentMins}:${currentSecs.toString().padStart(2, '0')}`;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.textContent = `${targetMinutes}:00`;
            if (onComplete) onComplete();
        }
    }

    requestAnimationFrame(animate);
}

/**
 * Animate temperature with counting effect
 * @param {HTMLElement} element - Temperature display element
 * @param {number} targetTemp - Target temperature
 * @param {number} duration - Animation duration in ms
 */
function animateTemperature(element, targetTemp, duration = 1000) {
    if (!element) return;

    // Start from a nearby value for subtle effect
    const startTemp = targetTemp + (Math.random() > 0.5 ? 15 : -15);

    animateNumber({
        element,
        start: startTemp,
        end: targetTemp,
        duration,
        format: 'temperature'
    });
}

/**
 * Boot-up sequence for HUD elements
 * Animates multiple elements in sequence for "systems online" effect
 * @param {Array} elements - Array of {element, type, value, delay} objects
 */
function runBootSequence(elements) {
    elements.forEach(({ element, type, value, delay = 0 }) => {
        setTimeout(() => {
            switch (type) {
                case 'clock':
                    animateClockTicker(element, value);
                    break;
                case 'temperature':
                    animateTemperature(element, value);
                    break;
                case 'timer':
                    animateTimerStart(element, value);
                    break;
                case 'number':
                    animateNumber({ element, start: 0, end: value });
                    break;
            }
        }, delay);
    });
}

// Track if initial boot animation has run
let hasBooted = false;

/**
 * Check if boot animation should run
 * @returns {boolean}
 */
function shouldRunBootAnimation() {
    if (hasBooted) return false;
    hasBooted = true;
    return true;
}

/**
 * Reset boot state (useful for testing)
 */
function resetBootState() {
    hasBooted = false;
}
