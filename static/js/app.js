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

    // Waitlist form (landing page) - show success only on submit
    const wlForm = document.getElementById('waitlist-form');
    if (wlForm) {
        wlForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const success = document.getElementById('waitlist-success');
            if (success) success.style.display = 'flex';
            wlForm.reset();
            wlForm.style.display = 'none';
        });
    }

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

    const isUpscaler = (m) => m === 'wavespeed-ai/image-upscaler';

    // Upscaler-related DOM
    const promptSection = document.getElementById('prompt-section');
    const upscalerSection = document.getElementById('upscaler-section');
    const upscalerFile = document.getElementById('upscaler-file');
    const upscalerDropzone = document.getElementById('upscaler-dropzone');
    const upscalerFileLabel = document.getElementById('upscaler-file-label');
    const upscalerPreviewWrap = document.getElementById('upscaler-preview-wrap');
    const upscalerPreview = document.getElementById('upscaler-preview');
    const upscalerRemove = document.getElementById('upscaler-remove');

    let uploadedImageBase64 = null;
    let upscalerResolution = '2k';
    let upscalerFormat = 'jpeg';

    // Progress Bar Logic
    let progressInterval = null;
    let progressVal = 0;

    function startProgress(isUpscalerModel) {
        progressVal = 0;
        const progressContainer = document.getElementById('showcase-progress-container');
        const progressBar = document.getElementById('showcase-progress-bar');
        const progressStatus = document.getElementById('showcase-progress-status');
        const progressPercent = document.getElementById('showcase-progress-percent');
        
        if (!progressContainer || !progressBar || !progressStatus || !progressPercent) return;
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressBar.style.background = 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)';
        progressStatus.textContent = isUpscalerModel ? 'Uploading image...' : 'Contacting AI gateway...';
        
        const totalSeconds = isUpscalerModel ? 65 : 20;
        const intervalMs = 250;
        const increment = (100 / (totalSeconds * 1000 / intervalMs)) * 0.95; // increment slowly up to 95%
        
        if (progressInterval) clearInterval(progressInterval);
        
        progressInterval = setInterval(() => {
            if (progressVal < 95) {
                progressVal += increment;
                const displayVal = Math.min(Math.round(progressVal), 95);
                progressBar.style.width = `${displayVal}%`;
                progressPercent.textContent = `${displayVal}%`;
                
                // Update status text based on percentage
                if (isUpscalerModel) {
                    if (displayVal < 15) progressStatus.textContent = 'Uploading media...';
                    else if (displayVal < 30) progressStatus.textContent = 'Analyzing source image...';
                    else if (displayVal < 70) progressStatus.textContent = 'Upscaling pixels (2K/4K/8K)...';
                    else if (displayVal < 88) progressStatus.textContent = 'Enhancing texture details...';
                    else progressStatus.textContent = 'Finalizing upscaled file...';
                } else {
                    if (displayVal < 15) progressStatus.textContent = 'Contacting AI gateway...';
                    else if (displayVal < 40) progressStatus.textContent = 'Generating layout structure...';
                    else if (displayVal < 70) progressStatus.textContent = 'Injecting textures & colors...';
                    else if (displayVal < 90) progressStatus.textContent = 'Adding fine details...';
                    else progressStatus.textContent = 'Finalizing rendering...';
                }
            }
        }, intervalMs);
    }

    function completeProgress() {
        if (progressInterval) clearInterval(progressInterval);
        const progressContainer = document.getElementById('showcase-progress-container');
        const progressBar = document.getElementById('showcase-progress-bar');
        const progressPercent = document.getElementById('showcase-progress-percent');
        const progressStatus = document.getElementById('showcase-progress-status');
        
        if (progressBar && progressPercent && progressStatus) {
            progressBar.style.width = '100%';
            progressPercent.textContent = '100%';
            progressStatus.textContent = 'Download ready!';
        }
        
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
        }, 1200);
    }

    function failProgress(errorMsg) {
        if (progressInterval) clearInterval(progressInterval);
        const progressContainer = document.getElementById('showcase-progress-container');
        const progressBar = document.getElementById('showcase-progress-bar');
        const progressPercent = document.getElementById('showcase-progress-percent');
        const progressStatus = document.getElementById('showcase-progress-status');
        
        if (progressBar && progressPercent && progressStatus) {
            progressBar.style.background = '#EF4444'; // Red for failure
            progressBar.style.width = '100%';
            progressPercent.textContent = 'Error';
            progressStatus.textContent = errorMsg || 'Generation failed';
        }
        
        setTimeout(() => {
            if (progressContainer) {
                progressContainer.style.display = 'none';
                progressBar.style.background = 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)';
            }
        }, 4000);
    }

    function applyModelMode() {
        if (isUpscaler(selectedModel)) {
            if (promptSection) promptSection.style.display = 'none';
            if (upscalerSection) upscalerSection.style.display = 'block';
            if (btnGenerate) btnGenerate.textContent = 'Upscale Image';
        } else {
            if (promptSection) promptSection.style.display = 'block';
            if (upscalerSection) upscalerSection.style.display = 'none';
            if (btnGenerate) btnGenerate.textContent = 'Generate Image';
        }
    }

    // Model options click selection
    modelOptions.forEach(option => {
        option.addEventListener('click', () => {
            modelOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            selectedModel = option.dataset.model;
            applyModelMode();
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
            'wavespeed-ai/image-upscaler': 'DiGi Image Upscaler'
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
                if (status === 'pending') {
                    showToast('This generation is still processing. Please wait...', 'info');
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

    // Upscaler: file selection + preview
    if (upscalerFile) {
        upscalerFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                uploadedImageBase64 = ev.target.result; // full data URL
                upscalerPreview.src = uploadedImageBase64;
                upscalerPreviewWrap.style.display = 'block';
                upscalerFileLabel.textContent = file.name;
            };
            reader.readAsDataURL(file);
        });
    }
    if (upscalerRemove) {
        upscalerRemove.addEventListener('click', () => {
            uploadedImageBase64 = null;
            upscalerFile.value = '';
            upscalerPreviewWrap.style.display = 'none';
            upscalerFileLabel.textContent = 'Drag & drop or click to upload an image';
        });
    }
    // Resolution + format selectors
    document.querySelectorAll('.upscale-res-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.upscale-res-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.02)';
                b.style.color = 'var(--text-secondary)';
            });
            btn.classList.add('active');
            btn.style.background = 'rgba(99,102,241,0.15)';
            btn.style.color = 'var(--primary)';
            upscalerResolution = btn.dataset.value;
        });
    });
    document.querySelectorAll('.upscale-fmt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.upscale-fmt-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.02)';
                b.style.color = 'var(--text-secondary)';
            });
            btn.classList.add('active');
            btn.style.background = 'rgba(99,102,241,0.15)';
            btn.style.color = 'var(--primary)';
            upscalerFormat = btn.dataset.value;
        });
    });
    // Drag & drop on dropzone
    if (upscalerDropzone && upscalerFile) {
        ['dragover', 'dragenter'].forEach(ev => upscalerDropzone.addEventListener(ev, (e) => {
            e.preventDefault();
            upscalerDropzone.style.borderColor = 'var(--primary)';
        }));
        ['dragleave', 'drop'].forEach(ev => upscalerDropzone.addEventListener(ev, (e) => {
            e.preventDefault();
            upscalerDropzone.style.borderColor = 'var(--border-color)';
        }));
        upscalerDropzone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                upscalerFile.files = e.dataTransfer.files;
                upscalerFile.dispatchEvent(new Event('change'));
            }
        });
    }

    // Image generation handler
    btnGenerate.addEventListener('click', async () => {
        // Upscaler path: require an uploaded image, no prompt needed
        if (isUpscaler(selectedModel)) {
            if (!uploadedImageBase64) {
                showToast('Please upload an image to upscale!', 'error');
                return;
            }
        }

        const prompt = promptInput.value.trim();
        if (!isUpscaler(selectedModel) && !prompt) {
            showToast('Please enter a prompt first!', 'error');
            return;
        }

        // 1. Prepare UI state: loading
        btnGenerate.disabled = true;
        btnGenerate.textContent = isUpscaler(selectedModel) ? 'Upscaling...' : 'Generating...';
        
        showcaseImage.style.display = 'none';
        showcaseMeta.style.display = 'none';
        showcasePlaceholder.style.display = 'none';
        
        showcaseSpinner.style.display = 'block';
        showcaseLoadingText.style.display = 'none';
        document.getElementById('generation-showcase').classList.remove('has-image');
        
        startProgress(isUpscaler(selectedModel));

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(isUpscaler(selectedModel)
                    ? {
                        model: selectedModel,
                        image: uploadedImageBase64,
                        target_resolution: upscalerResolution,
                        output_format: upscalerFormat
                      }
                    : {
                        prompt: prompt,
                        model: selectedModel
                      })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseErr) {
                // Server returned non-JSON (e.g. an HTML 500 page)
                const text = await response.text().catch(() => '');
                throw new Error(text.slice(0, 200) || 'Server returned an invalid response');
            }

            if (!response.ok || !data.success) {
                throw new Error((data && data.message) || 'An error occurred during generation');
            }

            // 2. Success state
            showToast('Image generated successfully!');
            completeProgress();
            showcaseSpinner.style.display = 'none';
            
            // Render to Showcase
            previewImage({
                url: data.image_url,
                prompt: isUpscaler(selectedModel)
                    ? `Upscaled image (${upscalerResolution}, ${upscalerFormat.toUpperCase()})`
                    : prompt,
                model: selectedModel
            });

            // Update credit count
            if (creditCount) {
                creditCount.textContent = data.credits_left;
            }

            // Clear inputs
            promptInput.value = '';
            if (isUpscaler(selectedModel) && typeof uploadedImageBase64 !== 'undefined') {
                uploadedImageBase64 = null;
                if (upscalerFile) upscalerFile.value = '';
                if (upscalerPreviewWrap) upscalerPreviewWrap.style.display = 'none';
                if (upscalerFileLabel) upscalerFileLabel.textContent = 'Drag & drop or click to upload an image';
            }

            // Add item to gallery grid dynamically
            if (galleryGrid) {
                // Remove empty state if present
                if (galleryEmpty) {
                    galleryEmpty.remove();
                }

                const cardId = data.gen_id || Date.now();
                const newCard = document.createElement('div');
                newCard.className = 'gallery-card';
                newCard.dataset.id = cardId;
                newCard.dataset.prompt = isUpscaler(selectedModel)
                    ? `Upscaled image (${upscalerResolution}, ${upscalerFormat.toUpperCase()})`
                    : prompt;
                newCard.dataset.model = selectedModel;
                newCard.dataset.url = data.image_url;
                newCard.dataset.status = 'completed';
                newCard.dataset.error = '';
                
                newCard.innerHTML = `
                    <!-- Delete Button -->
                    <button class="btn-delete-gen" data-id="${cardId}" title="Delete creation" style="position: absolute; top: 0.6rem; right: 0.6rem; z-index: 5; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 28px; height: 28px; display: flex; justify-content: center; align-items: center; cursor: pointer; color: #FFF; transition: all 0.2s ease; backdrop-filter: blur(4px);">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 0.95rem; height: 0.95rem; stroke: currentColor; fill: none; stroke-width: 2;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                    <div class="gallery-img-wrapper">
                        <img src="${data.image_url}" class="gallery-img" alt="Gallery image">
                    </div>
                    <span class="status-badge completed">completed</span>
                    <div class="gallery-info">
                        <div class="gallery-prompt">${isUpscaler(selectedModel) ? `Upscaled image (${upscalerResolution}, ${upscalerFormat.toUpperCase()})` : prompt}</div>
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
     
     // Theme toggle functionality
     const themeToggleBtn = document.getElementById('theme-toggle');
     if (themeToggleBtn) {
         themeToggleBtn.addEventListener('click', () => {
             const body = document.body;
             const isDark = body.classList.toggle('dark-mode');
             localStorage.setItem('theme', isDark ? 'dark' : 'light');
             updateThemeIcon();
         });
         
         // Initialize theme from localStorage (default to dark mode)
         const savedTheme = localStorage.getItem('theme');
         if (savedTheme === 'light') {
             document.body.classList.remove('dark-mode');
         } else {
             document.body.classList.add('dark-mode');
         }
         updateThemeIcon();
         
         function updateThemeIcon() {
             const isDark = document.body.classList.contains('dark-mode');
             const icon = themeToggleBtn.querySelector('.svg-icon path');
             if (isDark) {
                 // Moon icon
                 updateIconPath('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
             } else {
                 // Sun icon
                 updateIconPath('M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2');
             }
         }
         
         function updateIconPath(path) {
             const icon = themeToggleBtn.querySelector('.svg-icon path');
             if (icon) {
                 icon.setAttribute('d', path);
             }
         }
     }
            }

        } catch (error) {
            showToast(error.message, 'error');
            failProgress(error.message);
            
            // Revert UI to placeholder
            showcaseSpinner.style.display = 'none';
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

    // Event delegation for delete buttons in the gallery grid
    if (galleryGrid) {
        galleryGrid.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-delete-gen');
            if (!btn) return;
            
            e.stopPropagation(); // Prevent triggering previewImage click
            
            const genId = btn.dataset.id;
            if (!genId || genId === 'undefined') {
                showToast('Cannot delete this creation (missing ID)', 'error');
                return;
            }
            
            if (confirm('Are you sure you want to delete this creation?')) {
                try {
                    const res = await fetch('/api/generations/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gen_id: parseInt(genId) })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        showToast(data.message);
                        const card = btn.closest('.gallery-card');
                        if (card) {
                            card.style.opacity = '0';
                            card.style.transform = 'scale(0.8)';
                            card.style.transition = 'all 0.3s ease';
                            setTimeout(() => {
                                card.remove();
                                const count = galleryGrid.querySelectorAll('.gallery-card').length;
                                if (galleryCountLabel) {
                                    galleryCountLabel.textContent = `${count} creation${count !== 1 ? 's' : ''}`;
                                }
                                if (count === 0) {
                                    const emptyDiv = document.createElement('div');
                                    emptyDiv.id = 'gallery-empty';
                                    emptyDiv.style = 'text-align: center; padding: 4rem 2rem; background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color); color: var(--text-secondary);';
                                    emptyDiv.innerHTML = '<p>No previous generations found. Start generating now!</p>';
                                    galleryGrid.parentNode.insertBefore(emptyDiv, galleryGrid.nextSibling);
                                }
                            }, 300);
                        }
                    } else {
                        showToast(data.message || 'Failed to delete creation', 'error');
                    }
                } catch (err) {
                    showToast(err.message, 'error');
                }
            }
        });
    }
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
            const wavespeedApiKey = document.getElementById('settings-wavespeed-api-key').value.trim();
            
            const ipLockInput = document.getElementById('settings-ip-lock');
            const regCreditsInput = document.getElementById('settings-reg-credits');
            
            const ipLockEnabled = ipLockInput ? ipLockInput.checked : false;
            const registrationCredits = regCreditsInput ? parseInt(regCreditsInput.value) || 1 : 1;

            try {
                const res = await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: apiKey,
                        base_url: baseUrl,
                        protocol: protocol,
                        hive_api_key: hiveApiKey,
                        wavespeed_api_key: wavespeedApiKey,
                        ip_lock_enabled: ipLockEnabled,
                        registration_credits: registrationCredits
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
