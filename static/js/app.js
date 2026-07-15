// Toast notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : '❌'}</span>
        <div>${message}</div>
    `;

    container.appendChild(toast);

    // Auto remove toast
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Check which page we are on
    const isDashboard = document.getElementById('prompt-input') !== null;
    const isAdmin = document.getElementById('admin-tabs') !== null;

    if (isDashboard) {
        initDashboard();
    }

    if (isAdmin) {
        initAdmin();
    }
});

// --- Dashboard Logic ---
function initDashboard() {
    const promptInput = document.getElementById('prompt-input');
    const modelOptions = document.querySelectorAll('.model-option');
    const btnGenerate = document.getElementById('btn-generate');
    
    const showcasePlaceholder = document.getElementById('showcase-placeholder');
    const showcaseSpinner = document.getElementById('showcase-spinner');
    const showcaseLoadingText = document.getElementById('showcase-loading-text');
    const showcaseImage = document.getElementById('showcase-image');
    const showcaseMeta = document.getElementById('showcase-meta');
    const showcaseMetaPrompt = document.getElementById('showcase-meta-prompt');
    const showcaseMetaModel = document.getElementById('showcase-meta-model');
    const btnCopyPrompt = document.getElementById('btn-copy-prompt');
    const btnDownload = document.getElementById('btn-download');
    
    const creditCount = document.getElementById('credit-count');
    const galleryGrid = document.getElementById('gallery-grid');
    const galleryCountLabel = document.getElementById('gallery-count-label');
    const galleryEmpty = document.getElementById('gallery-empty');

    let selectedModel = 'klingai/kling-v2';

    // Model options click selection
    modelOptions.forEach(option => {
        option.addEventListener('click', () => {
            modelOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            selectedModel = option.dataset.model;
        });
    });

    // Copy Prompt functionality
    if (btnCopyPrompt) {
        btnCopyPrompt.addEventListener('click', () => {
            const promptText = showcaseMetaPrompt.textContent;
            navigator.clipboard.writeText(promptText).then(() => {
                showToast('Prompt copied to clipboard!');
            }).catch(err => {
                showToast('Failed to copy prompt', 'error');
            });
        });
    }

    function getModelDisplayName(modelSlug) {
        const mapping = {
            'hive/flux-schnell-enhanced': 'DiGi Vision Pro',
            'hive/flux-schnell-emoji': 'DiGi Emoji Studio',
            'hive/sdxl-enhanced': 'DiGi Canvas Pro',
            'klingai/kling-v2': 'Kling AI V2',
            'tencent/hy-image-v3.0': 'Hunyuan V3.0',
            'z-ai/glm-image': 'GLM Image',
            'bytedance/doubao-seedream-5.0-lite': 'Doubao Seedream',
            'baidu/ernie-image-turbo': 'Ernie Image Turbo',
            'black-forest-labs/flux-schnell': 'Flux Schnell',
            'stabilityai/sdxl': 'Stable Diffusion XL',
            'wavespeed-ai/image-upscaler': 'Wavespeed AI Image Upscaler'
        };
        return mapping[modelSlug] || modelSlug;
    }

    // Showcase preview function for gallery cards
    function previewImage(data) {
        // Hide placeholder and spinner
        showcasePlaceholder.style.display = 'none';
        showcaseSpinner.style.display = 'none';
        showcaseLoadingText.style.display = 'none';
        
        // Show image and meta details
        showcaseImage.src = data.url;
        showcaseImage.style.display = 'block';
        
        // Set metadata
        showcaseMetaPrompt.textContent = data.prompt;
        showcaseMetaModel.textContent = `Model: ${getModelDisplayName(data.model)}`;
        btnDownload.href = data.url;
        
        showcaseMeta.style.display = 'flex';
        document.getElementById('generation-showcase').classList.add('has-image');
    }

    // Attach click events to existing gallery cards
    function attachGalleryCardEvents() {
        const cards = document.querySelectorAll('.gallery-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const status = card.dataset.status;
                if (status === 'failed') {
                    showToast(`Generation failed: ${card.dataset.error || 'Unknown error'}`, 'error');
                    return;
                }
                previewImage({
                    url: card.dataset.url,
                    prompt: card.dataset.prompt,
                    model: card.dataset.model
                });
            });
        });
    }
    
    attachGalleryCardEvents();

    // Image generation handler
    btnGenerate.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showToast('Please enter a prompt first!', 'error');
            return;
        }

        // 1. Prepare UI state: loading
        btnGenerate.disabled = true;
        btnGenerate.textContent = 'Generating...';
        
        showcaseImage.style.display = 'none';
        showcaseMeta.style.display = 'none';
        showcasePlaceholder.style.display = 'none';
        
        showcaseSpinner.style.display = 'block';
        showcaseLoadingText.style.display = 'block';
        document.getElementById('generation-showcase').classList.remove('has-image');

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    model: selectedModel
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'An error occurred during generation');
            }

            // 2. Success state
            showToast('Image generated successfully!');
            
            // Render to Showcase
            previewImage({
                url: data.image_url,
                prompt: prompt,
                model: selectedModel
            });

            // Update credit count
            if (creditCount) {
                creditCount.textContent = data.credits_left;
            }

            // Clear prompt input
            promptInput.value = '';

            // Add item to gallery grid dynamically
            if (galleryGrid) {
                // Remove empty state if present
                if (galleryEmpty) {
                    galleryEmpty.remove();
                }

                const cardId = 'gen_' + Date.now();
                const newCard = document.createElement('div');
                newCard.className = 'gallery-card';
                newCard.dataset.id = cardId;
                newCard.dataset.prompt = prompt;
                newCard.dataset.model = selectedModel;
                newCard.dataset.url = data.image_url;
                newCard.dataset.status = 'completed';
                newCard.dataset.error = '';
                
                newCard.innerHTML = `
                    <div class="gallery-img-wrapper">
                        <img src="${data.image_url}" class="gallery-img" alt="Gallery image">
                    </div>
                    <span class="status-badge completed">completed</span>
                    <div class="gallery-info">
                        <div class="gallery-prompt">${prompt}</div>
                        <div class="gallery-model">${getModelDisplayName(selectedModel)}</div>
                    </div>
                `;

                // Insert at the beginning of the gallery
                galleryGrid.insertBefore(newCard, galleryGrid.firstChild);

                // Update counter label
                const count = galleryGrid.children.length;
                if (galleryCountLabel) {
                    galleryCountLabel.textContent = `${count} creation${count !== 1 ? 's' : ''}`;
                }

                // Re-bind click events
                attachGalleryCardEvents();
            }

        } catch (error) {
            showToast(error.message, 'error');
            
            // Revert UI to placeholder
            showcaseSpinner.style.display = 'none';
            showcaseLoadingText.style.display = 'none';
            showcasePlaceholder.style.display = 'block';
            
            // Reload page if credentials updated or to sync credits
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } finally {
            btnGenerate.disabled = false;
            btnGenerate.textContent = '✨ Generate Image';
        }
    });

    // Buy Credits Modal logic
    const buyCreditsModal = document.getElementById('buy-credits-modal');
    const btnBuyCredits = document.getElementById('btn-buy-credits');
    const buyCreditsClose = document.getElementById('buy-credits-close');
    
    if (btnBuyCredits && buyCreditsModal) {
        btnBuyCredits.addEventListener('click', (e) => {
            e.preventDefault();
            buyCreditsModal.style.display = 'flex';
        });
    }
    
    if (buyCreditsClose) {
        buyCreditsClose.addEventListener('click', () => {
            buyCreditsModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === buyCreditsModal) {
            buyCreditsModal.style.display = 'none';
        }
    });
}

// --- Admin Panel Logic ---
function initAdmin() {
    // 1. Tab Switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // 2. Modals Control
    const creditsModal = document.getElementById('credits-modal');
    const creditsModalClose = document.getElementById('credits-modal-close');
    const btnCancelCredits = document.getElementById('btn-cancel-credits');
    const creditsUpdateForm = document.getElementById('credits-update-form');
    
    const creditsUserIdInput = document.getElementById('credits-user-id');
    const creditsAmountInput = document.getElementById('credits-amount');
    const creditsModalSubtitle = document.getElementById('credits-modal-subtitle');

    function openCreditsModal(userId, username, currentCredits) {
        creditsUserIdInput.value = userId;
        creditsAmountInput.value = currentCredits;
        creditsModalSubtitle.textContent = `Update credits balance for user: ${username}`;
        creditsModal.style.display = 'flex';
    }

    function closeCreditsModal() {
        creditsModal.style.display = 'none';
    }

    if (creditsModalClose) creditsModalClose.addEventListener('click', closeCreditsModal);
    if (btnCancelCredits) btnCancelCredits.addEventListener('click', closeCreditsModal);
    window.addEventListener('click', (e) => {
        if (e.target === creditsModal) closeCreditsModal();
    });

    // 3. User operations event delegation
    const tableBody = document.getElementById('users-table-body');
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const target = e.target;
            
            // Edit Credits click
            if (target.classList.contains('edit-credits-btn')) {
                const userId = target.dataset.userId;
                const username = target.dataset.username;
                const currentCredits = target.dataset.credits;
                openCreditsModal(userId, username, currentCredits);
            }
            
            // Toggle Role click
            if (target.classList.contains('toggle-role-btn')) {
                const userId = target.dataset.userId;
                const currentStatus = parseInt(target.dataset.adminStatus);
                const newStatus = currentStatus === 1 ? 0 : 1;
                
                if (confirm(`Are you sure you want to change this user's admin status?`)) {
                    try {
                        const response = await fetch('/api/role-update-placeholder-if-changed', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: parseInt(userId), is_admin: newStatus })
                        });
                        
                        // We use /api/admin/role
                        const res = await fetch('/api/admin/role', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: parseInt(userId), is_admin: newStatus })
                        });
                        
                        const data = await res.json();
                        if (res.ok && data.success) {
                            showToast(data.message);
                            setTimeout(() => window.location.reload(), 1000);
                        } else {
                            showToast(data.message || 'Failed to update role', 'error');
                        }
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                }
            }
            
            // Delete User click
            if (target.classList.contains('delete-user-btn')) {
                const userId = target.dataset.userId;
                const username = target.dataset.username;
                
                if (confirm(`⚠️ WARNING: Are you sure you want to permanently delete user "${username}"? All their generation history will be lost.`)) {
                    try {
                        const res = await fetch('/api/admin/delete-user', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: parseInt(userId) })
                        });
                        
                        const data = await res.json();
                        if (res.ok && data.success) {
                            showToast(data.message);
                            // Remove row from table
                            const row = document.querySelector(`tr[data-user-id="${userId}"]`);
                            if (row) row.remove();
                        } else {
                            showToast(data.message || 'Failed to delete user', 'error');
                        }
                    } catch (err) {
                        showToast(err.message, 'error');
                    }
                }
            }
        });
    }

    // 4. Submit credit updates
    if (creditsUpdateForm) {
        creditsUpdateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = parseInt(creditsUserIdInput.value);
            const amount = parseInt(creditsAmountInput.value);

            try {
                const res = await fetch('/api/admin/credits', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, credits: amount })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(data.message);
                    closeCreditsModal();
                    
                    // Live update the value in table
                    const row = document.querySelector(`tr[data-user-id="${userId}"]`);
                    if (row) {
                        row.querySelector('.user-credits').textContent = amount;
                        // Update dataset attribute of button
                        const btn = row.querySelector('.edit-credits-btn');
                        if (btn) btn.dataset.credits = amount;
                    }
                } else {
                    showToast(data.message || 'Failed to update credits', 'error');
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // 5. Submit Settings form
    const settingsForm = document.getElementById('settings-config-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('settings-api-key').value.trim();
            const hiveApiKey = document.getElementById('settings-hive-api-key').value.trim();
            const baseUrl = document.getElementById('settings-base-url').value.trim();
            const protocol = document.getElementById('settings-protocol').value;

            try {
                const res = await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: apiKey,
                        base_url: baseUrl,
                        protocol: protocol,
                        hive_api_key: hiveApiKey
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast('Settings saved and applied successfully!');
                } else {
                    showToast(data.message || 'Failed to save settings', 'error');
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // 6. Create User Modal and Form handling
    const createUserModal = document.getElementById('create-user-modal');
    const btnCreateUserModal = document.getElementById('btn-create-user-modal');
    const createUserModalClose = document.getElementById('create-user-modal-close');
    const btnCancelCreateUser = document.getElementById('btn-cancel-create-user');
    const createUserForm = document.getElementById('create-user-form');

    if (btnCreateUserModal && createUserModal) {
        btnCreateUserModal.addEventListener('click', () => {
            createUserForm.reset();
            document.getElementById('create-credits').value = 1; // Default to 1
            createUserModal.style.display = 'flex';
        });
    }

    function closeCreateUserModal() {
        if (createUserModal) createUserModal.style.display = 'none';
    }

    if (createUserModalClose) createUserModalClose.addEventListener('click', closeCreateUserModal);
    if (btnCancelCreateUser) btnCancelCreateUser.addEventListener('click', closeCreateUserModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === createUserModal) closeCreateUserModal();
    });

    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('create-username').value.trim();
            const email = document.getElementById('create-email').value.trim();
            const password = document.getElementById('create-password').value;
            const credits = parseInt(document.getElementById('create-credits').value);
            const isAdmin = document.getElementById('create-is-admin').checked ? 1 : 0;

            try {
                const res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        email: email,
                        password: password,
                        credits: credits,
                        is_admin: isAdmin
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    showToast(data.message);
                    closeCreateUserModal();
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    showToast(data.message || 'Failed to create user', 'error');
                }
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }
}
