document.addEventListener('DOMContentLoaded', () => {
    initReferrerSearch();
    initAddressAutocomplete();
});

// --- Referrer Search Logic ---
function initReferrerSearch() {
    const openBtn = document.getElementById('openSearchModalBtn');
    const closeOverlay = document.getElementById('closeSearchModalOverlay');
    const closeBtn = document.getElementById('closeSearchModalBtn');
    const searchBtn = document.getElementById('performSearchBtn');
    const searchInput = document.getElementById('searchInput');

    if (openBtn) openBtn.addEventListener('click', openSearchModal);
    if (closeOverlay) closeOverlay.addEventListener('click', closeSearchModal);
    if (closeBtn) closeBtn.addEventListener('click', closeSearchModal);
    if (searchBtn) searchBtn.addEventListener('click', performSearch);

    // Allow Enter key to search
    if (searchInput) {
        searchInput.addEventListener('keyup', function (event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
    }
}

function openSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('searchInput');
    if (input) input.focus();
}

function closeSearchModal() {
    const modal = document.getElementById('searchModal');
    if (modal) modal.classList.add('hidden');

    const results = document.getElementById('searchResults');
    if (results) results.innerHTML = '';

    const input = document.getElementById('searchInput');
    if (input) input.value = '';
}

async function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    const query = searchInput.value;
    if (!query) return;

    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<p class="text-sm text-gray-500">Searching...</p>';

    try {
        const response = await fetch(`/customer/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        resultsDiv.innerHTML = '';

        if (data.length === 0) {
            resultsDiv.innerHTML = '<p class="text-sm text-gray-500">No results found.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'divide-y divide-gray-200';

        data.forEach(customer => {
            const li = document.createElement('li');
            li.className = 'py-2 flex justify-between items-center cursor-pointer hover:bg-gray-50';

            // Using addEventListener instead of onclick (though onclick property IS CSP safe, listeners are better practice)
            li.addEventListener('click', () => selectReferrer(customer));

            li.innerHTML = `
                <div class="text-sm">
                    <p class="font-medium text-gray-900">${customer.customer_fname_th} ${customer.customer_lname_th}</p>
                    <p class="text-gray-500">${customer.customer_citizen_id}</p>
                </div>
                <button type="button" class="ml-4 bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">Select</button>
            `;
            ul.appendChild(li);
        });

        resultsDiv.appendChild(ul);
    } catch (error) {
        console.error('Error searching:', error);
        resultsDiv.innerHTML = '<p class="text-sm text-red-500">Error occurred while searching.</p>';
    }
}

function selectReferrer(customer) {
    const idInput = document.getElementById('referrer_citizen_id');
    const nameInput = document.getElementById('referrer_name');

    if (idInput) idInput.value = customer.customer_citizen_id;
    if (nameInput) nameInput.value = `${customer.customer_fname_th} ${customer.customer_lname_th}`;

    closeSearchModal();
}

// --- Address Autocomplete Logic ---
function initAddressAutocomplete() {
    const addressInput = document.getElementById('customer_address2');
    const zipcodeInput = document.getElementById('customer_zipcode');
    let timeoutId = null;

    if (!addressInput) return;

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'address-results';
    resultsContainer.className = 'absolute z-10 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm hidden';

    if (addressInput.parentNode) {
        addressInput.parentNode.style.position = 'relative'; // Ensure parent is relative
        addressInput.parentNode.appendChild(resultsContainer);
    }

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
        if (!addressInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    });

    addressInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (timeoutId) clearTimeout(timeoutId);

        if (query.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }

        // Debounce search
        timeoutId = setTimeout(async () => {
            try {
                const response = await fetch(`/customer/search-address?q=${encodeURIComponent(query)}`);
                const data = await response.json();

                resultsContainer.innerHTML = '';

                if (data.length > 0) {
                    const ul = document.createElement('ul');
                    ul.className = 'divide-y divide-gray-100';

                    data.forEach(item => {
                        const li = document.createElement('li');
                        li.className = 'cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 text-gray-900';
                        li.textContent = item.full_locate;
                        li.onclick = () => {
                            addressInput.value = item.full_locate;
                            if (zipcodeInput) zipcodeInput.value = item.zipcode;
                            resultsContainer.classList.add('hidden');
                        };
                        ul.appendChild(li);
                    });
                    resultsContainer.appendChild(ul);
                    resultsContainer.classList.remove('hidden');
                } else {
                    resultsContainer.classList.add('hidden');
                }
            } catch (error) {
                console.error('Error fetching address:', error);
            }
        }, 300); // 300ms delay
    });
}
