// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://zodtmxoaqvbwicvoiuaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvZHRteG9hcXZid2ljdm9pdWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDkwNjQsImV4cCI6MjA4NDY4NTA2NH0.CM3p-WttkugGx9SoJeJxM7TN3-Zka1GDDHYFoOOR3lk';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current user state
let currentUser = null;

// Get current user
function getUser() {
    return currentUser;
}

// Check if user is signed in
function isSignedIn() {
    return currentUser !== null;
}

// Initialize auth state
async function initSupabase() {
    // Get initial session
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const previousUser = currentUser;
        currentUser = session?.user || null;

        // Dispatch custom event for auth state changes
        window.dispatchEvent(new CustomEvent('authStateChange', {
            detail: { user: currentUser, event }
        }));

        // Reload data when user signs in or out
        if (previousUser?.id !== currentUser?.id) {
            window.dispatchEvent(new CustomEvent('userChanged', {
                detail: { user: currentUser }
            }));
        }
    });

    return currentUser;
}

// Sign up with email
async function signUpWithEmail(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
    });

    if (error) throw error;
    return data;
}

// Sign in with email
async function signInWithEmail(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    return data;
}

// Sign in with Google
async function signInWithGoogle() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) throw error;
    return data;
}

// Sign out
async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

// Password reset
async function resetPassword(email) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    if (error) throw error;
    return data;
}
