// ═══════════════════════════════════════════════════════════════════════════════
// DATA SERVICE - Abstracts storage (Supabase for signed-in, localStorage for anon)
// ═══════════════════════════════════════════════════════════════════════════════

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
                return this._getEmptyGoals();
            }

            // Transform to app format
            const goals = { daily: [], midTerm: [], longTerm: [] };
            data.forEach(g => {
                if (goals[g.category]) {
                    goals[g.category].push({
                        id: g.id,
                        text: g.text,
                        checked: g.checked
                    });
                }
            });
            return goals;
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem('0500_goals');
            if (saved) return JSON.parse(saved);
            return this._getEmptyGoals();
        }
    },

    async saveGoals(goals) {
        if (isSignedIn()) {
            const userId = currentUser.id;

            // Delete existing goals and insert new ones
            const { error: deleteError } = await supabaseClient.from('goals').delete().eq('user_id', userId);
            if (deleteError) {
                console.error('Error deleting goals:', deleteError);
                return; // Don't insert if delete failed
            }

            const inserts = [];
            ['daily', 'midTerm', 'longTerm'].forEach(category => {
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

            if (inserts.length > 0) {
                const { error } = await supabaseClient.from('goals').insert(inserts);
                if (error) console.error('Error saving goals:', error);
            }
        } else {
            localStorage.setItem('0500_goals', JSON.stringify(goals));
        }
    },

    _getEmptyGoals() {
        return {
            daily: [],
            midTerm: [],
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
                return this._getEmptySchedule();
            }

            if (data.length === 0) {
                return this._getEmptySchedule();
            }

            return data.map(e => ({
                id: e.id,
                time: e.time || '',
                activity: e.activity || ''
            }));
        } else {
            const saved = localStorage.getItem('0500_schedule_entries');
            if (saved) return JSON.parse(saved);
            return this._getEmptySchedule();
        }
    },

    async saveSchedule(entries) {
        if (isSignedIn()) {
            const userId = currentUser.id;

            const { error: deleteError } = await supabaseClient.from('schedule_entries').delete().eq('user_id', userId);
            if (deleteError) {
                console.error('Error deleting schedule:', deleteError);
                return; // Don't insert if delete failed
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
        } else {
            localStorage.setItem('0500_schedule_entries', JSON.stringify(entries));
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
                .order('date', { ascending: false })
                .limit(30);

            if (error) {
                console.error('Error loading sleep log:', error);
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
            const userId = currentUser.id;

            // Upsert based on date
            for (const entry of log) {
                const { error } = await supabaseClient
                    .from('sleep_log')
                    .upsert({
                        user_id: userId,
                        date: entry.date,
                        bedtime: entry.bedtime,
                        wake_time: entry.wakeTime,
                        hours: entry.hours
                    }, {
                        onConflict: 'user_id,date'
                    });

                if (error) console.error('Error saving sleep entry:', error);
            }
        } else {
            localStorage.setItem('0500_sleep_log', JSON.stringify(log));
        }
    },

    async addSleepEntry(entry) {
        if (isSignedIn()) {
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

            if (error) console.error('Error adding sleep entry:', error);
        } else {
            const log = await this.loadSleepLog();
            const idx = log.findIndex(e => e.date === entry.date);
            if (idx >= 0) {
                log[idx] = entry;
            } else {
                log.push(entry);
            }
            localStorage.setItem('0500_sleep_log', JSON.stringify(log));
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
            const { error } = await supabaseClient
                .from('profiles')
                .update({
                    wake_time: settings.wakeTime,
                    target_sleep_hours: settings.targetHours,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentUser.id);

            if (error) console.error('Error saving sleep settings:', error);
        } else {
            localStorage.setItem('0500_sleep_settings', JSON.stringify(settings));
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

            if (error || !data) return '';
            return data.content || '';
        } else {
            return localStorage.getItem('0500_notes') || '';
        }
    },

    async saveNotes(content) {
        if (isSignedIn()) {
            const { error } = await supabaseClient
                .from('notes')
                .update({
                    content,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', currentUser.id);

            if (error) console.error('Error saving notes:', error);
        } else {
            localStorage.setItem('0500_notes', content);
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // GOALS COLLAPSED STATE (local only - UI preference)
    // ═══════════════════════════════════════════════════════════════════════════

    loadCollapsedState() {
        const saved = localStorage.getItem('0500_goals_collapsed');
        if (saved) return JSON.parse(saved);
        return { daily: false, midTerm: true, longTerm: true };
    },

    saveCollapsedState(state) {
        localStorage.setItem('0500_goals_collapsed', JSON.stringify(state));
    }
};
