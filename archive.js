import { DOM, PORTFOLIO_DATA, STATE } from './constants.js';
import { setScreen, openExternalLink } from './utils.js';
import { openModelInspector } from './inspector.js';

export function showArchive() {
    // If it hasn't been rendered yet, do so
    if (DOM.archiveContent.innerHTML === '' || STATE.archiveRendered !== true) {
        renderPortfolioArchive();
        STATE.archiveRendered = true;
    }
    setScreen('archive-menu');
}

export function openVideoPopup(embedUrl, title) {
    DOM.popupTitle.textContent = title;
    DOM.popupContent.innerHTML = `
        <div class="aspect-w-16 w-full">
            <iframe 
                src="${embedUrl}" 
                allow="autoplay; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen 
                class="w-full h-full rounded-lg"
                onerror="this.outerHTML='<p class=\\'text-red-400\\'>Error loading video embed. Check the URL.</p>'"
                >
            </iframe>
        </div>
        <p class="mt-4 text-sm text-gray-400">Video content is hosted externally (e.g., YouTube/Vimeo). Use [B] to close.</p>
    `;
    setScreen('popup-ui');
}


export function renderPortfolioArchive() {
    DOM.archiveContent.innerHTML = '';
    DOM.archiveNav.innerHTML = '';

    PORTFOLIO_DATA.forEach(categoryData => {
        // 1. Create Navigation Link
        const navLink = document.createElement('a');
        navLink.href = `#${categoryData.id}`;
        navLink.textContent = categoryData.category;
        // Updated styling for PS1 theme
        navLink.className = 'hover:text-red-500 transition-colors block retro-text-shadow';
        DOM.archiveNav.appendChild(navLink);

        // 2. Create Section Header
        const section = document.createElement('section');
        section.id = categoryData.id;
        // Updated styling for PS1 theme
        section.className = 'mb-12 pt-10 border-b border-red-700/30 pb-4';
        
        section.innerHTML = `
            <h3 class="text-4xl font-light text-red-500 mb-2 retro-text-shadow">${categoryData.category}</h3>
            <p class="text-gray-400 mb-6">${categoryData.description}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="grid-${categoryData.id}">
                <!-- Items go here -->
            </div>
        `;
        DOM.archiveContent.appendChild(section);

        // 3. Populate Grid Items
        const grid = section.querySelector(`#grid-${categoryData.id}`);
        categoryData.items.forEach(item => {
            const itemDiv = document.createElement('div');
            // Updated styling for PS1 theme
            itemDiv.className = 'archive-item bg-gray-900 rounded-lg overflow-hidden shadow-lg border-2 border-red-900/50';
            
            let action;
            let label;

            if (item.type === 'model') {
                // Must expose global functions for inline HTML event handlers
                action = `window.App.openModelInspector('${item.modelUrl}', '${item.title}')`;
                label = 'Click to Inspect 3D';
            } else if (item.type === 'link') {
                action = `window.App.openExternalLink('${item.url}')`;
                label = 'Click to Open External Link';
            } else { 
                action = `window.App.openVideoPopup('${item.embedUrl}', '${item.title}')`;
                label = '▶';
            }

            itemDiv.setAttribute('onclick', action);

            itemDiv.innerHTML = `
                <div class="aspect-w-16 w-full relative">
                    <img src="${item.thumbnail}" alt="${item.title}" class="w-full h-full object-cover">
                    <div class="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-3xl opacity-0 hover:opacity-100 transition-opacity retro-text-shadow">
                        ${label}
                    </div>
                </div>
                <div class="p-3">
                    <h4 class="text-lg font-semibold text-red-500 retro-text-shadow">${item.title}</h4>
                    <p class="text-sm text-gray-500">${categoryData.category}</p>
                </div>
            `;
            grid.appendChild(itemDiv);
        });
    });
}