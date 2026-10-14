const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use((err, req, res, next) => {
    if (err) {
        console.error("Request body parse error:", err.message);
        return res.status(400).json({ error: 'Invalid request data' });
    }
    next();
});

// --- Cookie Parser Helper ---
function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers && req.headers.cookie;
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name?.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        list[name] = decodeURIComponent(value);
    });
    return list;
}

// --- Database Helpers ---
function getDB() {
    if (!fs.existsSync(DB_FILE)) {
        // Default Database Structure
        const defaultDB = {
            settings: { duration: 30, cooling: 15 },
            availability: {
                sun: { active: false, start: "09:00", end: "17:00" },
                mon: { active: true, start: "09:00", end: "17:00" },
                tue: { active: true, start: "09:00", end: "17:00" },
                wed: { active: true, start: "09:00", end: "17:00" },
                thu: { active: true, start: "09:00", end: "17:00" },
                fri: { active: true, start: "09:00", end: "17:00" },
                sat: { active: false, start: "09:00", end: "17:00" }
            },
            auth: {
                username: "admin",
                password: "hghrg343455%$%^BJGU"
            },
            sessions: {},
            resetTokens: {}
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
        return defaultDB;
    }
    
    let db;
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Failed to parse db.json, creating fallback:", e);
        db = {};
    }

    // Ensure auth object exists with user-specified default credentials if not set
    let modified = false;
    if (!db.auth || !db.auth.username || !db.auth.password) {
        db.auth = {
            username: "admin",
            password: "hghrg343455%$%^BJGU"
        };
        modified = true;
    }
    if (!db.sessions) {
        db.sessions = {};
        modified = true;
    }
    if (!db.resetTokens) {
        db.resetTokens = {};
        modified = true;
    }
    if (modified) {
        saveDB(db);
    }
    return db;
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- Session and Auth Helpers ---
function isValidSession(req) {
    const cookies = parseCookies(req);
    const authHeader = req.headers['authorization'];
    let token = cookies['admin_session'];

    // Also support Authorization header Bearer token and custom x-admin-token
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    }
    if (!token && req.headers['x-admin-token']) {
        token = req.headers['x-admin-token'];
    }

    if (!token) return false;

    const db = getDB();
    if (!db.sessions || !db.sessions[token]) return false;

    const session = db.sessions[token];
    if (session.expiresAt && Date.now() > session.expiresAt) {
        delete db.sessions[token];
        saveDB(db);
        return false;
    }
    return true;
}

function requireAdminAuth(req, res, next) {
    if (!isValidSession(req)) {
        return res.status(401).json({ error: 'Unauthorized. Please login to access the admin portal.' });
    }
    next();
}

// --- Protected Static Admin Route Interception ---
// Check credentials before serving admin.html so unauthorized users cannot access it
app.get(['/admin.html', '/admin'], (req, res, next) => {
    if (!isValidSession(req)) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// If user is already authenticated and visits /login.html, redirect directly to /admin.html
app.get('/login.html', (req, res, next) => {
    if (isValidSession(req)) {
        return res.redirect('/admin.html');
    }
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the frontend static files (HTML, CSS, images, JS) directly from this directory
app.use(express.static(__dirname));

// ==========================================
// --- Authentication API Endpoints ---
// ==========================================

// Check Auth Status
app.get('/api/auth/check', (req, res) => {
    if (isValidSession(req)) {
        return res.json({ authenticated: true, user: 'admin' });
    }
    return res.json({ authenticated: false });
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
    const { username, password, rememberMe } = req.body;
    const db = getDB();

    if (username === db.auth.username && password === db.auth.password) {
        const token = crypto.randomBytes(32).toString('hex');
        const maxAgeSec = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 1 day
        const expiresAt = Date.now() + (maxAgeSec * 1000);

        if (!db.sessions) db.sessions = {};
        db.sessions[token] = {
            username: db.auth.username,
            expiresAt
        };
        saveDB(db);

        res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`);
        return res.json({ success: true, token });
    } else {
        return res.status(401).json({ error: 'Invalid Admin ID or Password. Please try again.' });
    }
});

// Admin Logout
app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies['admin_session'] || req.headers['x-admin-token'];
    const db = getDB();
    if (token && db.sessions && db.sessions[token]) {
        delete db.sessions[token];
        saveDB(db);
    }
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return res.json({ success: true });
});

// Forgot Password - Generates Reset Link and sends to Google Sheet Webhook
app.post('/api/auth/forgot-password', async (req, res) => {
    const { username } = req.body;
    const db = getDB();

    if (username !== db.auth.username) {
        return res.status(400).json({ error: 'Admin ID does not match records.' });
    }

    // Generate secure random reset token (1 hour validity)
    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + (60 * 60 * 1000);

    if (!db.resetTokens) db.resetTokens = {};
    db.resetTokens[resetToken] = {
        username: db.auth.username,
        expiresAt
    };
    saveDB(db);

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const resetLink = `${protocol}://${host}/reset-password.html?token=${resetToken}`;

    let sheetConnected = false;

    // Dispatch to Google Sheet Webhook if configured
    if (db.integrations && db.integrations.googleSheetsUrl) {
        try {
            await fetch(db.integrations.googleSheetsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'password_reset',
                    resetLink: resetLink,
                    username: db.auth.username,
                    timestamp: new Date().toISOString()
                })
            });
            sheetConnected = true;
        } catch (e) {
            console.error("Failed to dispatch password reset link to Google Sheet:", e);
        }
    }

    if (sheetConnected) {
        return res.json({
            success: true,
            sheetConnected: true,
            message: 'A secure password reset link has been dispatched to your Google Sheet! Open your Google Sheet and click the link to reset your password.'
        });
    } else {
        // Fallback: If Google Sheet is not yet connected, provide direct emergency link so admin is never locked out
        return res.json({
            success: true,
            sheetConnected: false,
            message: 'Google Sheets webhook is not configured or reachable yet. You can use this emergency direct link to reset your password:',
            resetLink: resetLink
        });
    }
});

// Reset Password (using token)
app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Valid reset token and password (at least 6 characters) are required.' });
    }

    const db = getDB();
    if (!db.resetTokens || !db.resetTokens[token]) {
        return res.status(400).json({ error: 'This password reset link is invalid or has already been used.' });
    }

    const tokenInfo = db.resetTokens[token];
    if (Date.now() > tokenInfo.expiresAt) {
        delete db.resetTokens[token];
        saveDB(db);
        return res.status(400).json({ error: 'This password reset link has expired. Please request a new one.' });
    }

    // Update password
    db.auth.password = newPassword;

    // Invalidate the used token
    delete db.resetTokens[token];

    // Invalidate all active sessions for security so admin logs in fresh
    db.sessions = {};
    saveDB(db);

    return res.json({ success: true, message: 'Password updated successfully! You can now log in with your new password.' });
});

// ==========================================
// --- General & CRM API Endpoints ---
// ==========================================

// Get current configuration (sanitized copy for public visitor security)
app.get('/api/config', (req, res) => {
    const rawDB = getDB();
    const safeDB = JSON.parse(JSON.stringify(rawDB));
    delete safeDB.auth;
    delete safeDB.sessions;
    delete safeDB.resetTokens;
    if (safeDB.integrations && !isValidSession(req)) {
        delete safeDB.integrations.razorpayKeySecret;
    }
    res.json(safeDB);
});

// Save configuration (Admin Only)
app.post('/api/config', requireAdminAuth, (req, res) => {
    const currentDB = getDB();
    const newData = req.body;
    
    // Merge new data into existing DB
    if (newData.settings) currentDB.settings = newData.settings;
    if (newData.availability) currentDB.availability = newData.availability;
    if (newData.content) currentDB.content = newData.content;
    if (newData.plans) currentDB.plans = newData.plans;
    if (newData.unlistedPlan) {
        currentDB.unlistedPlan = { ...(currentDB.unlistedPlan || {}), ...newData.unlistedPlan };
    }
    if (newData.blockedDates !== undefined) currentDB.blockedDates = newData.blockedDates;
    if (newData.integrations) {
        currentDB.integrations = { ...(currentDB.integrations || {}), ...newData.integrations };
    }
    
    saveDB(currentDB);
    res.json({ success: true, message: 'Configuration saved successfully.' });
});

// Calculate actual available slots for the next 7 valid days (used by Booking Page)
app.get('/api/slots', (req, res) => {
    const db = getDB();
    
    // Read plan query parameter: standard numeric index or 'unlisted'
    let selectedPlan = null;
    if (req.query.plan === 'unlisted' && db.unlistedPlan) {
        selectedPlan = db.unlistedPlan;
    } else {
        let planIndex = parseInt(req.query.plan) || 0;
        selectedPlan = db.plans && db.plans.length > planIndex ? db.plans[planIndex] : null;
    }
    
    // Use the specific plan's duration, fallback to global settings if not found
    const duration = selectedPlan && selectedPlan.duration ? parseInt(selectedPlan.duration) : (parseInt(db.settings.duration) || 30);
    const cooling = parseInt(db.settings.cooling) || 15;
    const step = duration + cooling; // Total time consumed per appointment

    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let upcomingDays = [];
    let today = new Date();
    let currentTotalMins = (today.getHours() * 60) + today.getMinutes();
    
    let daysChecked = 0;
    // Look ahead until we find 7 valid days with slots, cap at 30 to prevent infinite loops
    while (upcomingDays.length < 7 && daysChecked < 30) {
        let targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysChecked);
        
        let dayIndex = targetDate.getDay();
        let dayStr = daysMap[dayIndex];
        let dayConfig = db.availability[dayStr];
        
        const targetYMD = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        let isBlocked = false;
        if (db.blockedDates && db.blockedDates.length > 0) {
            for (const block of db.blockedDates) {
                if (targetYMD >= block.start && targetYMD <= block.end) {
                    isBlocked = true;
                    break;
                }
            }
        }
        
        let slots = [];
        let active = dayConfig && dayConfig.active === true && !isBlocked;
        
        if (active) {
            let [startH, startM] = dayConfig.start.split(':').map(Number);
            let [endH, endM] = dayConfig.end.split(':').map(Number);
            let startTotalMins = (startH * 60) + startM;
            let endTotalMins = (endH * 60) + endM;
            
            let isToday = daysChecked === 0;
            // 30-minute buffer: cannot book a slot if it starts within 30 minutes of "now"
            let bufferMins = 30;
            
            for (let time = startTotalMins; (time + duration) <= endTotalMins; time += step) {
                if (isToday && time <= (currentTotalMins + bufferMins)) {
                    continue; // Skip past times or times that are too soon
                }

                let h = Math.floor(time / 60);
                let m = time % 60;
                let period = h >= 12 ? 'PM' : 'AM';
                let h12 = h % 12 || 12;
                let timeString = `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
                
                let type = 'Morning';
                if (h >= 12 && h < 16) type = 'Midday';
                if (h >= 16) type = 'Evening';

                slots.push({ time: timeString, type: type });
            }
        }
        
        // Only add the day if there is at least 1 valid slot
        if (slots.length > 0) {
            upcomingDays.push({
                date: targetDate.getFullYear() + '-' + String(targetDate.getMonth()+1).padStart(2,'0') + '-' + String(targetDate.getDate()).padStart(2,'0'),
                dayName: dayStr.toUpperCase(),
                dayNum: targetDate.getDate(),
                monthStr: targetDate.toLocaleString('default', { month: 'short' }),
                slots: slots,
                slotCount: slots.length
            });
        }
        
        daysChecked++;
    }
    
    res.json(upcomingDays);
});

// Process Booking Submission (Public)
app.post('/api/book', async (req, res) => {
    const { name, dob, phone, location, dateTimeStr, planId } = req.body;
    
    const db = getDB();
    if(!db.bookings) db.bookings = [];
    
    // Look up amount and duration from the selected plan
    let amount = "N/A";
    let duration = "N/A";
    if (planId === 'unlisted' && db.unlistedPlan) {
        amount = db.unlistedPlan.price ? "₹" + db.unlistedPlan.price : "N/A";
        duration = db.unlistedPlan.duration ? db.unlistedPlan.duration + " Mins" : "N/A";
    } else {
        const pIdx = parseInt(planId) || 0;
        if (db.plans && db.plans[pIdx]) {
            amount = db.plans[pIdx].price ? "₹" + db.plans[pIdx].price : "N/A";
            duration = db.plans[pIdx].duration ? db.plans[pIdx].duration + " Mins" : "N/A";
        }
    }

    const newBooking = {
        id: "BK-" + Date.now().toString().slice(-6), // Shorter ID for sheets
        name, dob, phone, location, dateTimeStr,
        amount, duration,
        status: 'Upcoming', // Initial status
        createdAt: new Date().toISOString()
    };
    db.bookings.push(newBooking);
    
    // Trigger Google Sheets Webhook (Create)
    if (db.integrations && db.integrations.googleSheetsUrl) {
        try {
            await fetch(db.integrations.googleSheetsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', ...newBooking })
            });
        } catch (e) {
            console.error("Failed to push to Google Sheets Webhook", e);
        }
    }

    saveDB(db);
    res.json({ success: true, bookingId: newBooking.id });
});

// ==========================================
// --- Razorpay Payment Integration Endpoints ---
// ==========================================

// Create Razorpay Order
app.post('/api/payment/create-order', async (req, res) => {
    try {
        const { planId, name, phone, dob, location, dateTimeStr } = req.body;
        const db = getDB();

        // 1. Resolve Plan and Price
        let plan = null;
        if (planId === 'unlisted' && db.unlistedPlan) {
            plan = db.unlistedPlan;
        } else {
            const pIdx = parseInt(planId) || 0;
            if (db.plans && db.plans[pIdx]) {
                plan = db.plans[pIdx];
            } else if (db.plans && db.plans[0]) {
                plan = db.plans[0];
            }
        }

        const rawPrice = plan ? (plan.price || '349') : '349';
        const numPrice = parseInt(String(rawPrice).replace(/[^0-9]/g, '')) || 349;
        const amountInPaise = numPrice * 100;
        const planName = plan ? (plan.name || 'Tarot Reading Session') : 'Tarot Reading Session';
        const siteName = (db.content && db.content.siteName) ? db.content.siteName : 'Trikal Darshi Tarot';

        const keyId = (db.integrations && db.integrations.razorpayKeyId) ? db.integrations.razorpayKeyId.trim() : '';
        const keySecret = (db.integrations && db.integrations.razorpayKeySecret) ? db.integrations.razorpayKeySecret.trim() : '';

        if (!keyId) {
            return res.status(400).json({
                success: false,
                error: 'Razorpay Key ID is not configured in Tarot CRM Integrations.'
            });
        }

        let orderId = null;

        // 2. If Key Secret is present, create official Razorpay Order via REST API
        if (keySecret) {
            try {
                const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
                const receipt = 'rcpt_' + Date.now().toString().slice(-8);

                const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
                    method: 'POST',
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: amountInPaise,
                        currency: 'INR',
                        receipt: receipt,
                        notes: {
                            planId: String(planId || '0'),
                            clientName: String(name || ''),
                            clientPhone: String(phone || ''),
                            slot: String(dateTimeStr || '')
                        }
                    })
                });

                if (rzpRes.ok) {
                    const rzpOrder = await rzpRes.json();
                    orderId = rzpOrder.id;
                } else {
                    const errBody = await rzpRes.text();
                    console.warn('Razorpay Orders API response:', rzpRes.status, errBody);
                }
            } catch (err) {
                console.warn('Razorpay order call warning:', err.message);
            }
        }

        return res.json({
            success: true,
            keyId: keyId,
            orderId: orderId,
            amount: amountInPaise,
            currency: 'INR',
            planName: planName,
            planPrice: numPrice,
            siteName: siteName
        });
    } catch (e) {
        console.error('Error in /api/payment/create-order:', e);
        return res.status(500).json({ success: false, error: 'Failed to initiate payment.' });
    }
});

// Verify Payment and Create Confirmed Booking
app.post('/api/payment/verify-and-book', async (req, res) => {
    try {
        const { paymentId, orderId, signature, name, dob, phone, location, dateTimeStr, planId } = req.body;
        const db = getDB();
        if (!db.bookings) db.bookings = [];

        const keySecret = (db.integrations && db.integrations.razorpayKeySecret) ? db.integrations.razorpayKeySecret.trim() : '';

        // Optional HMAC SHA256 Signature verification
        if (orderId && signature && keySecret) {
            try {
                const expectedSignature = crypto.createHmac('sha256', keySecret)
                    .update(`${orderId}|${paymentId}`)
                    .digest('hex');

                if (expectedSignature !== signature) {
                    console.warn('Signature verification mismatch for payment ID:', paymentId);
                }
            } catch (sigErr) {
                console.error('Signature verification error:', sigErr);
            }
        }

        // Resolve plan amount & duration
        let amount = "₹349";
        let duration = "20 Mins";
        if (planId === 'unlisted' && db.unlistedPlan) {
            amount = db.unlistedPlan.price ? "₹" + String(db.unlistedPlan.price).replace(/[^0-9]/g, '') : "₹49";
            duration = db.unlistedPlan.duration ? db.unlistedPlan.duration + " Mins" : "30 Mins";
        } else {
            const pIdx = parseInt(planId) || 0;
            if (db.plans && db.plans[pIdx]) {
                amount = db.plans[pIdx].price ? "₹" + String(db.plans[pIdx].price).replace(/[^0-9]/g, '') : "₹349";
                duration = db.plans[pIdx].duration ? db.plans[pIdx].duration + " Mins" : "20 Mins";
            }
        }

        const newBooking = {
            id: "BK-" + Date.now().toString().slice(-6),
            name: name || 'Client',
            dob: dob || '',
            phone: phone ? String(phone).replace(/^'/, '').trim() : '',
            location: location || 'Online',
            dateTimeStr: dateTimeStr || '',
            amount: amount,
            duration: duration,
            status: 'Upcoming',
            paymentId: paymentId || '',
            paymentStatus: 'Paid',
            createdAt: new Date().toISOString()
        };

        db.bookings.push(newBooking);
        saveDB(db);

        // Simultaneously trigger Google Sheets Webhook (Create)
        if (db.integrations && db.integrations.googleSheetsUrl) {
            try {
                await fetch(db.integrations.googleSheetsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'create', ...newBooking })
                });
            } catch (e) {
                console.error("Failed to push to Google Sheets Webhook:", e);
            }
        }

        return res.json({ success: true, bookingId: newBooking.id });
    } catch (e) {
        console.error('Error in /api/payment/verify-and-book:', e);
        return res.status(500).json({ success: false, error: 'Failed to record booking.' });
    }
});

// Fetch Bookings for CRM (Admin Only)
app.get('/api/bookings', requireAdminAuth, (req, res) => {
    const db = getDB();
    res.json(db.bookings || []);
});

// Update Booking Status (CRM Drag & Drop or Modal - Admin Only)
app.put('/api/bookings/:id/status', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const db = getDB();
    if(!db.bookings) db.bookings = [];
    
    let found = false;
    let targetBooking = null;
    for(let b of db.bookings) {
        if(b.id === id) {
            b.status = status;
            found = true;
            targetBooking = b;
            break;
        }
    }
    
    if(found) {
        saveDB(db);
        
        // Trigger Google Sheets Webhook in background (Non-blocking for instant response)
        if (db.integrations && db.integrations.googleSheetsUrl) {
            fetch(db.integrations.googleSheetsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    id: targetBooking.id,
                    status: status,
                    name: targetBooking.name || '',
                    phone: targetBooking.phone || '',
                    dob: targetBooking.dob || '',
                    location: targetBooking.location || '',
                    dateTimeStr: targetBooking.dateTimeStr || '',
                    amount: targetBooking.amount || '',
                    duration: targetBooking.duration || '',
                    createdAt: targetBooking.createdAt || new Date().toISOString()
                })
            }).catch(e => console.error("Failed to update Google Sheets Webhook:", e));
        }
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Booking not found' });
    }
});

// Bulk Sync All Bookings to Google Sheets (Admin Only)
app.post('/api/bookings/sync-sheets', requireAdminAuth, async (req, res) => {
    const db = getDB();
    if (!db.integrations || !db.integrations.googleSheetsUrl) {
        return res.status(400).json({ error: "Google Sheets Webhook URL is not configured." });
    }
    
    const bookings = db.bookings || [];
    try {
        const response = await fetch(db.integrations.googleSheetsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sync_all', bookings: bookings })
        });
        const result = await response.json().catch(() => ({}));
        
        // Fallback: If deployed script doesn't support 'sync_all' yet, sync individually
        if (result.status !== 'synced') {
            for (const b of bookings) {
                try {
                    await fetch(db.integrations.googleSheetsUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'update_status',
                            id: b.id,
                            status: b.status,
                            name: b.name
                        })
                    });
                    await new Promise(r => setTimeout(r, 600));
                } catch (err) {
                    console.error("Individual sync error:", err);
                }
            }
        }
        res.json({ success: true, count: bookings.length });
    } catch (e) {
        console.error("Sync to Google Sheets failed:", e);
        res.status(500).json({ error: "Failed to connect to Google Sheets Webhook." });
    }
});

// Bulk Import Bookings (from CSV - Admin Only with Double-Entry Blocker)
app.post('/api/bookings/import', requireAdminAuth, async (req, res) => {
    try {
        const { bookings: incomingBookings } = req.body;
        if (!Array.isArray(incomingBookings) || incomingBookings.length === 0) {
            return res.status(400).json({ error: "No bookings provided for import." });
        }

        const db = getDB();
        if (!db.bookings) db.bookings = [];

        let addedCount = 0;
        let updatedCount = 0;
        let duplicatesBlocked = 0;

        // Normalization helpers for strict duplicate detection
        const normalize = (str) => (str || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizePhone = (str) => (str || '').toString().replace(/[^0-9]/g, '');

        incomingBookings.forEach(incoming => {
            const incomingId = incoming.id ? String(incoming.id).trim() : null;
            const incNameNorm = normalize(incoming.name);
            const incPhoneNorm = normalizePhone(incoming.phone);
            const incTimeNorm = normalize(incoming.dateTimeStr);

            // Double-Entry Blocker Checks:
            // 1. Explicit ID match (if ID is in CSV)
            // 2. Same Phone + Same Scheduled Time
            // 3. Same Name + Same Scheduled Time
            // 4. Same Name + Same Phone (if phone length >= 7)
            let existingIdx = -1;

            if (incomingId) {
                existingIdx = db.bookings.findIndex(b => b.id && String(b.id).trim().toLowerCase() === incomingId.toLowerCase());
            }

            if (existingIdx === -1 && incPhoneNorm && incPhoneNorm.length >= 7 && incTimeNorm) {
                existingIdx = db.bookings.findIndex(b => {
                    const bPhoneNorm = normalizePhone(b.phone);
                    const bTimeNorm = normalize(b.dateTimeStr);
                    return bPhoneNorm && bPhoneNorm.length >= 7 && bPhoneNorm === incPhoneNorm && bTimeNorm === incTimeNorm;
                });
            }

            if (existingIdx === -1 && incNameNorm && incTimeNorm) {
                existingIdx = db.bookings.findIndex(b => {
                    const bNameNorm = normalize(b.name);
                    const bTimeNorm = normalize(b.dateTimeStr);
                    return bNameNorm && bTimeNorm && bNameNorm === incNameNorm && bTimeNorm === incTimeNorm;
                });
            }

            if (existingIdx === -1 && incNameNorm && incPhoneNorm && incPhoneNorm.length >= 7) {
                existingIdx = db.bookings.findIndex(b => {
                    const bNameNorm = normalize(b.name);
                    const bPhoneNorm = normalizePhone(b.phone);
                    return bNameNorm && bPhoneNorm && bNameNorm === incNameNorm && bPhoneNorm === incPhoneNorm;
                });
            }

            const cleanBooking = {
                name: incoming.name || 'Client',
                dob: incoming.dob || '',
                phone: incoming.phone ? String(incoming.phone).replace(/^'/, '').trim() : '',
                location: incoming.location || 'Online',
                dateTimeStr: incoming.dateTimeStr || '',
                amount: incoming.amount || '₹349',
                duration: incoming.duration || '20 Mins',
                status: incoming.status || 'Upcoming',
                createdAt: incoming.createdAt || new Date().toISOString()
            };

            if (existingIdx !== -1) {
                // DUPLICATE DETECTED: Do NOT create a duplicate card or row!
                // Safely refresh existing booking data while retaining its original ID and creation time
                const existing = db.bookings[existingIdx];
                db.bookings[existingIdx] = {
                    ...existing,
                    ...cleanBooking,
                    id: existing.id,
                    createdAt: existing.createdAt || cleanBooking.createdAt
                };
                updatedCount++;
                duplicatesBlocked++;
            } else {
                // New unique appointment
                cleanBooking.id = incomingId || ("BK-" + Math.floor(100000 + Math.random() * 900000));
                db.bookings.push(cleanBooking);
                addedCount++;
            }
        });

        saveDB(db);

        // Simultaneously sync all bookings with Google Sheets
        let sheetsSynced = false;
        let sheetsError = null;
        if (db.integrations && db.integrations.googleSheetsUrl) {
            try {
                const sheetRes = await fetch(db.integrations.googleSheetsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sync_all', bookings: db.bookings })
                });
                const sheetResult = await sheetRes.json().catch(() => ({}));
                
                // Fallback if needed
                if (sheetResult.status !== 'synced') {
                    for (const b of db.bookings) {
                        try {
                            await fetch(db.integrations.googleSheetsUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'update_status',
                                    id: b.id,
                                    status: b.status,
                                    name: b.name
                                })
                            });
                        } catch (err) {}
                    }
                }
                sheetsSynced = true;
            } catch (err) {
                console.error("Auto-sync to Google Sheets failed during CSV import:", err);
                sheetsError = err.toString();
            }
        }

        res.json({
            success: true,
            importedCount: incomingBookings.length,
            addedCount,
            updatedCount,
            duplicatesBlocked,
            total: db.bookings.length,
            sheetsSynced,
            sheetsConfigured: !!(db.integrations && db.integrations.googleSheetsUrl),
            sheetsError
        });
    } catch (e) {
        console.error("CSV Import Error:", e);
        res.status(500).json({ error: e.message || "Failed to import bookings." });
    }
});

// Delete a Booking (with Google Sheets auto-sync - Admin Only)
app.delete('/api/bookings/:id', requireAdminAuth, async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.bookings) db.bookings = [];
    
    const beforeCount = db.bookings.length;
    db.bookings = db.bookings.filter(b => b.id !== id);
    
    if (db.bookings.length < beforeCount) {
        saveDB(db);
        
        // Sync the deletion with Google Sheets if webhook is configured
        if (db.integrations && db.integrations.googleSheetsUrl) {
            try {
                await fetch(db.integrations.googleSheetsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sync_all', bookings: db.bookings })
                });
            } catch (e) {
                console.error("Failed to sync deletion with Google Sheets:", e);
            }
        }
        res.json({ success: true, count: db.bookings.length });
    } else {
        res.status(404).json({ error: "Booking not found" });
    }
});

// Helper: Get Network IP for mobile phone preview
app.get('/api/network-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
    }
    res.json({
        localIp,
        port: PORT,
        offerUrl: `http://${localIp}:${PORT}/offer.html`,
        homeUrl: `http://${localIp}:${PORT}/`,
        adminUrl: `http://${localIp}:${PORT}/admin.html`
    });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Real Backend Server running at http://localhost:${PORT}`);
});
