

import { supabase } from './supabase-config.js';

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
    if (successDiv) {
        successDiv.classList.remove('show');
    }
}

// helper to build a user-friendly message from a Supabase error object
function formatSupabaseError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    let msg = err.message || '';
    // common scenario: schema not set up
    if (msg.includes('relation "profiles" does not exist') ||
        msg.includes('permission denied for relation profiles')) {
        return 'Database not initialized. Run the SQL setup script in your Supabase project.';
    }
    if (err.details) msg += ' ' + err.details;
    if (err.hint) msg += ' ' + err.hint;
    return msg || JSON.stringify(err);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.add('show');
    }
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

function hideMessages() {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    if (errorDiv) errorDiv.classList.remove('show');
    if (successDiv) successDiv.classList.remove('show');
}

async function handleLogin(e) {
    e.preventDefault();
    hideMessages();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error('signInWithPassword error object:', error);
            throw error;
        }

        // Refresh session to get latest user metadata (in case admin just approved them)
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshed?.user) {
            // Use refreshed user data with latest metadata
        }

        // Read role and verification_status from JWT user_metadata (now refreshed)
        const meta = (refreshed?.user?.user_metadata || data.user.user_metadata) || {};
        const role = meta.role || 'doctor';
        let verificationStatus = meta.verification_status;

        // For doctors, verify they are approved before allowing login
        if (role === 'doctor') {
            // If metadata has verification_status, check it
            if (verificationStatus && verificationStatus !== 'verified') {
                await supabase.auth.signOut();
                showError('Your account is pending verification by an administrator. Please wait for approval.');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
                return;
            }

            // If metadata doesn't have verification_status, query profiles as fallback
            if (!verificationStatus) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('verification_status')
                        .eq('id', data.user.id)
                        .maybeSingle();

                    if (profile && profile.verification_status !== 'verified') {
                        await supabase.auth.signOut();
                        showError('Your account is pending verification by an administrator. Please wait for approval.');
                        loginBtn.disabled = false;
                        loginBtn.textContent = 'Login';
                        return;
                    }
                } catch (profileErr) {
                    // If profile query fails (e.g. due to RLS), allow login to proceed
                    console.warn('Could not verify doctor status via profiles table:', profileErr.message);
                }
            }
        }

        showSuccess('Login successful! Redirecting...');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        console.error('Login failed:', error);
        let msg = formatSupabaseError(error);
        showError(msg);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    hideMessages();

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const role = 'doctor'; // Always doctor registration
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const registerBtn = document.getElementById('registerBtn');

    if (password !== confirmPassword) { showError('Passwords do not match'); return; }
    if (password.length < 8) { showError('Password must be at least 8 characters'); return; }

    // Doctor-specific values
    const doctorId = document.getElementById('doctorId').value.trim();
    const spec = document.getElementById('specialization') ? document.getElementById('specialization').value.trim() : '';
    const fileInput = document.getElementById('doctorLicense');
    
    if (!doctorId) { showError('Please enter your Doctor ID'); return; }
    if (!fileInput || fileInput.files.length === 0) { showError('Please upload your doctor license photo'); return; }
    
    const extraData = {
        doctor_id: doctorId,
        specialization: spec,
        verification_status: 'pending' // Doctors start as pending; admin must approve
    };

    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, role, ...extraData } }
        });

        if (error) {
            console.error('signUp error object:', error);
            throw error;
        }

        // Upload license file for doctors
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop();
            const path = data.user.id + '/' + role + '_license.' + ext;
            const { error: uploadError } = await supabase.storage.from('licenses').upload(path, file);
            if (uploadError) {
                console.warn('License upload failed:', uploadError.message);
            } else {
                const { data: urlData } = supabase.storage.from('licenses').getPublicUrl(path);
                await supabase.auth.updateUser({ data: { license_url: urlData.publicUrl } });
                // Also update the profiles table with the path for fresh signed URLs
                await supabase.from('profiles').update({ license_url: path }).eq('id', data.user.id);
            }
        }

        showSuccess('Registration submitted! Please wait for admin verification before logging in.');

        setTimeout(() => { window.location.href = 'login.html'; }, 2500);

    } catch (error) {
        // display more information if available
        console.error('Registration failed:', error);
        let msg = formatSupabaseError(error);
        showError(msg);
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
    }
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

// show/hide role-specific inputs (simplified for doctor-only registration)
function updateRoleFields() {
    const doctorFields = document.getElementById('doctorFields');
    // Doctor fields are always visible for doctor registration
    if (doctorFields) doctorFields.style.display = 'block';
}

// quick check at load time to catch uninitialized database early
async function sanityCheck() {
    try {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        if (error) {
            console.error('sanity check error:', error);
            if (error.message && error.message.includes('relation "profiles" does not exist')) {
                showError('Database not initialized. Please run the SQL setup script in your Supabase project.');
            }
        }
    } catch (e) {
        console.error('unexpected error during sanity check', e);
    }
}

sanityCheck();

const roleSelect = document.getElementById('role');
if (roleSelect) {
    // No longer needed since role is fixed to doctor
    // roleSelect.addEventListener('change', updateRoleFields);
    // run once to set correct visibility
    updateRoleFields();
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
}
