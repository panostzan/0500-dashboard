// ═══════════════════════════════════════════════════════════════════════════════
// AUTH UI - Sign In / Sign Up Modal
// ═══════════════════════════════════════════════════════════════════════════════

function createAuthModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal-overlay auth-modal-overlay';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content modal-auth">
            <div class="auth-container">
                <div class="auth-header">
                    <h2 class="auth-title">0500</h2>
                    <p class="auth-subtitle">Sign in to sync your data</p>
                </div>

                <div class="auth-form" id="auth-form">
                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="signin">Sign In</button>
                        <button class="auth-tab" data-tab="signup">Sign Up</button>
                    </div>

                    <div class="auth-error" id="auth-error"></div>
                    <div class="auth-success" id="auth-success"></div>

                    <div class="auth-fields">
                        <input type="email" id="auth-email" class="auth-input" placeholder="Email" autocomplete="email">
                        <input type="password" id="auth-password" class="auth-input" placeholder="Password" autocomplete="current-password">
                    </div>

                    <button class="auth-btn auth-btn-primary" id="auth-submit">Sign In</button>

                    <button class="auth-link" id="auth-forgot">Forgot password?</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    initAuthListeners();
}

function initAuthListeners() {
    const modal = document.getElementById('auth-modal');
    const tabs = modal.querySelectorAll('.auth-tab');
    const submitBtn = document.getElementById('auth-submit');
    const forgotBtn = document.getElementById('auth-forgot');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');

    let currentTab = 'signin';

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            submitBtn.textContent = currentTab === 'signin' ? 'Sign In' : 'Sign Up';
            clearAuthMessages();
        });
    });

    // Submit form
    submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showAuthError('Please enter email and password');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Loading...';
        clearAuthMessages();

        try {
            if (currentTab === 'signin') {
                await signInWithEmail(email, password);
                hideAuthModal();
            } else {
                await signUpWithEmail(email, password);
                showAuthSuccess('Check your email to confirm your account');
            }
        } catch (error) {
            showAuthError(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = currentTab === 'signin' ? 'Sign In' : 'Sign Up';
        }
    });

    // Forgot password
    forgotBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
            showAuthError('Enter your email first');
            return;
        }

        try {
            await resetPassword(email);
            showAuthSuccess('Password reset email sent');
        } catch (error) {
            showAuthError(error.message);
        }
    });

    // Enter key submits
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });
    });
}

function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function showAuthSuccess(message) {
    const successEl = document.getElementById('auth-success');
    successEl.textContent = message;
    successEl.style.display = 'block';
}

function clearAuthMessages() {
    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('auth-success').style.display = 'none';
}

function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// User menu (shown when signed in)
function createUserMenu() {
    const menu = document.createElement('div');
    menu.id = 'user-menu';
    menu.className = 'user-menu';
    menu.innerHTML = `
        <button class="user-menu-btn" id="user-menu-btn">
            <span class="user-avatar" id="user-avatar">?</span>
        </button>
        <div class="user-dropdown" id="user-dropdown">
            <div class="user-info" id="user-info"></div>
            <button class="user-dropdown-item" id="user-signout">Sign Out</button>
        </div>
    `;

    document.querySelector('.top-bar').appendChild(menu);

    const btn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');

    btn.addEventListener('click', () => {
        dropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    document.getElementById('user-signout').addEventListener('click', async () => {
        await signOut();
        dropdown.classList.remove('active');
    });
}

function updateUserMenu() {
    const menu = document.getElementById('user-menu');
    const avatar = document.getElementById('user-avatar');
    const info = document.getElementById('user-info');

    if (!menu) return;

    if (isSignedIn()) {
        menu.style.display = 'block';
        const email = currentUser.email || '';
        avatar.textContent = email.charAt(0).toUpperCase();
        info.textContent = email;
    } else {
        menu.style.display = 'none';
    }
}

function initAuth() {
    createAuthModal();
    createUserMenu();

    // Listen for auth changes
    window.addEventListener('authStateChange', () => {
        updateUserMenu();
    });

    // Initial state
    updateUserMenu();

    // Show auth modal if not signed in
    if (!isSignedIn()) {
        showAuthModal();
    }
}
