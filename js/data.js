// ═══════════════════════════════════════════════════════════════════════════════
// DATA SERVICE - Abstracts storage (Supabase for signed-in, localStorage for anon)
// ═══════════════════════════════════════════════════════════════════════════════

// Safe localStorage.setItem — catches QuotaExceededError
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            console.warn('localStorage quota exceeded for key:', key);
            // Try clearing old/stale data to free space
            try {
                localStorage.removeItem('0500_user_location');
                localStorage.setItem(key, value); // retry once
            } catch (_) {
                console.error('localStorage quota exceeded — cannot save:', key);
            }
        } else {
            throw e;
        }
    }
}

// Exponential backoff retry for Supabase operations
async function withRetry(fn, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
            }
        }
    }
    throw lastError;
}

// Save locks to prevent concurrent saves from racing (delete-then-insert interleaving)
const saveLocks = {
    goals: { inProgress: false, pending: null },
    schedule: { inProgress: false, pending: null }
};

// Track active cloud saves to warn before page unload during delete-then-insert
let _activeSaveCount = 0;

function _onBeforeUnload(e) {
    if (_activeSaveCount > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
}
window.addEventListener('beforeunload', _onBeforeUnload);

async function withSaveLock(lockName, saveFn) {
    const lock = saveLocks[lockName];

    if (lock.inProgress) {
        // Save already in progress - queue this one
        return new Promise((resolve) => {
            lock.pending = async () => {
                resolve(await saveFn());
            };
        });
    }

    lock.inProgress = true;
    _activeSaveCount++;
    try {
        await saveFn();
    } finally {
        _activeSaveCount--;
        lock.inProgress = false;
        // Run pending save if queued
        if (lock.pending) {
            const pendingFn = lock.pending;
            lock.pending = null;
            await pendingFn();
        }
    }
}

const DataService = {
    // ═══════════════════════════════════════════════════════════════════════════
    // GOALS
    // ═══════════════════════════════════════════════════════════════════════════

    async loadGoals() {
        if (isSignedIn()) {
            const { data, error } = await supabaseClient
                .from('goals')
                .select('*')
                .order('category')
                .order('sort_order');

            if (error) {
                console.error('Error loading goals:', error);
                const fallback = localStorage.getItem('0500_goals');
                if (fallback) return JSON.parse(fallback);
                return this._getEmptyGoals();
            }

            // Transform to app format
            const goals = { daily: [], midTerm: [], oneYear: [], longTerm: [] };
            data.forEach(g => {
                if (goals[g.category]) {
                    goals[g.category].push({
                        id: g.id,
                        text: g.text,
                        checked: g.checked
                    });
                }
            });

            if (data.length > 0) {
                // Successful cloud load with data — back up to localStorage
                safeSetItem('0500_goals', JSON.stringify(goals));
            } else {
                // Cloud returned empty — check if localStorage has goals
                // (protects against transient empty reads wiping the cache)
                const fallback = localStorage.getItem('0500_goals');
                if (fallback) {
                    const cached = JSON.parse(fallback);
                    const cachedTotal = ['daily', 'midTerm', 'oneYear', 'longTerm']
                        .reduce((sum, cat) => sum + (cached[cat]?.length || 0), 0);
                    if (cachedTotal > 0) {
                        console.warn('loadGoals: Supabase returned empty but localStorage has data — using localStorage');
                        return cached;
                    }
                }
            }
            return goals;
        } else {
            const saved = localStorage.getItem('0500_goals');
            if (saved) return JSON.parse(saved);
            return this._getEmptyGoals();
        }
    },

    async saveGoals(goals) {
        const totalGoals = ['daily', 'midTerm', 'oneYear', 'longTerm']
            .reduce((sum, cat) => sum + goals[cat].length, 0);

        if (isSignedIn()) {
            // Safety: never wipe all goals from a save with empty data
            if (totalGoals === 0) {
                console.warn('saveGoals: blocked save with 0 goals (safety guard)');
                return;
            }

            await withSaveLock('goals', async () => {
                const userId = currentUser.id;

                const inserts = [];
                ['daily', 'midTerm', 'oneYear', 'longTerm'].forEach(category => {
                    goals[category].forEach((g, idx) => {
                        inserts.push({
                            user_id: userId,
                            category,
                            text: g.text,
                            checked: g.checked,
                            sort_order: idx
                        });
                    });
                });

                // Delete existing goals and insert new ones
                const { error: deleteError } = await supabaseClient.from('goals').delete().eq('user_id', userId);
                if (deleteError) {
                    console.error('Error deleting goals:', deleteError);
                    return;
                }

                const { error } = await supabaseClient.from('goals').insert(inserts);
                if (error) console.error('Error saving goals:', error);
            });

            // Backup to localStorage only after successful cloud save
            safeSetItem('0500_goals', JSON.stringify(goals));
        } else {
            safeSetItem('0500_goals', JSON.stringify(goals));
        }
    },

    _getEmptyGoals() {
        return {
            daily: [],
            midTerm: [],
            oneYear: [],
            longTerm: []
        };
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SCHEDULE
    // ═══════════════════════════════════════════════════════════════════════════

    async loadSchedule() {
        if (isSignedIn()) {
            const { data, error } = await supabaseClient
                .from('schedule_entries')
                .select('*')
                .order('sort_order');

            if (error) {
                console.error('Error loading schedule:', error);
                const fallback = localStorage.getItem('0500_schedule_entries');
                if (fallback) return JSON.parse(fallback);
                return this._getEmptySchedule();
            }

            if (data.length === 0) {
                // Cloud returned empty — check if localStorage has schedule
                const fallback = localStorage.getItem('0500_schedule_entries');
                if (fallback) {
                    const cached = JSON.parse(fallback);
                    const hasContent = cached.some(e => e.time || e.activity);
                    if (hasContent) {
                        console.warn('loadSchedule: Supabase returned empty but localStorage has data — using localStorage');
                        return cached;
                    }
                }
                return this._getEmptySchedule();
            }

            const result = data.map(e => ({
                id: e.id,
                time: e.time || '',
                activity: e.activity || ''
            }));
            // Backup to localStorage for fallback
            safeSetItem('0500_schedule_entries', JSON.stringify(result));
            return result;
        } else {
            const saved = localStorage.getItem('0500_schedule_entries');
            if (saved) return JSON.parse(saved);
            return this._getEmptySchedule();
        }
    },

    async saveSchedule(entries) {
        if (isSignedIn()) {
            // Safety: block saving completely empty schedule
            const hasContent = entries.some(e => e.time || e.activity);
            if (entries.length === 0 || !hasContent) {
                console.warn('saveSchedule: blocked save with empty schedule (safety guard)');
                return;
            }

            await withSaveLock('schedule', async () => {
                const userId = currentUser.id;

                const { error: deleteError } = await supabaseClient.from('schedule_entries').delete().eq('user_id', userId);
                if (deleteError) {
                    console.error('Error deleting schedule:', deleteError);
                    return;
                }

                const inserts = entries.map((e, idx) => ({
                    user_id: userId,
                    time: e.time,
                    activity: e.activity,
                    sort_order: idx
                }));

                if (inserts.length > 0) {
                    const { error } = await supabaseClient.from('schedule_entries').insert(inserts);
                    if (error) console.error('Error saving schedule:', error);
                }
            });

            // Backup to localStorage after successful cloud save
            safeSetItem('0500_schedule_entries', JSON.stringify(entries));
        } else {
            safeSetItem('0500_schedule_entries', JSON.stringify(entries));
        }
    },

    _getEmptySchedule() {
        return Array(20).fill(null).map(() => ({ time: '', activity: '' }));
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SLEEP LOG
    // ═══════════════════════════════════════════════════════════════════════════

    async loadSleepLog() {
        if (isSignedIn()) {
            const { data, error } = await supabaseClient
                .from('sleep_log')
                .select('*')
                .order('date', { ascending: true });

            if (error) {
                console.error('Error loading sleep log:', error);
                // Fall back to localStorage instead of returning empty
                const fallback = localStorage.getItem('0500_sleep_log');
                if (fallback) return JSON.parse(fallback);
                return [];
            }

            return data.map(e => ({
                date: e.date,
                bedtime: e.bedtime,
                wakeTime: e.wake_time,
                hours: e.hours
            }));
        } else {
            const saved = localStorage.getItem('0500_sleep_log');
            if (saved) return JSON.parse(saved);
            return [];
        }
    },

    async saveSleepLog(log) {
        if (isSignedIn()) {
            await withRetry(async () => {
                const userId = currentUser.id;
                const rows = log.map(entry => ({
                    user_id: userId,
                    date: entry.date,
                    bedtime: entry.bedtime,
                    wake_time: entry.wakeTime,
                    hours: entry.hours
                }));

                if (rows.length > 0) {
                    const { error } = await supabaseClient
                        .from('sleep_log')
                        .upsert(rows, { onConflict: 'user_id,date' });

                    if (error) throw error;
                }
            });
        } else {
            safeSetItem('0500_sleep_log', JSON.stringify(log));
        }
    },

    async deleteSleepEntry(date) {
        if (isSignedIn()) {
            await withRetry(async () => {
                const { error } = await supabaseClient
                    .from('sleep_log')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('date', date);

                if (error) throw error;
            });
        }
        // localStorage handled by caller
    },

    async addSleepEntry(entry) {
        if (isSignedIn()) {
            await withRetry(async () => {
                const { error } = await supabaseClient
                    .from('sleep_log')
                    .upsert({
                        user_id: currentUser.id,
                        date: entry.date,
                        bedtime: entry.bedtime,
                        wake_time: entry.wakeTime,
                        hours: entry.hours
                    }, {
                        onConflict: 'user_id,date'
                    });

                if (error) throw error;
            });
        } else {
            const log = await this.loadSleepLog();
            const idx = log.findIndex(e => e.date === entry.date);
            if (idx >= 0) {
                log[idx] = entry;
            } else {
                log.push(entry);
            }
            safeSetItem('0500_sleep_log', JSON.stringify(log));
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SLEEP SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════

    async loadSleepSettings() {
        if (isSignedIn()) {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('wake_time, target_sleep_hours')
                .eq('id', currentUser.id)
                .single();

            if (error || !data) {
                // Fall back to localStorage instead of defaults
                const fallback = localStorage.getItem('0500_sleep_settings');
                if (fallback) {
                    const parsed = JSON.parse(fallback);
                    return {
                        wakeTime: `${(parsed.wakeHour || 5).toString().padStart(2, '0')}:${(parsed.wakeMinute || 0).toString().padStart(2, '0')}`,
                        targetHours: parsed.targetSleepHours || 7.5
                    };
                }
                return { wakeTime: '05:00', targetHours: 7.5 };
            }

            return {
                wakeTime: data.wake_time || '05:00',
                targetHours: data.target_sleep_hours || 7.5
            };
        } else {
            const saved = localStorage.getItem('0500_sleep_settings');
            if (saved) return JSON.parse(saved);
            return { wakeTime: '05:00', targetHours: 7.5 };
        }
    },

    async saveSleepSettings(settings) {
        if (isSignedIn()) {
            await withRetry(async () => {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({
                        wake_time: settings.wakeTime,
                        target_sleep_hours: settings.targetHours,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', currentUser.id);

                if (error) throw error;
            });
        } else {
            safeSetItem('0500_sleep_settings', JSON.stringify(settings));
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // NOTES
    // ═══════════════════════════════════════════════════════════════════════════

    async loadNotes() {
        if (isSignedIn()) {
            const { data, error } = await supabaseClient
                .from('notes')
                .select('content')
                .eq('user_id', currentUser.id)
                .single();

            if (error || !data) {
                // Fall back to localStorage instead of empty
                return localStorage.getItem('0500_notes') || '';
            }
            return data.content || '';
        } else {
            return localStorage.getItem('0500_notes') || '';
        }
    },

    async saveNotes(content) {
        if (isSignedIn()) {
            await withRetry(async () => {
                const { error } = await supabaseClient
                    .from('notes')
                    .update({
                        content,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', currentUser.id);

                if (error) throw error;
            });
        } else {
            safeSetItem('0500_notes', content);
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // DAILY GOAL HISTORY (local only - weekly review data)
    // ═══════════════════════════════════════════════════════════════════════════

    loadDailyGoalHistory() {
        const saved = localStorage.getItem('0500_daily_goal_history');
        if (saved) return JSON.parse(saved);
        return [];
    },

    saveDailyGoalHistory(log) {
        safeSetItem('0500_daily_goal_history', JSON.stringify(log));
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // GOALS COLLAPSED STATE (local only - UI preference)
    // ═══════════════════════════════════════════════════════════════════════════

    loadCollapsedState() {
        const saved = localStorage.getItem('0500_goals_collapsed');
        if (saved) return JSON.parse(saved);
        return { daily: false, midTerm: true, oneYear: true, longTerm: true };
    },

    saveCollapsedState(state) {
        safeSetItem('0500_goals_collapsed', JSON.stringify(state));
    }
};
