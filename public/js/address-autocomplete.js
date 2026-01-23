document.addEventListener('DOMContentLoaded', () => {
    const addressInput = document.getElementById('customer_address2');
    const zipcodeInput = document.getElementById('customer_zipcode');
    let timeoutId = null;

    if (!addressInput) return;

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'address-results';
    resultsContainer.className = 'absolute z-10 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm hidden';
    addressInput.parentNode.style.position = 'relative'; // Ensure parent is relative
    addressInput.parentNode.appendChild(resultsContainer);

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
});
