function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 0. Immediate 0ms Hydration from Preloaded Config or Cache ---
    try {
        const initialConfig = window.__PRELOADED_CONFIG__ || JSON.parse(localStorage.getItem('trikaldarshi_config') || 'null');
        if (initialConfig && typeof populateConfigData === 'function') {
            populateConfigData(initialConfig);
        }
    } catch(e) {}

    // --- 0. Admin Authentication Guard ---
    try {
        const authRes = await fetch('/api/auth/check');
        const authData = await authRes.json();
        if (!authData.authenticated) {
            window.location.replace('login.html');
            return;
        }
        const dashEl = document.querySelector('.dashboard');
        if (dashEl) dashEl.style.visibility = 'visible';
    } catch (err) {
        console.error("Auth check error:", err);
        const dashEl = document.querySelector('.dashboard');
        if (dashEl) dashEl.style.visibility = 'visible';
    }

    // --- 0.1 Admin Logout Handler ---
    window.logoutAdmin = async function(e) {
        if (e) e.preventDefault();
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error("Logout error:", err);
        }
        localStorage.removeItem('admin_token');
        window.location.replace('login.html');
    };

    // --- 1. Tab Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const panels = document.querySelectorAll('.panel');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            panels.forEach(panel => panel.classList.remove('active'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'panel-blocked' && typeof renderCalendar === 'function') {
                renderCalendar();
            }
        });
    });

    // --- 1.5. Sidebar Slide / Toggle Logic ---
    const dashboard = document.querySelector('.dashboard');
    const toggleBtnFloating = document.getElementById('sidebar-floating-toggle');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');

    function toggleSidebar() {
        if (!dashboard) return;
        const isCollapsed = dashboard.classList.toggle('sidebar-collapsed');
        
        if (toggleIcon) {
            if (isCollapsed) {
                toggleIcon.className = 'fa-solid fa-chevron-right';
                if (toggleBtnFloating) toggleBtnFloating.title = 'Open Left Panel';
            } else {
                toggleIcon.className = 'fa-solid fa-chevron-left';
                if (toggleBtnFloating) toggleBtnFloating.title = 'Slide Left Panel Away';
            }
        }
        localStorage.setItem('adminSidebarCollapsed', isCollapsed ? 'true' : 'false');
    }

    if (toggleBtnFloating) toggleBtnFloating.addEventListener('click', toggleSidebar);

    // Restore state from localStorage if user previously collapsed it
    if (localStorage.getItem('adminSidebarCollapsed') === 'true') {
        if (dashboard) dashboard.classList.add('sidebar-collapsed');
        if (toggleIcon) toggleIcon.className = 'fa-solid fa-chevron-right';
        if (toggleBtnFloating) toggleBtnFloating.title = 'Open Left Panel';
    }

    // --- 2. Availability Toggles Logic ---
    const toggleSwitches = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
    toggleSwitches.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const timeInputs = e.target.closest('.day-row').querySelector('.time-inputs');
            const inputs = timeInputs.querySelectorAll('input');
            
            if (e.target.checked) {
                timeInputs.classList.remove('disabled');
                inputs.forEach(input => input.disabled = false);
            } else {
                timeInputs.classList.add('disabled');
                inputs.forEach(input => input.disabled = true);
            }
        });
    });

    // --- 3. Profile Image Upload Preview (Auto-compressed for fast loading & Google Sheets compatibility) ---
    const imageUploadInput = document.getElementById('profile-image-upload');
    const profilePreview = document.getElementById('profile-preview');
    if (imageUploadInput && profilePreview) {
        imageUploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const img = new Image();
                img.onload = function() {
                    const maxDim = 320;
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    let compressed = canvas.toDataURL('image/webp', 0.8);
                    if (!compressed.startsWith('data:image/webp') || compressed.length > 45000) {
                        compressed = canvas.toDataURL('image/jpeg', 0.78);
                    }
                    profilePreview.src = compressed;
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // --- 4. REAL BACKEND INTEGRATION & INSTANT HYDRATION ---
    
    function populateConfigData(data) {
        if (!data) return;
        try {
            // Populate Settings
            if (data.settings) {
                const coolSetting = document.getElementById('setting-cooling');
                if (coolSetting) coolSetting.value = data.settings.cooling !== undefined ? data.settings.cooling : 15;
                const dailyMaxSetting = document.getElementById('setting-daily-max');
                if (dailyMaxSetting) dailyMaxSetting.value = data.settings.dailyMaxSessions > 0 ? data.settings.dailyMaxSessions : '';
            }

            // Populate Content & All CMS Fields
            if (data.content) {
                const c = data.content;
                
                // 1. Brand & Identity
                if (c.siteName && document.getElementById('content-site-name')) document.getElementById('content-site-name').value = c.siteName;
                if (c.readerName && document.getElementById('content-reader-name')) document.getElementById('content-reader-name').value = c.readerName;
                if (c.siteName && document.getElementById('sidebar-site-name')) document.getElementById('sidebar-site-name').innerText = c.siteName + " CMS";
                if (c.readerName && document.getElementById('sidebar-reader-name')) document.getElementById('sidebar-reader-name').innerText = c.readerName;
                
                // Theme & Profile
                if (c.themeColor && document.getElementById('admin-theme-color')) {
                    document.getElementById('admin-theme-color').value = c.themeColor;
                    document.documentElement.style.setProperty('--bg-color', c.themeColor);
                }
                if (c.profilePic && document.getElementById('profile-preview')) {
                    let pic = c.profilePic;
                    if (pic.includes('localhost') || pic.includes('127.0.0.1')) {
                        pic = pic.replace(/^https?:\/\/[^\/]+\/?/, '');
                        if (!pic) pic = 'profile.jpg';
                    }
                    document.getElementById('profile-preview').src = pic;
                }

                // 2. Hero Section
                if (c.headerText && document.getElementById('header-text')) document.getElementById('header-text').value = c.headerText;
                if (c.bioText && document.getElementById('bio-text')) document.getElementById('bio-text').value = c.bioText;
                if (c.heroCtaText && document.getElementById('content-hero-cta')) document.getElementById('content-hero-cta').value = c.heroCtaText;
                if (c.socialProofText && document.getElementById('content-social-proof')) document.getElementById('content-social-proof').value = c.socialProofText;

                // 3. Plans Section Copy
                if (c.plansHeading && document.getElementById('content-plans-heading')) document.getElementById('content-plans-heading').value = c.plansHeading;
                if (c.plansSubheading && document.getElementById('content-plans-subheading')) document.getElementById('content-plans-subheading').value = c.plansSubheading;

                // 4. Booking Screen Copy
                if (c.bookingHeadline && document.getElementById('content-booking-headline')) document.getElementById('content-booking-headline').value = c.bookingHeadline;
                if (c.bookingSubtitle && document.getElementById('content-booking-subtitle')) document.getElementById('content-booking-subtitle').value = c.bookingSubtitle;
                if (c.bookingTrustBanner && document.getElementById('content-booking-trust')) document.getElementById('content-booking-trust').value = c.bookingTrustBanner;

                // 5. Testimonials
                if (c.testimonialsTitle && document.getElementById('content-testimonials-title')) document.getElementById('content-testimonials-title').value = c.testimonialsTitle;
                if (c.reviews && c.reviews.length >= 3) {
                    if (document.getElementById('content-review1-quote')) document.getElementById('content-review1-quote').value = c.reviews[0].quote;
                    if (document.getElementById('content-review1-author')) document.getElementById('content-review1-author').value = c.reviews[0].author;
                    if (document.getElementById('content-review2-quote')) document.getElementById('content-review2-quote').value = c.reviews[1].quote;
                    if (document.getElementById('content-review2-author')) document.getElementById('content-review2-author').value = c.reviews[1].author;
                    if (document.getElementById('content-review3-quote')) document.getElementById('content-review3-quote').value = c.reviews[2].quote;
                    if (document.getElementById('content-review3-author')) document.getElementById('content-review3-author').value = c.reviews[2].author;
                }

                // 6. Footer & Legal
                if (c.footerCopyright && document.getElementById('content-footer-copyright')) document.getElementById('content-footer-copyright').value = c.footerCopyright;
            }
            
            // Populate Availability
            if (data.availability) {
                const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                days.forEach(day => {
                    const config = data.availability[day];
                    if (config) {
                        const checkbox = document.querySelector(`input[name="day_${day}"]`);
                        const startInput = document.querySelector(`input[name="${day}_start"]`);
                        const endInput = document.querySelector(`input[name="${day}_end"]`);
                        
                        if (checkbox && startInput && endInput) {
                            checkbox.checked = config.active;
                            startInput.value = config.start;
                            endInput.value = config.end;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    }
                });
            }

            // Populate Plans
            if (data.plans) {
                const planCards = document.querySelectorAll('.plan-edit-card');
                data.plans.forEach((plan, index) => {
                    if (planCards[index]) {
                        const nameInput = planCards[index].querySelector('input[name="plan_name"]');
                        const priceInput = planCards[index].querySelector('input[name="plan_price"]');
                        const descInput = planCards[index].querySelector('input[name="plan_desc"]');
                        const durationInput = planCards[index].querySelector('input[name="plan_duration"]');
                        const featuresInput = planCards[index].querySelector('textarea[name="plan_features"]');
                        
                        if (nameInput) nameInput.value = plan.name || '';
                        if (priceInput) priceInput.value = plan.price || '';
                        if (descInput) descInput.value = plan.desc || '';
                        if (durationInput) durationInput.value = plan.duration || "30";
                        if (featuresInput && plan.features) {
                            featuresInput.value = Array.isArray(plan.features) ? plan.features.join('\n') : plan.features;
                        }
                    }
                });
            }

            // Populate Unlisted Plan
            if (data.unlistedPlan) {
                const u = data.unlistedPlan;
                const nameEl = document.getElementById('unlisted-plan-name');
                const badgeEl = document.getElementById('unlisted-plan-badge');
                const descEl = document.getElementById('unlisted-plan-desc');
                const priceEl = document.getElementById('unlisted-plan-price');
                const origPriceEl = document.getElementById('unlisted-plan-orig-price');
                const durationEl = document.getElementById('unlisted-plan-duration');
                const featuresEl = document.getElementById('unlisted-plan-features');
                const timerMinEl = document.getElementById('unlisted-timer-minutes');
                const timerBadgeEl = document.getElementById('unlisted-timer-badge');
                const b1El = document.getElementById('unlisted-bullet-1');
                const b2El = document.getElementById('unlisted-bullet-2');
                const b3El = document.getElementById('unlisted-bullet-3');
                const ctaEl = document.getElementById('unlisted-cta-text');

                if (nameEl && u.name) nameEl.value = u.name;
                if (badgeEl && u.badge) badgeEl.value = u.badge;
                if (descEl && u.desc) descEl.value = u.desc;
                if (priceEl && u.price) priceEl.value = u.price;
                if (origPriceEl && u.originalPrice) origPriceEl.value = u.originalPrice;
                if (durationEl && u.duration) durationEl.value = u.duration;
                if (featuresEl && u.features) featuresEl.value = Array.isArray(u.features) ? u.features.join('\n') : u.features;
                if (timerMinEl && u.timerMinutes) timerMinEl.value = u.timerMinutes;
                if (timerBadgeEl && u.timerBadge) timerBadgeEl.value = u.timerBadge;
                if (b1El && u.bullet1) b1El.value = u.bullet1;
                if (b2El && u.bullet2) b2El.value = u.bullet2;
                if (b3El && u.bullet3) b3El.value = u.bullet3;
                if (ctaEl && u.ctaText) ctaEl.value = u.ctaText;
            }

            // Populate Blocked Dates
            if (data.blockedDates) {
                window.globalBlockedDates = data.blockedDates;
                if (typeof renderBlockedDates === 'function') renderBlockedDates();
            }

            // Populate Integrations
            if (data.integrations) {
                if (data.integrations.googleSheetsUrl) {
                    const webhookInput = document.getElementById('google-webhook-url');
                    if (webhookInput) webhookInput.value = data.integrations.googleSheetsUrl;
                }

                window._savedRzpKeyId = data.integrations.razorpayKeyId || '';
                window._savedRzpKeySecret = data.integrations.razorpayKeySecret || '';

                const rzpKeyIdInput = document.getElementById('razorpay-key-id');
                const rzpSecretInput = document.getElementById('razorpay-key-secret');
                if (rzpKeyIdInput) rzpKeyIdInput.value = window._savedRzpKeyId;
                if (rzpSecretInput) rzpSecretInput.value = window._savedRzpKeySecret;

                if (typeof updateRzpBadge === 'function') {
                    updateRzpBadge(window._savedRzpKeyId, window._savedRzpKeySecret);
                }

                // Guard against browser password managers mistakenly autofilling admin credentials
                [100, 300, 800, 1500].forEach(delay => {
                    setTimeout(() => {
                        if (rzpKeyIdInput && rzpKeyIdInput.value === 'admin' && window._savedRzpKeyId !== 'admin') {
                            rzpKeyIdInput.value = window._savedRzpKeyId || '';
                        }
                    }, delay);
                });

                const customCode = data.integrations.customAppScriptCode || localStorage.getItem('customGoogleAppsScriptCode');
                if (customCode) {
                    window.GOOGLE_APPS_SCRIPT_CODE = customCode;
                    const codeEl = document.getElementById('appscript-code-content');
                    if (codeEl) codeEl.textContent = customCode;
                    const editorEl = document.getElementById('appscript-code-editor');
                    if (editorEl) editorEl.value = customCode;
                }
            }
        } catch (err) {
            console.error("Error populating config data:", err);
        }
    }

    // Load existing data on boot
    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                try {
                    localStorage.setItem('trikaldarshi_config', JSON.stringify(data));
                } catch(e) {}
                populateConfigData(data);
            }
        } catch (e) {
            console.error("Could not load backend configuration", e);
        }
    }
    
    // =========================================================
    // INTERACTIVE CALENDAR VIEW CONTROLLER (Block Dates)
    // =========================================================
    let calCurrentYear = new Date().getFullYear();
    let calCurrentMonth = new Date().getMonth(); // 0-indexed
    let calRangeStart = null; // 'YYYY-MM-DD'
    let calRangeEnd = null;   // 'YYYY-MM-DD'
    let calHoverDate = null;  // 'YYYY-MM-DD'

    function formatYMD(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseYMD(str) {
        if (!str) return new Date();
        const parts = str.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function formatPrettyDate(str) {
        if (!str) return '';
        const d = parseYMD(str);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const year = d.getFullYear();
        return `${dayName}, ${dayNum} ${month} ${year}`;
    }

    function getDaysBetween(startStr, endStr) {
        if (!startStr || !endStr) return 1;
        const d1 = parseYMD(startStr);
        const d2 = parseYMD(endStr);
        const diffTime = Math.abs(d2.getTime() - d1.getTime());
        return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    function isDateBlocked(ymdStr) {
        if (!window.globalBlockedDates || window.globalBlockedDates.length === 0) return false;
        return window.globalBlockedDates.some(b => ymdStr >= b.start && ymdStr <= b.end);
    }

    function renderCalendar() {
        const grid = document.getElementById('cal-days-grid');
        const title = document.getElementById('cal-month-year-title');
        if (!grid || !title) return;

        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        title.textContent = `${monthNames[calCurrentMonth]} ${calCurrentYear}`;
        grid.innerHTML = '';

        const firstDayIndex = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
        const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
        const prevMonthDays = new Date(calCurrentYear, calCurrentMonth, 0).getDate();
        const todayYMD = formatYMD(new Date());

        // 1. Previous month trailing days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dNum = prevMonthDays - i;
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            cell.innerHTML = `<span>${dNum}</span>`;
            grid.appendChild(cell);
        }

        // 2. Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            const ymd = `${calCurrentYear}-${String(calCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            cell.className = 'cal-day-cell';
            cell.dataset.date = ymd;

            if (ymd === todayYMD) {
                cell.classList.add('is-today');
            }

            const isBlocked = isDateBlocked(ymd);
            if (isBlocked) {
                cell.classList.add('day-blocked');
                cell.title = "Currently Blocked Date";
            }

            // Calculate range state
            let effectiveStart = calRangeStart;
            let effectiveEnd = calRangeEnd;
            if (!effectiveEnd && calRangeStart && calHoverDate) {
                effectiveEnd = calHoverDate;
            }

            let s = effectiveStart;
            let e = effectiveEnd;
            if (s && e && s > e) {
                const tmp = s; s = e; e = tmp;
            }

            if (calRangeStart && ymd === calRangeStart) {
                cell.classList.add('range-start');
                cell.innerHTML = `<span>${d}</span><span class="day-sub">IN</span>`;
            } else if (calRangeEnd && ymd === calRangeEnd) {
                cell.classList.add('range-end');
                cell.innerHTML = `<span>${d}</span><span class="day-sub">OUT</span>`;
            } else if (s && e && ymd >= s && ymd <= e) {
                if (calRangeEnd) {
                    cell.classList.add('in-range');
                } else {
                    cell.classList.add('hover-in-range');
                }
                cell.innerHTML = `<span>${d}</span>`;
            } else {
                cell.innerHTML = `<span>${d}</span>`;
            }

            // Click handling (In & Out selection)
            cell.addEventListener('click', () => handleDateClick(ymd));

            // Hover preview
            cell.addEventListener('mouseenter', () => {
                if (calRangeStart && !calRangeEnd && calHoverDate !== ymd) {
                    calHoverDate = ymd;
                    renderCalendar();
                }
            });

            grid.appendChild(cell);
        }

        // 3. Next month leading days
        const totalRendered = firstDayIndex + daysInMonth;
        const nextDaysNeeded = (7 - (totalRendered % 7)) % 7;
        for (let n = 1; n <= nextDaysNeeded; n++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            cell.innerHTML = `<span>${n}</span>`;
            grid.appendChild(cell);
        }

        updateSelectionUI();
    }

    function handleDateClick(ymd) {
        if (!calRangeStart || (calRangeStart && calRangeEnd)) {
            // First click: In date
            calRangeStart = ymd;
            calRangeEnd = null;
            calHoverDate = null;
        } else {
            // Second click: Out date
            if (ymd < calRangeStart) {
                calRangeEnd = calRangeStart;
                calRangeStart = ymd;
            } else {
                calRangeEnd = ymd;
            }
            calHoverDate = null;
        }

        // Keep manual fallback inputs in sync
        const startInput = document.getElementById('block-start');
        const endInput = document.getElementById('block-end');
        if (startInput) startInput.value = calRangeStart || '';
        if (endInput) endInput.value = calRangeEnd || calRangeStart || '';

        renderCalendar();
    }

    function updateSelectionUI() {
        const labelEl = document.getElementById('cal-sel-label');
        const datesEl = document.getElementById('cal-sel-dates');
        const clearBtn = document.getElementById('cal-clear-btn');
        const blockBtn = document.getElementById('cal-block-btn');

        if (!labelEl || !datesEl || !blockBtn) return;

        if (!calRangeStart) {
            labelEl.innerText = "Click a start date (In) and end date (Out) on the calendar";
            datesEl.innerText = "No dates selected";
            if (clearBtn) clearBtn.style.display = 'none';
            blockBtn.disabled = true;
            blockBtn.style.opacity = '0.5';
            blockBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Block Dates';
        } else if (calRangeStart && !calRangeEnd) {
            labelEl.innerText = "In Date Selected — Click an Out Date on calendar (or Block 1 day):";
            datesEl.innerHTML = `<span style="color: var(--accent-color);">${formatPrettyDate(calRangeStart)}</span> <span style="font-size:0.85rem; color:var(--text-muted);">(1 day)</span>`;
            if (clearBtn) clearBtn.style.display = 'inline-block';
            blockBtn.disabled = false;
            blockBtn.style.opacity = '1';
            blockBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Block 1 Day';
        } else {
            const daysCount = getDaysBetween(calRangeStart, calRangeEnd);
            labelEl.innerText = "Selected In & Out Range:";
            datesEl.innerHTML = `<span style="color: var(--accent-color);">${formatPrettyDate(calRangeStart)}</span> <span style="color:var(--text-muted); margin:0 8px;">→</span> <span style="color: var(--accent-color);">${formatPrettyDate(calRangeEnd)}</span> <span style="font-size:0.85rem; color:#fbbf24; font-weight:700; margin-left:6px;">(${daysCount} ${daysCount === 1 ? 'Day' : 'Days'})</span>`;
            if (clearBtn) clearBtn.style.display = 'inline-block';
            blockBtn.disabled = false;
            blockBtn.style.opacity = '1';
            blockBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Block ${daysCount} Days`;
        }
    }

    async function blockSelectedRange() {
        if (!calRangeStart) return;
        const start = calRangeStart;
        const end = calRangeEnd || calRangeStart;

        if (!window.globalBlockedDates) window.globalBlockedDates = [];
        window.globalBlockedDates.push({ start, end });

        const blockBtn = document.getElementById('cal-block-btn');
        if (blockBtn) {
            blockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Blocking...';
            blockBtn.disabled = true;
        }

        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blockedDates: window.globalBlockedDates })
            });
            if (res.ok) {
                calRangeStart = null;
                calRangeEnd = null;
                calHoverDate = null;
                renderCalendar();
                renderBlockedDates();
                if (blockBtn) {
                    blockBtn.innerHTML = '<i class="fa-solid fa-check"></i> Blocked Successfully!';
                    blockBtn.style.background = '#10b981';
                    setTimeout(() => {
                        blockBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Block Dates';
                        blockBtn.style.background = '';
                        updateSelectionUI();
                    }, 1600);
                }
            } else {
                alert("Failed to save blocked dates.");
                updateSelectionUI();
            }
        } catch (e) {
            console.error("Error saving blocked dates:", e);
            alert("Failed to save blocked dates. Ensure backend is running.");
            updateSelectionUI();
        }
    }

    function initCalendarControls() {
        const prevBtn = document.getElementById('cal-prev-month');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                calCurrentMonth--;
                if (calCurrentMonth < 0) {
                    calCurrentMonth = 11;
                    calCurrentYear--;
                }
                renderCalendar();
            });
        }

        const nextBtn = document.getElementById('cal-next-month');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                calCurrentMonth++;
                if (calCurrentMonth > 11) {
                    calCurrentMonth = 0;
                    calCurrentYear++;
                }
                renderCalendar();
            });
        }

        const todayBtn = document.getElementById('cal-today-btn');
        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                const now = new Date();
                calCurrentYear = now.getFullYear();
                calCurrentMonth = now.getMonth();
                renderCalendar();
            });
        }

        const clearBtn = document.getElementById('cal-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                calRangeStart = null;
                calRangeEnd = null;
                calHoverDate = null;
                const startInput = document.getElementById('block-start');
                const endInput = document.getElementById('block-end');
                if (startInput) startInput.value = '';
                if (endInput) endInput.value = '';
                renderCalendar();
            });
        }

        const blockBtn = document.getElementById('cal-block-btn');
        if (blockBtn) {
            blockBtn.addEventListener('click', blockSelectedRange);
        }

        const grid = document.getElementById('cal-days-grid');
        if (grid) {
            grid.addEventListener('mouseleave', () => {
                if (calRangeStart && !calRangeEnd && calHoverDate) {
                    calHoverDate = null;
                    renderCalendar();
                }
            });
        }

        // Quick Preset Chips
        document.querySelectorAll('.cal-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const preset = chip.getAttribute('data-preset');
                const now = new Date();
                
                if (preset === 'today') {
                    calRangeStart = formatYMD(now);
                    calRangeEnd = formatYMD(now);
                } else if (preset === 'tomorrow') {
                    const tm = new Date(now);
                    tm.setDate(now.getDate() + 1);
                    calRangeStart = formatYMD(tm);
                    calRangeEnd = formatYMD(tm);
                } else if (preset === 'weekend') {
                    const day = now.getDay();
                    const sat = new Date(now);
                    const sun = new Date(now);
                    if (day === 0) {
                        sat.setDate(now.getDate() - 1);
                        sun.setDate(now.getDate());
                    } else {
                        sat.setDate(now.getDate() + (6 - day));
                        sun.setDate(now.getDate() + (7 - day));
                    }
                    calRangeStart = formatYMD(sat);
                    calRangeEnd = formatYMD(sun);
                } else if (preset === 'next7') {
                    const next7 = new Date(now);
                    next7.setDate(now.getDate() + 6);
                    calRangeStart = formatYMD(now);
                    calRangeEnd = formatYMD(next7);
                }

                if (calRangeStart) {
                    const sObj = parseYMD(calRangeStart);
                    calCurrentYear = sObj.getFullYear();
                    calCurrentMonth = sObj.getMonth();
                }

                const startInput = document.getElementById('block-start');
                const endInput = document.getElementById('block-end');
                if (startInput) startInput.value = calRangeStart || '';
                if (endInput) endInput.value = calRangeEnd || '';

                renderCalendar();
            });
        });
    }

    function renderBlockedDates() {
        const list = document.getElementById('blocked-dates-list');
        const badge = document.getElementById('blocked-count-badge');
        if (!list) return;
        
        const count = window.globalBlockedDates ? window.globalBlockedDates.length : 0;
        if (badge) {
            badge.innerText = `${count} ${count === 1 ? 'Range Blocked' : 'Ranges Blocked'}`;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        
        if (!window.globalBlockedDates || window.globalBlockedDates.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 10px 0;">No blocked dates currently set. Select dates on the calendar above to block them.</p>';
            return;
        }
        
        list.innerHTML = window.globalBlockedDates.map((block, i) => {
            const days = getDaysBetween(block.start, block.end);
            const prettyStart = formatPrettyDate(block.start);
            const prettyEnd = formatPrettyDate(block.end);
            
            return `
            <div class="blocked-item-card">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:36px; height:36px; border-radius:8px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; color:#f87171; font-size:1rem; flex-shrink:0;">
                        <i class="fa-solid fa-lock"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; font-size: 0.98rem; color: #fff;">
                            ${prettyStart} ${block.start !== block.end ? `<span style="color:var(--text-muted); margin:0 8px;">→</span> ${prettyEnd}` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: #f87171; font-weight: 500; margin-top: 2px;">
                            ${days} ${days === 1 ? 'Day Unavailable' : 'Days Unavailable'} (${block.start} to ${block.end})
                        </div>
                    </div>
                </div>
                <button onclick="removeBlockedDate(${i})" title="Unblock these dates" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; cursor: pointer; padding: 8px 14px; border-radius: 8px; font-size: 0.88rem; transition: all 0.2s ease; display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <i class="fa-solid fa-trash-can"></i> <span>Unblock</span>
                </button>
            </div>
            `;
        }).join('');
    }

    window.removeBlockedDate = async function(index) {
        window.globalBlockedDates.splice(index, 1);
        renderBlockedDates();
        renderCalendar();
        
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blockedDates: window.globalBlockedDates })
            });
        } catch (e) {
            console.error("Failed to delete blocked date", e);
        }
    };

    initCalendarControls();
    await loadConfig();
    renderCalendar();

    // Helper to send POST data (supports single element or array of elements for simultaneous feedback)
    async function saveToServer(payload, btnElement, defaultText) {
        const btnList = Array.isArray(btnElement) ? btnElement.filter(Boolean) : [btnElement].filter(Boolean);
        btnList.forEach(b => {
            b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            b.disabled = true;
        });
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                btnList.forEach(b => {
                    b.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saved Successfully!';
                    b.style.background = '#10b981';
                    b.disabled = false;
                });
                setTimeout(() => {
                    btnList.forEach(b => {
                        b.innerHTML = defaultText;
                        b.style.background = '';
                    });
                }, 2000);
            } else {
                const errText = await res.text();
                console.error("Server error:", errText);
                alert("Failed to save: " + errText);
                btnList.forEach(b => {
                    b.innerHTML = defaultText;
                    b.disabled = false;
                });
            }
        } catch (error) {
            console.error("Error saving:", error);
            alert("Failed to save. Ensure backend is running.");
            btnList.forEach(b => {
                b.innerHTML = defaultText;
                b.disabled = false;
            });
        }
    }

    // Save Availability
    const formAvailability = document.getElementById('form-availability');
    if(formAvailability) {
        formAvailability.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = { settings: {}, availability: {} };
            
            payload.settings.cooling = parseInt(document.getElementById('setting-cooling').value) || 0;
            const dailyMaxEl = document.getElementById('setting-daily-max');
            payload.settings.dailyMaxSessions = dailyMaxEl ? (parseInt(dailyMaxEl.value) || 0) : 0;
            
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            days.forEach(day => {
                payload.availability[day] = {
                    active: document.querySelector(`input[name="day_${day}"]`).checked,
                    start: document.querySelector(`input[name="${day}_start"]`).value,
                    end: document.querySelector(`input[name="${day}_end"]`).value
                };
            });
            
            saveToServer(payload, e.target.querySelector('button[type="submit"]'), 'Save Availability');
        });
    }

    // Save Blocked Dates
    const formBlockedDates = document.getElementById('form-blocked-dates');
    if (formBlockedDates) {
        formBlockedDates.addEventListener('submit', (e) => {
            e.preventDefault();
            const start = document.getElementById('block-start').value;
            const end = document.getElementById('block-end').value;
            
            if (start > end) {
                alert("Start date cannot be after end date.");
                return;
            }
            
            if (!window.globalBlockedDates) window.globalBlockedDates = [];
            window.globalBlockedDates.push({ start, end });
            renderBlockedDates();
            renderCalendar();
            
            saveToServer({ blockedDates: window.globalBlockedDates }, e.target.querySelector('button[type="submit"]'), 'Block Dates');
            e.target.reset();
        });
    }

    // Save Profile & Bio Content
    const themeColorPicker = document.getElementById('admin-theme-color');
    if (themeColorPicker) {
        themeColorPicker.addEventListener('input', (e) => {
            document.documentElement.style.setProperty('--bg-color', e.target.value);
        });
    }

    const formContent = document.getElementById('form-content');
    if(formContent) {
        formContent.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {
                content: {
                    siteName: document.getElementById('content-site-name')?.value.trim() || "TrikalDarshi Tarot",
                    readerName: document.getElementById('content-reader-name')?.value.trim() || "Coach Sanjay",
                    themeColor: document.getElementById('admin-theme-color')?.value || "#0b0914",
                    profilePic: (() => {
                        const previewEl = document.getElementById('profile-preview');
                        let pSrc = previewEl ? (previewEl.getAttribute('src') || previewEl.src) : "profile.jpg";
                        if (pSrc.includes('localhost') || pSrc.includes('127.0.0.1')) {
                            pSrc = pSrc.replace(/^https?:\/\/[^\/]+\/?/, '');
                            if (!pSrc) pSrc = 'profile.jpg';
                        }
                        return pSrc;
                    })(),
                    headerText: document.getElementById('header-text')?.value.trim() || "Clarity on Love, Career & Future.",
                    bioText: document.getElementById('bio-text')?.value.trim() || "Namaste! I'm Coach Sanjay. Through intuitive Tarot reading and genuine counseling, I help you find clear answers, overcome confusion, and choose the right path in life.",
                    heroCtaText: document.getElementById('content-hero-cta')?.value.trim() || "Book Now",
                    socialProofText: document.getElementById('content-social-proof')?.value.trim() || "⭐ Trusted by 2,000+ followers & clients",
                    plansHeading: document.getElementById('content-plans-heading')?.value.trim() || "Choose Your Reading",
                    plansSubheading: document.getElementById('content-plans-subheading')?.value.trim() || "Get the clarity you need, with the right guidance for your journey.",
                    bookingHeadline: document.getElementById('content-booking-headline')?.value.trim() || "Schedule Your Reading",
                    bookingSubtitle: document.getElementById('content-booking-subtitle')?.value.trim() || "Get the clarity you need, with the right guidance for your journey.",
                    bookingTrustBanner: document.getElementById('content-booking-trust')?.value.trim() || "REAL GUIDANCE ✦ DEEPER INSIGHTS ✦ YOUR JOURNEY",
                    testimonialsTitle: document.getElementById('content-testimonials-title')?.value.trim() || "Client Testimonials",
                    reviews: [
                        {
                            quote: document.getElementById('content-review1-quote')?.value.trim() || "Sir ki reading ekdum spot on thi!! Mai apne career ko leke bhot confuse tha, samaj nai aara tha kya karu. But unhone jo bataya exactly wahi ho rha hai abhi 🙏 Highly recommend",
                            author: document.getElementById('content-review1-author')?.value.trim() || "- Rahul M."
                        },
                        {
                            quote: document.getElementById('content-review2-quote')?.value.trim() || "Mera bhot bura time chal rha tha relationship me aur main tension me thi. Sanjay sir ne jo advice di it was so true 🥺 ab kafi peace hai life me. Thanku so much sir ❤️",
                            author: document.getElementById('content-review2-author')?.value.trim() || "- Neha K."
                        },
                        {
                            quote: document.getElementById('content-review3-quote')?.value.trim() || "Pehle muje in sab pe itna trust nhi tha tbh.. par just try kiya tha aise hi nd I am mind blown 🤯 Unhone past ki aisi batein batai jo kisi ko ni pta. Best tarot reader!!",
                            author: document.getElementById('content-review3-author')?.value.trim() || "- Priya S."
                        }
                    ],
                    footerCopyright: document.getElementById('content-footer-copyright')?.value.trim() || "© 2026 Coach Sanjay. All rights reserved."
                }
            };
            
            // Instantly apply theme locally
            document.documentElement.style.setProperty('--bg-color', payload.content.themeColor);
            if (document.getElementById('sidebar-reader-name')) document.getElementById('sidebar-reader-name').innerText = payload.content.readerName;
            if (document.getElementById('sidebar-site-name')) document.getElementById('sidebar-site-name').innerText = payload.content.siteName + " CMS";
            
            const bottomBtn = document.getElementById('form-content-submit-btn');
            const topBtn = document.getElementById('top-content-save-btn');
            const btns = [bottomBtn, topBtn].filter(Boolean);
            saveToServer(payload, btns, '<i class="fa-solid fa-floppy-disk"></i> Save Content');
        });

        const topContentSaveBtn = document.getElementById('top-content-save-btn');
        if (topContentSaveBtn) {
            topContentSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const form = document.getElementById('form-content');
                if (form) {
                    if (typeof form.requestSubmit === 'function') {
                        form.requestSubmit();
                    } else {
                        form.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                }
            });
        }
    }

    // Save Pricing Plans
    const formPlans = document.getElementById('form-plans');
    if(formPlans) {
        formPlans.addEventListener('submit', (e) => {
            e.preventDefault();
            const planCards = document.querySelectorAll('.plan-edit-card');
            const plansData = Array.from(planCards).map(card => {
                return {
                    name: card.querySelector('input[name="plan_name"]').value,
                    price: card.querySelector('input[name="plan_price"]').value,
                    desc: card.querySelector('input[name="plan_desc"]').value,
                    duration: card.querySelector('input[name="plan_duration"]').value,
                    features: card.querySelector('textarea[name="plan_features"]').value
                                .split('\n').map(f => f.trim()).filter(f => f)
                };
            });
            
            // Also collect unlisted plan if configured
            const unlistedNameEl = document.getElementById('unlisted-plan-name');
            let unlistedPlanData = null;
            if (unlistedNameEl && unlistedNameEl.value.trim()) {
                unlistedPlanData = {
                    active: true,
                    name: unlistedNameEl.value.trim(),
                    badge: document.getElementById('unlisted-plan-badge')?.value || "Special Private Offer",
                    desc: document.getElementById('unlisted-plan-desc')?.value || "",
                    price: document.getElementById('unlisted-plan-price')?.value || "999",
                    originalPrice: document.getElementById('unlisted-plan-orig-price')?.value || "2999",
                    duration: document.getElementById('unlisted-plan-duration')?.value || "30",
                    features: (document.getElementById('unlisted-plan-features')?.value || "")
                                .split('\n').map(f => f.trim()).filter(f => f),
                    timerMinutes: parseInt(document.getElementById('unlisted-timer-minutes')?.value) || 2,
                    timerBadge: document.getElementById('unlisted-timer-badge')?.value || "Limited Time Offer",
                    bullet1: document.getElementById('unlisted-bullet-1')?.value || "1-on-1 Personalized Reading",
                    bullet2: document.getElementById('unlisted-bullet-2')?.value || "Confidential & Live Consultation",
                    bullet3: document.getElementById('unlisted-bullet-3')?.value || "Limited Slots Available Today",
                    ctaText: document.getElementById('unlisted-cta-text')?.value || "ENROLL NOW"
                };
            }

            const payloadToSave = { plans: plansData };
            if (unlistedPlanData) payloadToSave.unlistedPlan = unlistedPlanData;

            saveToServer(payloadToSave, e.target.querySelector('button[type="submit"]'), 'Save Pricing Plans');
        });
    }
});
// --- CRM Kanban Drag and Drop Logic ---
window.isCardDragging = false;

window.allowDrop = function(ev) {
    ev.preventDefault();
};

window.drag = function(ev) {
    window.isCardDragging = true;
    // Store the ID of the dragged element
    ev.dataTransfer.setData("text", ev.currentTarget.id);
    ev.currentTarget.classList.add('dragging');
};

window.drop = function(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const card = document.getElementById(data);
    if(card) {
        card.classList.remove('dragging');
        // Find the closest column content area
        const targetColumn = ev.target.closest('.kanban-column-content');
        if (targetColumn) {
            targetColumn.appendChild(card);
            
            // Update the column counts (optional enhancement)
            updateColumnCounts();
        }
    }
};

document.addEventListener('dragend', function(ev) {
    setTimeout(() => { window.isCardDragging = false; }, 100);
    if(ev.target && ev.target.classList && ev.target.classList.contains('kanban-card')) {
        ev.target.classList.remove('dragging');
    }
});

function updateColumnCounts() {
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(col => {
        const cards = col.querySelectorAll('.kanban-card').length;
        const countText = col.querySelector('.column-count');
        if(countText) {
            countText.innerText = cards === 1 ? '1 session' : cards + ' sessions';
        }
    });
}

// --- CRM DATE & TIME SORTING ---
window.crmSortOrder = 'asc'; // 'asc' = Earliest first, 'desc' = Latest first

function parseBookingDateTime(dateTimeStr, createdAt) {
    if (dateTimeStr) {
        // e.g. "11:50 AM, Fri, 16 Oct" -> remove "Fri, "
        const clean = dateTimeStr.replace(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*/i, '').trim();
        const year = new Date().getFullYear();
        const d = new Date(clean + ' ' + year);
        if (!isNaN(d.getTime())) return d.getTime();
        
        const direct = new Date(dateTimeStr);
        if (!isNaN(direct.getTime())) return direct.getTime();
    }
    if (createdAt) {
        const d = new Date(createdAt);
        if (!isNaN(d.getTime())) return d.getTime();
    }
    return 0;
}

window.toggleSortTime = function() {
    window.crmSortOrder = (window.crmSortOrder === 'asc') ? 'desc' : 'asc';
    
    // Update button text, icon, and active classes
    const btn = document.getElementById('btn-sort-time');
    if (btn) {
        btn.classList.toggle('active-asc', window.crmSortOrder === 'asc');
        btn.classList.toggle('active-desc', window.crmSortOrder === 'desc');
        if (window.crmSortOrder === 'asc') {
            btn.title = "Sorted: Earliest First (Click to sort Latest First)";
            btn.innerHTML = '<i class="fa-solid fa-arrow-down-up-across-line"></i> <span id="sort-time-label">Time &uarr;</span>';
        } else {
            btn.title = "Sorted: Latest First (Click to sort Earliest First)";
            btn.innerHTML = '<i class="fa-solid fa-arrow-down-up-across-line"></i> <span id="sort-time-label">Time &darr;</span>';
        }
    }
    
    // Sort in-memory bookingsData
    if (window.bookingsData && window.bookingsData.length > 0) {
        window.bookingsData.sort((a, b) => {
            const timeA = parseBookingDateTime(a.dateTimeStr, a.createdAt);
            const timeB = parseBookingDateTime(b.dateTimeStr, b.createdAt);
            return window.crmSortOrder === 'asc' ? (timeA - timeB) : (timeB - timeA);
        });
    }

    // Sort DOM cards within each column
    document.querySelectorAll('.kanban-column-content').forEach(col => {
        const cards = Array.from(col.querySelectorAll('.kanban-card'));
        if (cards.length <= 1) return;
        
        cards.sort((cardA, cardB) => {
            const bA = window.bookingsData ? window.bookingsData.find(b => b.id === cardA.id) : null;
            const bB = window.bookingsData ? window.bookingsData.find(b => b.id === cardB.id) : null;
            const timeA = bA ? parseBookingDateTime(bA.dateTimeStr, bA.createdAt) : 0;
            const timeB = bB ? parseBookingDateTime(bB.dateTimeStr, bB.createdAt) : 0;
            return window.crmSortOrder === 'asc' ? (timeA - timeB) : (timeB - timeA);
        });
        
        cards.forEach(card => {
            col.appendChild(card);
            card.classList.remove('card-reordered');
            void card.offsetWidth;
            card.classList.add('card-reordered');
        });
    });
};

// --- LOAD CRM BOOKINGS ---
window.loadBookings = async function() {
    try {
        const res = await fetch('/api/bookings');
        const bookings = await res.json();
        
        // Sort bookings by current sort order
        if (bookings && bookings.length > 0) {
            bookings.sort((a, b) => {
                const timeA = parseBookingDateTime(a.dateTimeStr, a.createdAt);
                const timeB = parseBookingDateTime(b.dateTimeStr, b.createdAt);
                return window.crmSortOrder === 'asc' ? (timeA - timeB) : (timeB - timeA);
            });
        }
        window.bookingsData = bookings;
        
        // Clear board
        document.querySelectorAll('.kanban-column-content').forEach(col => col.innerHTML = '');

        bookings.forEach(b => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.id = b.id;
            card.ondragstart = window.drag;
            // Both single-click and double-click expand the details view
            card.onclick = function(e) {
                if (window.isCardDragging) return;
                openBookingModal(b.id);
            };
            card.ondblclick = function(e) {
                if (window.isCardDragging) return;
                openBookingModal(b.id);
            };
            const safeName = escapeHtml(b.name || 'Client');
            const safeInitial = escapeHtml((b.name || 'C').charAt(0).toUpperCase());
            const safeSub = escapeHtml(b.email ? b.email : (b.phone ? b.phone : b.id));
            const safeTime = escapeHtml(b.dateTimeStr || '');
            const safeId = escapeHtml(b.id || '');
            const statusKey = b.status || 'Upcoming';
            const isConflict = statusKey.toLowerCase().includes('conflict');
            const conflictBadgeHtml = isConflict
                ? `<div style="margin-top:6px; display:inline-block; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:999px; background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);">Conflict - Reschedule</div>`
                : '';
            card.innerHTML = `
                <div class="card-options" role="button" tabindex="0" title="Expand Details View" onclick="event.stopPropagation(); openBookingModal('${safeId}');">
                    <i class="fa-solid fa-chevron-down"></i>
                </div>
                <div class="card-header">
                    <div class="avatar">${safeInitial}</div>
                    <div class="client-info">
                        <h4>${safeName}</h4>
                        <p>${safeSub}</p>
                    </div>
                </div>
                <div class="card-time">
                    <i class="fa-regular fa-clock"></i> ${safeTime}
                </div>
                ${conflictBadgeHtml}
            `;

            // Normalize status to match column IDs
            let col = document.getElementById('col-' + statusKey);
            if (!col && statusKey === 'Done') col = document.getElementById('col-Completed'); // Fallback
            if (!col && isConflict) col = document.getElementById('col-Rescheduled');
            if (!col && (statusKey === 'Follow-Up' || statusKey === 'FollowUp' || statusKey === 'followup')) col = document.getElementById('col-FollowUp');
            if (!col) col = document.getElementById('col-Upcoming');
            
            if (col) {
                col.appendChild(card);
            }
        });

        if (typeof updateColumnCounts === 'function') updateColumnCounts();
    } catch (e) {
        console.error("Failed to load CRM bookings", e);
    }
};

// Re-override drop function to save status
window.drop = async function(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const card = document.getElementById(data);
    if (card) {
        card.classList.remove('dragging');
        const targetColumn = ev.target.closest('.kanban-column-content');
        if (targetColumn) {
            targetColumn.appendChild(card);
            if (typeof updateColumnCounts === 'function') updateColumnCounts();
            
            // Sync status to Backend (which hits Google Sheets webhook)
            const newStatus = targetColumn.getAttribute('data-status');
            try {
                await fetch(`/api/bookings/${card.id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
            } catch (e) {
                console.error("Failed to update status", e);
            }
        }
    }
};

// Trigger CRM load and search filtering when switching to CRM tab
document.addEventListener('DOMContentLoaded', () => {
    const crmTabBtn = document.querySelector('.nav-item[data-target="panel-crm"]');
    if (crmTabBtn) {
        crmTabBtn.addEventListener('click', () => {
            window.loadBookings();
        });
    }
    // Also load initially if CRM is active
    if (document.getElementById('panel-crm') && document.getElementById('panel-crm').classList.contains('active')) {
        window.loadBookings();
    }

    // Live search by name / phone / ID
    const searchInput = document.querySelector('.crm-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.kanban-card').forEach(card => {
                const nameEl = card.querySelector('.client-info h4');
                const infoEl = card.querySelector('.client-info p');
                const name = (nameEl ? nameEl.innerText : '').toLowerCase();
                const info = (infoEl ? infoEl.innerText : '').toLowerCase();
                const id = card.id.toLowerCase();
                const match = !query || name.includes(query) || info.includes(query) || id.includes(query);
                card.style.display = match ? '' : 'none';
            });
            if (typeof updateColumnCounts === 'function') updateColumnCounts();
        });
    }
});

// --- SYNC WITH GOOGLE SHEETS (Wheel Button) ---
window.syncGoogleSheets = async function(btn) {
    if (!btn) btn = document.getElementById('btn-sync-wheel');
    const originalHtml = '<i class="fa-solid fa-arrows-rotate"></i>';

    if (btn) {
        btn.disabled = true;
        btn.classList.add('syncing');
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i>';
        btn.setAttribute('title', 'Syncing with Google Sheets...');
    }

    try {
        const res = await fetch('/api/bookings/sync-sheets', { method: 'POST' });
        const data = await res.json();
        
        if (res.ok && data.success) {
            if (btn) {
                btn.classList.remove('syncing');
                btn.classList.add('synced');
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                btn.setAttribute('title', `Synced Successfully! (${data.count} Sessions)`);
            }
        } else {
            if (btn) {
                btn.classList.remove('syncing');
                btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                btn.style.color = '#ef4444';
            }
            alert(data.error || "Failed to sync with Google Sheets. Please check your Webhook URL.");
        }
    } catch (e) {
        console.error("Google Sheets sync error:", e);
        if (btn) {
            btn.classList.remove('syncing');
            btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            btn.style.color = '#ef4444';
        }
    } finally {
        setTimeout(() => {
            if (btn) {
                btn.classList.remove('syncing', 'synced');
                btn.style.color = '';
                btn.innerHTML = originalHtml;
                btn.setAttribute('title', 'Sync with Google Sheets');
                btn.disabled = false;
            }
        }, 2200);
    }
};

// --- UPLOAD CSV OF MANUAL APPOINTMENTS ---
window.triggerCSVUpload = function() {
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
};

window.handleCSVUpload = async function(input) {
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file) return;

    const btn = document.getElementById('btn-upload-csv') || document.querySelector('.btn-upload');
    const originalBtnHtml = btn ? btn.innerHTML : '<i class="fa-solid fa-upload"></i> Upload CSV';
    const syncWheel = document.getElementById('btn-sync-wheel');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading CSV...';
        }

        const text = await file.text();
        const rows = parseCSVText(text);

        if (!rows || rows.length === 0) {
            alert("The uploaded CSV file appears to be empty.");
            if (btn) { btn.disabled = false; btn.innerHTML = originalBtnHtml; }
            return;
        }

        // Determine if first row is a header row
        const firstRowLower = rows[0].map(c => (c || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
        const hasHeader = firstRowLower.some(c => 
            c.includes('name') || c.includes('client') || c.includes('phone') || 
            c.includes('time') || c.includes('date') || c.includes('slot') || 
            c.includes('booking') || c.includes('status') || c.includes('id')
        );

        let dataRows = hasHeader ? rows.slice(1) : rows;
        if (dataRows.length === 0) {
            alert("No appointment rows found in the CSV.");
            if (btn) { btn.disabled = false; btn.innerHTML = originalBtnHtml; }
            return;
        }

        // Map column indices if header exists
        let idIdx = -1, nameIdx = -1, phoneIdx = -1, dobIdx = -1, locationIdx = -1;
        let timeIdx = -1, dateIdx = -1, amountIdx = -1, durationIdx = -1, statusIdx = -1, createdAtIdx = -1;

        if (hasHeader) {
            firstRowLower.forEach((h, idx) => {
                if (h === 'id' || h.includes('bookingid') || (h.includes('booking') && h.includes('id'))) idIdx = idx;
                else if (h.includes('name') || h.includes('client') || h.includes('customer')) nameIdx = idx;
                else if (h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('cell')) phoneIdx = idx;
                else if (h.includes('dob') || h.includes('birth')) dobIdx = idx;
                else if (h.includes('location') || h.includes('city') || h.includes('address') || h.includes('place')) locationIdx = idx;
                else if (h.includes('scheduledtime') || h.includes('datetime') || (h.includes('date') && h.includes('time')) || h.includes('slot')) timeIdx = idx;
                else if (h === 'time') timeIdx = idx;
                else if (h === 'date') dateIdx = idx;
                else if (h.includes('fee') || h.includes('amount') || h.includes('price') || h.includes('cost')) amountIdx = idx;
                else if (h.includes('duration') || h.includes('length') || h.includes('mins')) durationIdx = idx;
                else if (h.includes('status')) statusIdx = idx;
                else if (h.includes('timestamp') || h.includes('created') || h.includes('bookedat')) createdAtIdx = idx;
            });
        } else {
            // Default Google Sheets / Tarot CRM order:
            // 0: ID, 1: Timestamp, 2: Name, 3: Phone, 4: DOB, 5: Location, 6: Scheduled Time, 7: Fees, 8: Duration, 9: Status
            idIdx = 0; createdAtIdx = 1; nameIdx = 2; phoneIdx = 3; dobIdx = 4;
            locationIdx = 5; timeIdx = 6; amountIdx = 7; durationIdx = 8; statusIdx = 9;
        }

        // If nameIdx was not found, fallback to first non-empty text column or index 0
        if (nameIdx === -1) nameIdx = 0;

        const parsedBookings = [];
        dataRows.forEach(row => {
            if (!row || row.length === 0 || row.every(cell => !cell || !cell.trim())) return;

            const name = (nameIdx >= 0 && row[nameIdx]) ? row[nameIdx].trim() : '';
            if (!name) return; // Ignore blank lines

            // Clean Phone (strip leading single quote or spaces)
            let phone = (phoneIdx >= 0 && row[phoneIdx]) ? row[phoneIdx].replace(/^'/, '').trim() : '';

            // Scheduled Time
            let scheduledTime = '';
            if (timeIdx >= 0 && row[timeIdx]) scheduledTime = row[timeIdx].trim();
            if (dateIdx >= 0 && row[dateIdx] && dateIdx !== timeIdx) {
                const dVal = row[dateIdx].trim();
                if (scheduledTime) scheduledTime = scheduledTime + ', ' + dVal;
                else scheduledTime = dVal;
            }
            if (!scheduledTime) {
                const now = new Date();
                scheduledTime = now.toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, weekday: 'short', day: 'numeric', month: 'short' });
            }

            // Status normalization
            let rawStatus = (statusIdx >= 0 && row[statusIdx]) ? row[statusIdx].trim().toLowerCase() : '';
            let status = 'Upcoming';
            if (rawStatus.startsWith('comp') || rawStatus === 'done' || rawStatus.startsWith('finish')) {
                status = 'Completed';
            } else if (rawStatus.startsWith('canc')) {
                status = 'Cancelled';
            } else if (rawStatus.startsWith('resched')) {
                status = 'Rescheduled';
            } else if (rawStatus.startsWith('up') || rawStatus.startsWith('pend')) {
                status = 'Upcoming';
            }

            // ID (only use if explicitly in CSV, otherwise server handles smart duplicate matching & ID generation)
            let id = (idIdx >= 0 && row[idIdx]) ? row[idIdx].trim() : '';

            // Amount / Fees
            let amount = (amountIdx >= 0 && row[amountIdx]) ? row[amountIdx].trim() : '₹349';
            if (amount && !amount.startsWith('₹') && !isNaN(parseFloat(amount))) {
                amount = '₹' + amount;
            }

            // Duration
            let duration = (durationIdx >= 0 && row[durationIdx]) ? row[durationIdx].trim() : '20 Mins';
            if (duration && /^\d+$/.test(duration)) {
                duration = duration + ' Mins';
            }

            // Location
            let location = (locationIdx >= 0 && row[locationIdx]) ? row[locationIdx].trim() : 'Online';

            // DOB
            let dob = (dobIdx >= 0 && row[dobIdx]) ? row[dobIdx].trim() : '';

            // Created At
            let createdAt = (createdAtIdx >= 0 && row[createdAtIdx]) ? row[createdAtIdx].trim() : '';
            if (!createdAt || isNaN(new Date(createdAt).getTime())) {
                createdAt = new Date().toISOString();
            } else {
                createdAt = new Date(createdAt).toISOString();
            }

            parsedBookings.push({
                id,
                name,
                phone,
                dob,
                location,
                dateTimeStr: scheduledTime,
                amount,
                duration,
                status,
                createdAt
            });
        });

        if (parsedBookings.length === 0) {
            alert("No valid appointments found in the CSV. Please check the column formatting.");
            if (btn) { btn.disabled = false; btn.innerHTML = originalBtnHtml; }
            return;
        }

        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing ${parsedBookings.length}...`;
        }

        // Send to backend endpoint
        const res = await fetch('/api/bookings/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookings: parsedBookings })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            // 1. Immediately reload cards in CRM UI
            await window.loadBookings();

            // 2. Animate sync wheel to confirm simultaneous Google Sheets sync
            if (syncWheel) {
                syncWheel.classList.add('synced');
                syncWheel.innerHTML = '<i class="fa-solid fa-check"></i>';
                setTimeout(() => {
                    syncWheel.classList.remove('synced');
                    syncWheel.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
                }, 3000);
            }

            // 3. Show button success state
            if (btn) {
                btn.style.background = '#10b981';
                btn.innerHTML = `<i class="fa-solid fa-check"></i> ${data.addedCount || parsedBookings.length} Synced!`;
            }

            let msg = `CSV Processed (${parsedBookings.length} total entries):`;
            if (data.addedCount > 0) {
                msg += `\n• ✅ ${data.addedCount} new appointment(s) added to cards.`;
            }
            if (data.duplicatesBlocked > 0) {
                msg += `\n• 🛡️ ${data.duplicatesBlocked} duplicate entry(ies) prevented (existing card details refreshed).`;
            }
            if (data.addedCount === 0 && data.duplicatesBlocked > 0) {
                msg += `\n(All entries were already in your CRM - double entry prevented!)`;
            }
            if (data.sheetsSynced) {
                msg += `\n• 📊 Google Sheet simultaneously updated.`;
            } else if (!data.sheetsConfigured) {
                msg += `\n• (Google Sheet notice: Webhook URL is not configured in Settings yet).`;
            } else if (data.sheetsError) {
                msg += `\n• (Google Sheet notice: ${data.sheetsError})`;
            }
            alert(msg);
        } else {
            alert(data.error || "Failed to import CSV appointments.");
        }
    } catch (err) {
        console.error("Error during CSV upload:", err);
        alert("An error occurred while uploading the CSV: " + err.message);
    } finally {
        if (input) input.value = '';
        setTimeout(() => {
            if (btn) {
                btn.disabled = false;
                btn.style.background = '';
                btn.innerHTML = originalBtnHtml;
            }
        }, 2800);
    }
};

function parseCSVText(text) {
    if (!text) return [];
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }
    const lines = [];
    let row = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentVal += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(currentVal.trim());
            currentVal = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            row.push(currentVal.trim());
            if (row.some(cell => cell.length > 0)) {
                lines.push(row);
            }
            row = [];
            currentVal = '';
        } else {
            currentVal += char;
        }
    }
    if (currentVal.length > 0 || row.length > 0) {
        row.push(currentVal.trim());
        if (row.some(cell => cell.length > 0)) {
            lines.push(row);
        }
    }
    return lines;
}

// --- DOWNLOAD CSV ---
window.downloadCSV = async function() {
    try {
        const btn = document.querySelector('.btn-upload'); // Reusing the class for styling
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';
        
        const res = await fetch('/api/bookings');
        const bookings = await res.json();
        
        if (!bookings || bookings.length === 0) {
            alert("No bookings found to download.");
            btn.innerHTML = originalText;
            return;
        }
        
        // CSV Headers
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Booking ID,Created At,Name,Phone,DOB,Location,Scheduled Time,Amount,Duration,Status\n";
        
        // Escape CSV values properly
        const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        
        bookings.forEach(b => {
            const row = [
                b.id,
                b.createdAt,
                b.name,
                b.phone,
                b.dob,
                b.location,
                b.dateTimeStr,
                b.amount,
                b.duration,
                b.status
            ].map(escapeCsv).join(",");
            csvContent += row + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Tarot_Bookings_" + new Date().toISOString().split('T')[0] + ".csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        btn.innerHTML = originalText;
    } catch (e) {
        console.error("Failed to download CSV", e);
        alert("An error occurred while downloading the CSV.");
    }
};

// --- MODAL LOGIC ---
let modalTimerInterval = null;




// ===== PREMIUM MODAL WITH COUNTDOWN TIMER & RED BUZZER =====
let currentModalBookingId = null;
let countdownInterval = null;
let countdownTotal = 0;   // Total seconds for the session (from duration)
let countdownLeft = 0;    // Seconds remaining
let isTimerRunning = false;
let buzzerSoundPlayed = false;
const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // ~339.29

// Synthesize pleasant two-tone buzzer beep alert using Web Audio API
function playBuzzerSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        
        // Tone 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.22);
        
        // Tone 2
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(587.33, now + 0.26);
        gain2.gain.setValueAtTime(0.2, now + 0.26);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.26);
        osc2.stop(now + 0.55);
    } catch(e) {
        // Restricted AudioContext or headless environment, fail silently
    }
}

function updateTimerDisplay() {
    const mins = Math.floor(countdownLeft / 60).toString().padStart(2, '0');
    const secs = (countdownLeft % 60).toString().padStart(2, '0');
    const displayEl = document.getElementById('timer-display');
    if (displayEl) displayEl.innerText = mins + ':' + secs;

    // Update ring progress
    const ring = document.getElementById('timer-ring-progress');
    if (ring && countdownTotal > 0) {
        const fraction = countdownLeft / countdownTotal;
        ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
    }

    // Elements
    const label = document.getElementById('timer-label');
    const timerSection = document.getElementById('bm-timer-section') || document.querySelector('.bm-timer-section');
    const playBtn = document.getElementById('btn-timer-toggle');

    if (countdownLeft <= 0) {
        // TIME IS UP: Trigger Red Buzzer Alarm
        clearInterval(countdownInterval);
        isTimerRunning = false;

        if (timerSection) {
            timerSection.classList.add('bm-buzzer-active');
        }

        if (label) {
            label.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> TIME\'S UP!';
            label.style.color = '#ef4444';
        }

        if (playBtn) {
            playBtn.innerHTML = '<i class="fa-solid fa-bell"></i>';
            playBtn.classList.remove('paused');
            playBtn.classList.add('buzzer-alert');
        }

        if (!buzzerSoundPlayed) {
            playBuzzerSound();
            buzzerSoundPlayed = true;
        }
    } else {
        // Time remaining > 0: ensure buzzer state is cleared
        if (timerSection) {
            timerSection.classList.remove('bm-buzzer-active');
        }
        buzzerSoundPlayed = false;

        if (playBtn) {
            playBtn.classList.remove('buzzer-alert');
        }

        if (label) {
            if (isTimerRunning) {
                label.innerText = 'RUNNING';
                label.style.color = '#10b981';
            } else if (countdownLeft === countdownTotal) {
                label.innerText = 'REMAINING';
                label.style.color = '';
            } else {
                label.innerText = 'PAUSED';
                label.style.color = '#f59e0b';
            }
        }
    }
}

window.toggleSessionTimer = function() {
    const btn = document.getElementById('btn-timer-toggle');
    if (isTimerRunning) {
        clearInterval(countdownInterval);
        isTimerRunning = false;
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            btn.classList.remove('paused');
        }
        const label = document.getElementById('timer-label');
        if (label && countdownLeft > 0) {
            label.innerText = 'PAUSED';
            label.style.color = '#f59e0b';
        }
    } else {
        if (countdownLeft <= 0) {
            // If time is up and they hit play without adding minutes, add 5m automatically
            window.addFiveMinutes();
            return;
        }
        isTimerRunning = true;
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            btn.classList.add('paused');
            btn.classList.remove('buzzer-alert');
        }
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            countdownLeft--;
            if (countdownLeft < 0) countdownLeft = 0;
            updateTimerDisplay();
        }, 1000);
        updateTimerDisplay();
    }
};

window.resetSessionTimer = function() {
    clearInterval(countdownInterval);
    isTimerRunning = false;
    countdownLeft = countdownTotal;
    buzzerSoundPlayed = false;
    const timerSection = document.getElementById('bm-timer-section') || document.querySelector('.bm-timer-section');
    if (timerSection) timerSection.classList.remove('bm-buzzer-active');
    
    updateTimerDisplay();
    
    const btn = document.getElementById('btn-timer-toggle');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        btn.classList.remove('paused', 'buzzer-alert');
    }
};

window.addFiveMinutes = function() {
    const timerSection = document.getElementById('bm-timer-section') || document.querySelector('.bm-timer-section');
    const addBtn = document.getElementById('btn-timer-add5');

    // Button pop feedback
    if (addBtn) {
        addBtn.classList.remove('bm-btn-pop');
        void addBtn.offsetWidth;
        addBtn.classList.add('bm-btn-pop');
    }

    // Add 300 seconds (5 minutes)
    countdownLeft += 300;
    countdownTotal = Math.max(countdownTotal + 300, countdownLeft);

    // Clear red buzzer alarm
    if (timerSection) {
        timerSection.classList.remove('bm-buzzer-active');
    }
    buzzerSoundPlayed = false;

    // Start/resume timer automatically
    clearInterval(countdownInterval);
    isTimerRunning = true;
    const playBtn = document.getElementById('btn-timer-toggle');
    if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        playBtn.classList.add('paused');
        playBtn.classList.remove('buzzer-alert');
    }

    countdownInterval = setInterval(() => {
        countdownLeft--;
        if (countdownLeft < 0) countdownLeft = 0;
        updateTimerDisplay();
    }, 1000);

    updateTimerDisplay();
};

// Parse "20 Mins" -> 1200 seconds
function parseDurationToSeconds(str) {
    if (!str || str === 'N/A') return 20 * 60; // default 20 min
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1]) * 60 : 20 * 60;
}

window.openBookingModal = function(id) {
    if (!window.bookingsData) return;
    const booking = window.bookingsData.find(b => b.id === id);
    if (!booking) return;
    currentModalBookingId = id;

    document.getElementById('modal-avatar').innerText = booking.name.charAt(0).toUpperCase();
    document.getElementById('modal-name').innerText = booking.name;
    document.getElementById('modal-id').innerText = booking.id;
    document.getElementById('modal-time').innerText = booking.dateTimeStr || 'Not Set';

    const phoneEl = document.getElementById('modal-phone');
    phoneEl.innerText = booking.phone || 'N/A';
    const cleanTel = booking.phone ? String(booking.phone).replace(/[^0-9+\-\s()]/g, '') : '';
    phoneEl.href = cleanTel ? 'tel:' + cleanTel : '#';

    document.getElementById('modal-dob').innerText = booking.dob || 'N/A';
    document.getElementById('modal-location').innerText = booking.location || 'N/A';
    document.getElementById('modal-amount').innerText = booking.amount || 'N/A';
    document.getElementById('modal-duration').innerText = booking.duration || 'N/A';

    // Status pills
    document.querySelectorAll('.bm-status-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-status') === (booking.status || 'Upcoming'));
    });

    // Setup countdown from duration
    countdownTotal = parseDurationToSeconds(booking.duration);
    countdownLeft = countdownTotal;
    clearInterval(countdownInterval);
    isTimerRunning = false;
    buzzerSoundPlayed = false;

    const timerSection = document.getElementById('bm-timer-section') || document.querySelector('.bm-timer-section');
    if (timerSection) timerSection.classList.remove('bm-buzzer-active');

    const playBtn = document.getElementById('btn-timer-toggle');
    if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        playBtn.classList.remove('paused', 'buzzer-alert');
    }

    // Inject SVG gradient if not present
    if (!document.getElementById('timer-gradient')) {
        const svg = document.querySelector('.bm-ring-svg');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = '<linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ec4899"/></linearGradient>';
        svg.prepend(defs);
    }

    updateTimerDisplay();

    document.getElementById('booking-modal-overlay').classList.remove('hidden');
};

window.closeBookingModal = function(e) {
    if (e && e.target.id !== 'booking-modal-overlay' && !e.target.closest('.bm-close')) return;
    document.getElementById('booking-modal-overlay').classList.add('hidden');
    clearInterval(countdownInterval);
    isTimerRunning = false;
    buzzerSoundPlayed = false;
    const timerSection = document.getElementById('bm-timer-section') || document.querySelector('.bm-timer-section');
    if (timerSection) timerSection.classList.remove('bm-buzzer-active');
};


window.changeModalStatus = function(newStatus) {
    if (!currentModalBookingId) return;
    const bookingId = currentModalBookingId;

    // 1. Instant feedback on clicked modal button
    const activeBtn = document.querySelector(`.bm-status-pill[data-status="${newStatus}"]`);
    document.querySelectorAll('.bm-status-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-status') === newStatus);
    });
    if (activeBtn) {
        activeBtn.classList.remove('bm-pill-pop');
        void activeBtn.offsetWidth; // Force reflow to replay animation
        activeBtn.classList.add('bm-pill-pop');
    }

    // 2. Identify destination Kanban column
    let targetColId = 'col-' + newStatus;
    if (newStatus === 'Done') targetColId = 'col-Completed';
    if (newStatus === 'Follow-Up' || newStatus === 'FollowUp' || newStatus === 'followup') targetColId = 'col-FollowUp';
    const targetCol = document.getElementById(targetColId);

    // Locate the card in the board
    const card = document.getElementById(bookingId);

    // 3. Immediately dismiss modal so the user witnesses the shifting animation
    setTimeout(() => {
        const modal = document.getElementById('booking-modal-overlay');
        if (modal) modal.classList.add('hidden');
        clearInterval(countdownInterval);
        isTimerRunning = false;
    }, 70);

    // 4. Smooth shifting animation between columns
    if (card && targetCol) {
        const currentCol = card.closest('.kanban-column-content');

        if (currentCol && currentCol.id === targetColId) {
            // Already in this column: give an immediate glowing confirmation pulse
            card.classList.remove('card-shifted-in');
            void card.offsetWidth;
            card.setAttribute('data-glow-status', newStatus);
            card.classList.add('card-shifted-in');
            setTimeout(() => {
                card.classList.remove('card-shifted-in');
                card.removeAttribute('data-glow-status');
            }, 2200);
        } else {
            // Step 4a: Animate card shrinking/lifting out of old column
            card.classList.add('card-shifting-out');

            setTimeout(() => {
                card.classList.remove('card-shifting-out');

                // Step 4b: Prepend card into target column at the top
                targetCol.prepend(card);
                card.setAttribute('data-glow-status', newStatus);
                card.classList.add('card-shifted-in');

                // Step 4c: Instantly update column count headers (e.g. '2 sessions')
                if (typeof updateColumnCounts === 'function') {
                    updateColumnCounts();
                }

                // Step 4d: Ensure card is visibly scrolled into view
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Step 4e: Clean up animation class after glow completes
                setTimeout(() => {
                    card.classList.remove('card-shifted-in');
                    card.removeAttribute('data-glow-status');
                }, 2200);
            }, 180);
        }
    }

    // 5. Update local in-memory dataset immediately
    if (window.bookingsData) {
        const b = window.bookingsData.find(item => item.id === bookingId);
        if (b) b.status = newStatus;
    }

    // 6. Asynchronous non-blocking background sync to server & Google Sheets
    fetch('/api/bookings/' + bookingId + '/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    }).catch(e => {
        console.error('Background status update failed:', e);
    });
};


window.deleteCurrentBooking = async function() {
    if (!currentModalBookingId) return;
    const booking = window.bookingsData ? window.bookingsData.find(b => b.id === currentModalBookingId) : null;
    const clientName = booking ? booking.name : 'this client';
    
    if (!confirm(`Are you sure you want to delete the appointment for "${clientName}" (${currentModalBookingId})?\n\nThis will remove it from CRM and Google Sheets.`)) {
        return;
    }
    
    try {
        const res = await fetch(`/api/bookings/${currentModalBookingId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
            // Close modal
            document.getElementById('booking-modal-overlay').classList.add('hidden');
            clearInterval(countdownInterval);
            isTimerRunning = false;
            currentModalBookingId = null;
            
            // Reload CRM Kanban Board
            if (typeof window.loadBookings === 'function') {
                await window.loadBookings();
            }
        } else {
            alert(data.error || "Failed to delete booking.");
        }
    } catch (e) {
        console.error("Delete booking error:", e);
        alert("Failed to delete booking. Please check connection.");
    }
};

// ===== CRM FOLLOW-UP SCHEDULING CONTROLLER =====
window.selectedFollowUpDays = 7;

window.openFollowUpModal = function() {
    if (!currentModalBookingId || !window.bookingsData) return;
    const booking = window.bookingsData.find(b => b.id === currentModalBookingId);
    if (!booking) return;

    // Fill client info
    const nameEl = document.getElementById('fu-client-name');
    const idEl = document.getElementById('fu-client-id');
    const noteEl = document.getElementById('fu-note-input');
    const timeInput = document.getElementById('fu-preview-time');

    if (nameEl) nameEl.innerText = booking.name || 'Client';
    if (idEl) idEl.innerText = booking.id;
    if (noteEl) noteEl.value = booking.followUpNote || '';
    if (timeInput) delete timeInput.dataset.userEdited;

    // Default to 7 days (or existing followUpDays if previously set)
    const initialDays = booking.followUpDays ? parseInt(booking.followUpDays) : 7;
    window.selectedFollowUpDays = initialDays;

    // Highlight the matching button (5, 7, 15) or custom
    let matchedPreset = false;
    document.querySelectorAll('.fu-btn-day').forEach(btn => {
        const d = btn.getAttribute('data-days');
        const isMatch = (d === String(initialDays));
        btn.classList.toggle('active', isMatch);
        if (isMatch) matchedPreset = true;
    });

    const customBox = document.getElementById('fu-custom-container');
    const customInput = document.getElementById('fu-custom-days-input');
    if (!matchedPreset) {
        const customBtn = document.querySelector('.fu-btn-day[data-days="custom"]');
        if (customBtn) customBtn.classList.add('active');
        if (customBox) customBox.classList.remove('hidden');
        if (customInput) customInput.value = initialDays;
    } else {
        if (customBox) customBox.classList.add('hidden');
    }

    // Live calculate date & time preview
    updateFollowUpPreview();

    // Reveal Follow-Up modal
    const overlay = document.getElementById('followup-modal-overlay');
    if (overlay) overlay.classList.remove('hidden');
};

window.closeFollowUpModal = function(event) {
    if (event && event.target && event.target.id !== 'followup-modal-overlay') return;
    const overlay = document.getElementById('followup-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
};

window.setFollowUpDays = function(days) {
    window.selectedFollowUpDays = parseInt(days) || 7;
    document.querySelectorAll('.fu-btn-day').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-days') === String(days));
    });
    const customBox = document.getElementById('fu-custom-container');
    if (customBox) customBox.classList.add('hidden');
    updateFollowUpPreview();
};

window.toggleCustomDays = function() {
    const customBox = document.getElementById('fu-custom-container');
    const customInput = document.getElementById('fu-custom-days-input');
    document.querySelectorAll('.fu-btn-day').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-days') === 'custom');
    });
    if (customBox) {
        customBox.classList.remove('hidden');
        if (customInput) {
            customInput.focus();
            window.selectedFollowUpDays = parseInt(customInput.value) || 10;
        }
    }
    updateFollowUpPreview();
};

window.onCustomDaysInput = function(val) {
    const num = parseInt(val);
    if (!isNaN(num) && num > 0) {
        window.selectedFollowUpDays = num;
        updateFollowUpPreview();
    }
};

window.updateFollowUpPreviewDateString = function() {
    const timeInput = document.getElementById('fu-preview-time');
    if (timeInput) timeInput.dataset.userEdited = 'true';
};

window.updateFollowUpPreview = function() {
    if (!currentModalBookingId || !window.bookingsData) return;
    const booking = window.bookingsData.find(b => b.id === currentModalBookingId);

    let baseDate = new Date();
    let baseTimeStr = '03:00 PM';

    if (booking && booking.dateTimeStr) {
        const timeMatch = booking.dateTimeStr.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
        if (timeMatch) baseTimeStr = timeMatch[1].toUpperCase();

        const parsedMs = (typeof parseBookingDateTime === 'function') 
            ? parseBookingDateTime(booking.dateTimeStr, booking.createdAt) 
            : 0;
        if (parsedMs > 0) {
            const parsedDate = new Date(parsedMs);
            if (parsedDate.getTime() > Date.now() - (24 * 3600 * 1000)) {
                baseDate = parsedDate;
            }
        }
    }

    const daysToAdd = window.selectedFollowUpDays || 7;
    const targetDate = new Date(baseDate.getTime() + (daysToAdd * 24 * 3600 * 1000));

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = dayNames[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const dateNum = targetDate.getDate();
    const yearNum = targetDate.getFullYear();

    const datePreviewEl = document.getElementById('fu-preview-date');
    const relTagEl = document.getElementById('fu-preview-rel');
    const timeInput = document.getElementById('fu-preview-time');

    if (datePreviewEl) {
        datePreviewEl.innerText = `${dayName}, ${dateNum} ${monthName} ${yearNum}`;
    }
    if (relTagEl) {
        relTagEl.innerText = (daysToAdd === 1) ? 'In 1 Day' : `In ${daysToAdd} Days`;
    }
    if (timeInput && !timeInput.dataset.userEdited) {
        timeInput.value = baseTimeStr;
    }
};

window.confirmFollowUpSession = async function() {
    if (!currentModalBookingId || !window.bookingsData) return;
    const bookingId = currentModalBookingId;
    const booking = window.bookingsData.find(b => b.id === bookingId);
    if (!booking) return;

    // 1. Calculate final Follow-Up dateTimeStr
    const daysToAdd = window.selectedFollowUpDays || 7;
    const timeInput = document.getElementById('fu-preview-time');
    let timeStr = (timeInput && timeInput.value.trim()) ? timeInput.value.trim() : '03:00 PM';

    let baseDate = new Date();
    if (booking.dateTimeStr) {
        const parsedMs = (typeof parseBookingDateTime === 'function')
            ? parseBookingDateTime(booking.dateTimeStr, booking.createdAt)
            : 0;
        if (parsedMs > 0) {
            const parsedDate = new Date(parsedMs);
            if (parsedDate.getTime() > Date.now() - (24 * 3600 * 1000)) {
                baseDate = parsedDate;
            }
        }
    }

    const targetDate = new Date(baseDate.getTime() + (daysToAdd * 24 * 3600 * 1000));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = dayNames[targetDate.getDay()];
    const monthName = monthNames[targetDate.getMonth()];
    const dateNum = targetDate.getDate();

    // Standard format matching CRM cards: e.g. "03:00 PM, Mon, 19 Oct"
    const newDateTimeStr = `${timeStr}, ${dayName}, ${dateNum} ${monthName}`;
    const noteEl = document.getElementById('fu-note-input');
    const note = noteEl ? noteEl.value.trim() : '';

    // 2. Update local in-memory dataset
    booking.status = 'Follow-Up';
    booking.dateTimeStr = newDateTimeStr;
    booking.followUpDays = daysToAdd;
    if (note) booking.followUpNote = note;

    // 3. Close both modals
    const fuModal = document.getElementById('followup-modal-overlay');
    if (fuModal) fuModal.classList.add('hidden');
    const bookingModal = document.getElementById('booking-modal-overlay');
    if (bookingModal) bookingModal.classList.add('hidden');
    clearInterval(countdownInterval);
    isTimerRunning = false;

    // 4. Update card in DOM and shift into Follow-Up column
    const card = document.getElementById(bookingId);
    const targetCol = document.getElementById('col-FollowUp');

    if (card && targetCol) {
        // Step 4a: Shrink/lift out of previous column
        card.classList.add('card-shifting-out');

        setTimeout(() => {
            card.classList.remove('card-shifting-out');

            // Step 4b: Update displayed time on card
            const timeEl = card.querySelector('.card-time');
            if (timeEl) {
                timeEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${newDateTimeStr}`;
            }

            // Step 4c: Prepend card into Follow-Up column
            targetCol.prepend(card);
            card.setAttribute('data-glow-status', 'Follow-Up');
            card.classList.add('card-shifted-in');

            // Step 4d: Update column headers
            if (typeof updateColumnCounts === 'function') {
                updateColumnCounts();
            }

            // Step 4e: Scroll smoothly to card
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Step 4f: Clear animation glow
            setTimeout(() => {
                card.classList.remove('card-shifted-in');
                card.removeAttribute('data-glow-status');
            }, 2200);
        }, 180);
    }

    // 5. Background sync to Server & Google Sheets Webhook
    try {
        await fetch(`/api/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Follow-Up',
                dateTimeStr: newDateTimeStr,
                followUpDays: daysToAdd,
                followUpNote: note
            })
        });
    } catch (e) {
        console.error("Failed to save follow-up status to server:", e);
    }
};

// ===== GOOGLE APPS SCRIPT CODE MODAL CONTROLLER =====
window.GOOGLE_APPS_SCRIPT_CODE = `function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Tarot CRM Google Sheet Webhook is active and running!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 10 seconds to prevent concurrent write collisions
    lock.waitLock(10000);
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // 1. Ensure Header Row is Always Present
    var headers = ["Booking ID", "Timestamp", "Client Name", "Phone", "DOB", "Location", "Scheduled Time", "Fees", "Duration", "Status"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#f3f4f6")
      .setHorizontalAlignment("center");
      
    // Apply automatic conditional formatting rules to column J
    ensureConditionalFormatting(sheet);
    
    // 2. BULK SYNC (Triggered by the Sync Wheel in CRM or Deletions)
    if (data.action === 'sync_all' && Array.isArray(data.bookings)) {
      // Clear old rows and ghost/empty rows below Row 1
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent().clearFormat();
      }
      
      if (data.bookings.length > 0) {
        var rows = data.bookings.map(function(b) {
          return [
            b.id || '',
            b.createdAt ? new Date(b.createdAt) : new Date(),
            b.name || '',
            b.phone ? "'" + b.phone : '',
            b.dob || '',
            b.location || '',
            b.dateTimeStr || '',
            b.amount || '₹349',
            b.duration || '20 Mins',
            b.status || 'Upcoming'
          ];
        });
        
        var range = sheet.getRange(2, 1, rows.length, headers.length);
        range.setValues(rows);
        range.setVerticalAlignment("middle");
        
        // Color-code every status cell in Column 10 (J)
        for (var r = 0; r < rows.length; r++) {
          var statusCell = sheet.getRange(r + 2, 10);
          formatStatusCell(statusCell, rows[r][9]);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "synced",
        count: data.bookings.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. UPDATE STATUS (Matched STRICTLY by Booking ID!)
    if (data.action === 'update_status') {
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      
      if (lastRow > 1) {
        var idValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < idValues.length; i++) {
          // Strictly match by Booking ID only
          if (String(idValues[i][0]).trim() === String(data.id).trim()) {
            foundRow = i + 2;
            break;
          }
        }
      }
      
      if (foundRow > 0) {
        var statusCell = sheet.getRange(foundRow, 10);
        statusCell.setValue(data.status);
        formatStatusCell(statusCell, data.status);
        if (data.dateTimeStr) {
          sheet.getRange(foundRow, 7).setValue(data.dateTimeStr);
        }
        
        return ContentService.createTextOutput(JSON.stringify({ status: "updated", row: foundRow })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // If booking wasn't in sheet yet, append it with styling
        sheet.appendRow([
          data.id || '',
          data.createdAt ? new Date(data.createdAt) : new Date(),
          data.name || '',
          data.phone ? "'" + data.phone : '',
          data.dob || '',
          data.location || '',
          data.dateTimeStr || '',
          data.amount || '₹349',
          data.duration || '20 Mins',
          data.status || 'Upcoming'
        ]);
        var newRow = sheet.getLastRow();
        formatStatusCell(sheet.getRange(newRow, 10), data.status || 'Upcoming');
        return ContentService.createTextOutput(JSON.stringify({ status: "created_on_update" })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // 4. ADMIN PASSWORD RESET LINK (Clickable Hyperlink in Sheet)
    if (data.action === 'password_reset') {
      var resetFormula = '=HYPERLINK("' + data.resetLink + '", "CLICK TO RESET PASSWORD")';
      sheet.appendRow([
        "AUTH-RESET",
        new Date(),
        "ADMIN SECURITY",
        "PASSWORD RESET",
        "",
        "Admin Portal",
        resetFormula,
        "",
        "Valid 1 Hour",
        "RESET LINK"
      ]);
      
      var lastR = sheet.getLastRow();
      sheet.getRange(lastR, 1, 1, headers.length).setBackground('#f3e8ff').setFontColor('#6b21a8');
      sheet.getRange(lastR, 7).setFontWeight('bold').setFontColor('#2563eb');
      sheet.getRange(lastR, 10).setBackground('#7e22ce').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
      
      return ContentService.createTextOutput(JSON.stringify({ status: "reset_link_added" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. CREATE NEW BOOKING (From website checkout)
    if (data.action === 'create' || !data.action) {
      sheet.appendRow([
        data.id || '',
        data.createdAt ? new Date(data.createdAt) : new Date(),
        data.name || '',
        data.phone ? "'" + data.phone : '',
        data.dob || '',
        data.location || '',
        data.dateTimeStr || '',
        data.amount || '₹349',
        data.duration || '20 Mins',
        data.status || 'Upcoming'
      ]);
      var newRow = sheet.getLastRow();
      formatStatusCell(sheet.getRange(newRow, 10), data.status || 'Upcoming');
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "unknown_action" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Helper: Applies Pill Background, Font Color & Bold Centered Styling to Status Cell
function formatStatusCell(cell, status) {
  var st = String(status || '').toLowerCase().trim();
  cell.setFontWeight("bold").setHorizontalAlignment("center");
  
  if (st === 'upcoming') {
    cell.setBackground('#dbeafe').setFontColor('#1e40af'); // Light Blue / Dark Blue text
  } else if (st === 'completed' || st === 'done' || st === 'complete') {
    cell.setBackground('#d1fae5').setFontColor('#065f46'); // Light Green / Dark Green text
  } else if (st === 'cancelled' || st === 'canceled' || st === 'cancel') {
    cell.setBackground('#fee2e2').setFontColor('#991b1b'); // Light Red / Dark Red text
  } else if (st === 'rescheduled' || st === 'reschedule') {
    cell.setBackground('#fef3c7').setFontColor('#92400e'); // Light Yellow / Dark Amber text
  } else if (st === 'follow-up' || st === 'followup' || st === 'follow up') {
    cell.setBackground('#f3e8ff').setFontColor('#6b21a8'); // Purple badge
  } else if (st === 'reset link') {
    cell.setBackground('#7e22ce').setFontColor('#ffffff'); // Purple badge
  }
}

// Helper: Sets up Google Sheet Conditional Formatting on Column J (J2:J1000)
function ensureConditionalFormatting(sheet) {
  var rules = sheet.getConditionalFormatRules();
  if (rules.length >= 4) return;
  
  var statusRange = sheet.getRange("J2:J1000");
  var newRules = [];
  
  // Upcoming - Blue
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Upcoming")
    .setBackground("#dbeafe")
    .setFontColor("#1e40af")
    .setRanges([statusRange])
    .build());
    
  // Completed - Green
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Completed")
    .setBackground("#d1fae5")
    .setFontColor("#065f46")
    .setRanges([statusRange])
    .build());
    
  // Cancelled - Red
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Cancelled")
    .setBackground("#fee2e2")
    .setFontColor("#991b1b")
    .setRanges([statusRange])
    .build());

  // Canceled (single L) - Red
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Canceled")
    .setBackground("#fee2e2")
    .setFontColor("#991b1b")
    .setRanges([statusRange])
    .build());
    
  // Rescheduled - Yellow
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Rescheduled")
    .setBackground("#fef3c7")
    .setFontColor("#92400e")
    .setRanges([statusRange])
    .build());

  // Follow-Up - Purple
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Follow-Up")
    .setBackground("#f3e8ff")
    .setFontColor("#6b21a8")
    .setRanges([statusRange])
    .build());
    
  sheet.setConditionalFormatRules(newRules);
}`;

// ===== GOOGLE APPS SCRIPT CODE LOCK & EDIT CONTROLLER =====
window.isAppScriptUnlocked = false;
window.isAppScriptEditing = false;

window.openAppScriptModal = function() {
    const modal = document.getElementById('appscript-modal-overlay');
    const codeEl = document.getElementById('appscript-code-content');
    const editorEl = document.getElementById('appscript-code-editor');

    // Retrieve saved custom code if available
    const savedCustomCode = localStorage.getItem('customGoogleAppsScriptCode');
    if (savedCustomCode) {
        window.GOOGLE_APPS_SCRIPT_CODE = savedCustomCode;
    }

    if (codeEl) {
        codeEl.textContent = window.GOOGLE_APPS_SCRIPT_CODE;
    }
    if (editorEl) {
        editorEl.value = window.GOOGLE_APPS_SCRIPT_CODE;
    }

    // Always start in Locked, non-editing state for safety
    window.isAppScriptUnlocked = false;
    window.isAppScriptEditing = false;
    window.updateAppScriptLockUI();

    if (modal) {
        modal.classList.remove('hidden');
    }
};

window.closeAppScriptModal = function(e) {
    if (e && e.target.id !== 'appscript-modal-overlay' && !e.target.closest('.bm-close')) return;
    const modal = document.getElementById('appscript-modal-overlay');
    
    // If closing while editing, exit edit mode and lock
    window.isAppScriptEditing = false;
    window.isAppScriptUnlocked = false;
    window.updateAppScriptLockUI();

    if (modal) {
        modal.classList.add('hidden');
    }
};

window.toggleAppScriptLock = function() {
    if (window.isAppScriptEditing) {
        // If user was actively editing and clicks the lock icon:
        // Automatically save changes and lock!
        window.saveAppScriptCodeEdit();
        return;
    }

    window.isAppScriptUnlocked = !window.isAppScriptUnlocked;
    window.updateAppScriptLockUI();
};

window.handleAppScriptEditClick = function() {
    if (!window.isAppScriptUnlocked) {
        // User clicked pen while locked: provide clear feedback to unlock first
        const lockBtn = document.getElementById('btn-appscript-lock');
        if (lockBtn) {
            lockBtn.classList.add('shake-btn');
            setTimeout(() => lockBtn.classList.remove('shake-btn'), 450);
        }
        alert("🔒 Editing is locked. Please click the Lock icon to unlock first, then click the Pen to edit.");
        return;
    }

    window.startAppScriptEditing();
};

window.startAppScriptEditing = function() {
    if (!window.isAppScriptUnlocked) return;

    window.isAppScriptEditing = true;
    const preEl = document.getElementById('appscript-code-pre');
    const editorEl = document.getElementById('appscript-code-editor');
    const saveBtn = document.getElementById('btn-save-appscript');
    const editBtn = document.getElementById('btn-appscript-edit');

    if (editorEl && preEl) {
        editorEl.value = window.GOOGLE_APPS_SCRIPT_CODE;
        preEl.style.display = 'none';
        editorEl.style.display = 'block';
        editorEl.focus();
    }

    if (saveBtn) {
        saveBtn.style.display = 'inline-flex';
    }

    if (editBtn) {
        editBtn.className = 'btn-code-control btn-code-edit editing';
        editBtn.innerHTML = '<i class="fa-solid fa-pen-nib"></i> <span>Editing</span>';
    }
};

window.saveAppScriptCodeEdit = async function() {
    const editorEl = document.getElementById('appscript-code-editor');
    const saveBtn = document.getElementById('btn-save-appscript');
    const codeEl = document.getElementById('appscript-code-content');

    let newCode = window.GOOGLE_APPS_SCRIPT_CODE;
    if (editorEl) {
        newCode = editorEl.value;
        window.GOOGLE_APPS_SCRIPT_CODE = newCode;
    }
    if (codeEl) {
        codeEl.textContent = newCode;
    }

    // Persist to localStorage
    localStorage.setItem('customGoogleAppsScriptCode', newCode);

    // Persist to server db.json configuration
    try {
        await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                integrations: { customAppScriptCode: newCode }
            })
        });
    } catch (err) {
        console.error("Failed to persist custom App Script code:", err);
    }

    // Automatically lock after saving!
    window.isAppScriptEditing = false;
    window.isAppScriptUnlocked = false;
    window.updateAppScriptLockUI();

    if (saveBtn) {
        saveBtn.style.display = 'inline-flex';
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Saved & Locked!</span>';
        setTimeout(() => {
            saveBtn.style.display = 'none';
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save Code</span>';
        }, 1400);
    }
};

window.updateAppScriptLockUI = function() {
    const lockBtn = document.getElementById('btn-appscript-lock');
    const lockIcon = document.getElementById('icon-appscript-lock');
    const lockLabel = document.getElementById('label-appscript-lock');
    const editBtn = document.getElementById('btn-appscript-edit');
    const preEl = document.getElementById('appscript-code-pre');
    const editorEl = document.getElementById('appscript-code-editor');
    const saveBtn = document.getElementById('btn-save-appscript');

    if (window.isAppScriptUnlocked) {
        // UNLOCKED STATE
        if (lockBtn) {
            lockBtn.className = 'btn-code-control btn-code-lock is-unlocked';
            lockBtn.title = 'Unlocked - Click to lock code';
        }
        if (lockIcon) lockIcon.className = 'fa-solid fa-lock-open';
        if (lockLabel) lockLabel.textContent = 'Unlocked';

        if (editBtn && !window.isAppScriptEditing) {
            editBtn.className = 'btn-code-control btn-code-edit unlocked';
            editBtn.title = 'Click to edit code';
            editBtn.innerHTML = '<i class="fa-solid fa-pen" id="icon-appscript-edit"></i> <span>Edit</span>';
        }
    } else {
        // LOCKED STATE
        window.isAppScriptEditing = false;
        if (lockBtn) {
            lockBtn.className = 'btn-code-control btn-code-lock is-locked';
            lockBtn.title = 'Locked - Click to unlock editing';
        }
        if (lockIcon) lockIcon.className = 'fa-solid fa-lock';
        if (lockLabel) lockLabel.textContent = 'Locked';

        if (editBtn) {
            editBtn.className = 'btn-code-control btn-code-edit locked';
            editBtn.title = 'Unlock first to edit code';
            editBtn.innerHTML = '<i class="fa-solid fa-pen" id="icon-appscript-edit"></i> <span>Edit</span>';
        }

        if (editorEl) editorEl.style.display = 'none';
        if (preEl) preEl.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';
    }
};

// Enable Tab key inside code textarea
document.addEventListener('DOMContentLoaded', () => {
    const editorEl = document.getElementById('appscript-code-editor');
    if (editorEl) {
        editorEl.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 2;
            }
        });
    }
});

window.copyAppScriptCode = function() {
    const code = window.GOOGLE_APPS_SCRIPT_CODE;
    const copyBtns = [
        document.getElementById('btn-copy-appscript'),
        document.querySelector('#appscript-modal-overlay .btn-primary')
    ].filter(Boolean);
    
    const setSuccess = () => {
        copyBtns.forEach(btn => {
            btn.classList.add('copied');
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Copied to Clipboard!</span>';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = originalHtml;
            }, 2500);
        });
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(setSuccess).catch(() => {
            fallbackCopy(code, setSuccess);
        });
    } else {
        fallbackCopy(code, setSuccess);
    }
};

function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        if (cb) cb();
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
    document.body.removeChild(ta);
}

// Global Escape Key to close modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const appModal = document.getElementById('appscript-modal-overlay');
        if (appModal && !appModal.classList.contains('hidden')) {
            window.closeAppScriptModal();
        }
    }
});

// ===== ONE-CLICK FULL SCREEN CONTROLLER =====
window.toggleFullScreen = function() {
    try {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    } catch (err) {
        console.error("Fullscreen toggle failed:", err);
    }
};

function updateFullScreenUI() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    document.querySelectorAll('.btn-fullscreen-toggle').forEach(btn => {
        btn.classList.toggle('is-fullscreen', isFS);
        btn.setAttribute('title', isFS ? 'Exit Full Screen' : 'Full Screen View');
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = isFS ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        }
    });
}

document.addEventListener('fullscreenchange', updateFullScreenUI);
document.addEventListener('webkitfullscreenchange', updateFullScreenUI);
document.addEventListener('mozfullscreenchange', updateFullScreenUI);
document.addEventListener('MSFullscreenChange', updateFullScreenUI);

window.downloadDatabaseBackup = async function() {
    try {
        const res = await fetch('/api/admin/export-database');
        if (!res.ok) throw new Error('Unauthorized or export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'db.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('Could not download backup: ' + e.message);
    }
};

window.triggerRestoreDatabase = function() {
    const fileInput = document.getElementById('restore-db-file');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
};

window.handleRestoreDatabaseFile = async function(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || (!parsed.content && !parsed.plans && !parsed.availability)) {
            alert('Invalid db.json file. Please select a valid TrikalDarshi database backup.');
            return;
        }

        const safeContent = parsed.content ? { ...parsed.content } : undefined;
        if (safeContent && typeof safeContent.profilePic === 'string' && safeContent.profilePic.startsWith('data:') && safeContent.profilePic.length > 45000) {
            safeContent.profilePic = 'profile-avatar.webp';
        }

        const configPayload = {};
        if (safeContent) configPayload.content = safeContent;
        if (Array.isArray(parsed.plans)) configPayload.plans = parsed.plans;
        if (parsed.unlistedPlan) configPayload.unlistedPlan = parsed.unlistedPlan;
        if (parsed.availability) configPayload.availability = parsed.availability;
        if (Array.isArray(parsed.blockedDates)) configPayload.blockedDates = parsed.blockedDates;
        if (parsed.settings) configPayload.settings = parsed.settings;

        if (!confirm('Restore content, plans, availability, and settings from "' + file.name + '" into your backend? (Your existing Razorpay keys and Admin password will NOT be overwritten.)')) {
            return;
        }

        const cfgRes = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configPayload)
        });
        const cfgData = await cfgRes.json().catch(() => ({}));
        if (!cfgRes.ok || !cfgData.success) {
            throw new Error(cfgData.error || 'Failed to restore configuration.');
        }

        let bookingSummary = '';
        if (Array.isArray(parsed.bookings) && parsed.bookings.length > 0) {
            if (confirm('Settings restored! Also import ' + parsed.bookings.length + ' bookings from "' + file.name + '"? (Existing bookings are automatically skipped.)')) {
                const impRes = await fetch('/api/bookings/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookings: parsed.bookings })
                });
                const impData = await impRes.json().catch(() => ({}));
                if (impRes.ok && impData.success) {
                    bookingSummary = `\nBookings added: ${impData.addedCount || 0} (duplicates skipped: ${impData.duplicatesBlocked || 0})`;
                }
            }
        }

        try { localStorage.removeItem('trikaldarshi_config'); } catch (e) {}
        if (typeof window.populateConfigData === 'function') await window.populateConfigData();
        if (typeof window.loadBookings === 'function') await window.loadBookings();
        alert('Backup restored successfully!' + bookingSummary);
    } catch (e) {
        console.error('Restore failed:', e);
        alert('Could not restore backup: ' + e.message);
    } finally {
        input.value = '';
    }
};
