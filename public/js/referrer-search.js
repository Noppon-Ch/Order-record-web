function openSearchModal() {
    document.getElementById('searchModal').classList.remove('hidden');
    document.getElementById('searchInput').focus();
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.add('hidden');
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchInput').value = '';
}

async function performSearch() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;

    const resultsDiv = document.getElementById('searchResults');
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
            li.onclick = () => selectReferrer(customer);
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
    document.getElementById('referrer_citizen_id').value = customer.customer_citizen_id;
    document.getElementById('referrer_name').value = `${customer.customer_fname_th} ${customer.customer_lname_th}`;
    closeSearchModal();
}

// Allow Enter key to search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', function (event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
    }
});
