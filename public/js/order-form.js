
// State to track which person field we are searching for ('referrer' or 'assistant')
let currentSearchType = null;
let currentActiveProductInput = null; // Track which input is currently searching for products

// --- Person Search (Referrer / Assistant) ---

function openPersonSearch(type) {
    currentSearchType = type;
    document.getElementById('personSearchModal').classList.remove('hidden');
    document.getElementById('personSearchInput').value = '';
    document.getElementById('personSearchResults').innerHTML = '';
    document.getElementById('personSearchInput').focus();
}

function closePersonSearch() {
    document.getElementById('personSearchModal').classList.add('hidden');
    currentSearchType = null;
}

async function performPersonSearch() {
    const query = document.getElementById('personSearchInput').value;
    if (!query) return;

    const resultsDiv = document.getElementById('personSearchResults');
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

        data.forEach(person => {
            const li = document.createElement('li');
            li.className = 'py-2 flex justify-between items-center cursor-pointer hover:bg-gray-50';
            li.onclick = () => selectPerson(person);
            li.innerHTML = `
                <div class="text-sm">
                    <p class="font-medium text-gray-900">${person.customer_fname_th} ${person.customer_lname_th}</p>
                    <p class="text-gray-500">${person.customer_citizen_id}</p>
                </div>
                <button type="button" class="ml-4 bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">Select</button>
            `;
            ul.appendChild(li);
        });

        resultsDiv.appendChild(ul);
    } catch (error) {
        console.error('Error searching person:', error);
        resultsDiv.innerHTML = '<p class="text-sm text-red-500">Error occurred.</p>';
    }
}

function selectPerson(person) {
    if (currentSearchType === 'referrer') {
        document.getElementById('referrer_id').value = person.customer_citizen_id;
        document.getElementById('referrer_name').value = `${person.customer_fname_th} ${person.customer_lname_th}`;
        document.getElementById('referrer_uuid').value = person.customer_id;
    } else if (currentSearchType === 'assistant') {
        document.getElementById('assistant_id').value = person.customer_citizen_id;
        document.getElementById('assistant_name').value = `${person.customer_fname_th} ${person.customer_lname_th}`;
        document.getElementById('assistant_uuid').value = person.customer_id;
    }
    closePersonSearch();
}

// Enter key for person search
document.getElementById('personSearchInput').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') performPersonSearch();
});


// --- Product List Management ---

function addProductRow() {
    const tbody = document.getElementById('productTableBody');
    const rowId = 'row-' + Date.now();
    const tr = document.createElement('tr');
    tr.id = rowId;

    // Note: No nested .product-suggestions div anymore
    tr.innerHTML = `
        <td class="px-3 py-4 whitespace-nowrap relative">
            <input type="text" name="product_code[]" class="product-code-input shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border uppercase" 
                placeholder="Code" oninput="handleProductCodeInput(this)" onblur="hideProductSuggestionsDelayed()" autocomplete="off">
        </td>
        <td class="px-3 py-4 whitespace-nowrap">
            <input type="number" name="quantity[]" value="1" min="1" class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-1 border text-center"
                onchange="calculateRow(this.closest('tr'))" onkeyup="calculateRow(this.closest('tr'))">
        </td>
        <td class="px-3 py-4 whitespace-nowrap">
            <input type="text" name="product_name[]" readonly class="shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md p-1 border text-gray-500">
            <input type="hidden" name="product_real_name[]">
            <input type="hidden" name="product_color[]">
            <input type="hidden" name="product_size[]">
        </td>
        <td class="px-3 py-4 whitespace-nowrap">
            <input type="number" name="price[]" readonly class="shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md p-1 border text-right text-gray-500">
        </td>
        <td class="px-3 py-4 whitespace-nowrap">
            <input type="text" name="total[]" readonly class="row-total shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md p-1 border text-right font-medium">
        </td>
        <td class="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button type="button" onclick="removeProductRow(this)" class="text-red-600 hover:text-red-900">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

function removeProductRow(btn) {
    const row = btn.closest('tr');
    row.remove();
    calculateTotals();
}

// --- Product Search & Calculation ---

let productSearchTimeout;

async function handleProductCodeInput(input) {
    currentActiveProductInput = input; // Store reference to current input
    input.value = input.value.toUpperCase();
    const query = input.value;
    const globalSuggestionsDiv = document.getElementById('globalProductSuggestions');

    if (!query) {
        globalSuggestionsDiv.classList.add('hidden');
        return;
    }

    // Position the dropdown (Absolute to document)
    const rect = input.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    globalSuggestionsDiv.style.top = `${rect.bottom + scrollTop}px`;
    globalSuggestionsDiv.style.left = `${rect.left + scrollLeft}px`;
    globalSuggestionsDiv.style.width = 'auto';
    globalSuggestionsDiv.style.minWidth = '400px';

    console.log('Searching product:', query);
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/products/search?q=${encodeURIComponent(query)}`);
            const products = await response.json();
            console.log('Product search results:', products);

            globalSuggestionsDiv.innerHTML = '';

            if (products.length > 0) {
                products.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50';
                    div.innerHTML = `<span class="block font-medium truncate">${p.product_code}</span>
                                     <span class="block text-xs text-gray-500 truncate">${p.product_name_th} (${p.color_th}/${p.product_size}) - ${p.price_per_unit}</span>`;
                    // Pass the product object directly, no need for input ref as we use currentActiveProductInput
                    div.onmousedown = (e) => { // Use onmousedown to fire before onblur
                        e.preventDefault(); // Prevent input blur
                        selectProduct(p);
                    };
                    globalSuggestionsDiv.appendChild(div);
                });
                globalSuggestionsDiv.classList.remove('hidden');
            } else {
                globalSuggestionsDiv.classList.add('hidden');
            }
        } catch (e) {
            console.error('Product search error', e);
        }
    }, 300);
}

function selectProduct(product) {
    if (!currentActiveProductInput) return;

    const input = currentActiveProductInput;
    const row = input.closest('tr');
    input.value = product.product_code;

    row.querySelector('input[name="product_name[]"]').value = `${product.product_name_th} (${product.color_th}/${product.product_size})`;
    row.querySelector('input[name="product_real_name[]"]').value = product.product_name_th;
    row.querySelector('input[name="product_color[]"]').value = product.color_th;
    row.querySelector('input[name="product_size[]"]').value = product.product_size;
    row.querySelector('input[name="price[]"]').value = product.price_per_unit;

    document.getElementById('globalProductSuggestions').classList.add('hidden');
    calculateRow(row);
    currentActiveProductInput = null;
}

function hideProductSuggestionsDelayed() {
    // Small delay to allow click on dropdown item to register if needed, 
    // though onmousedown + e.preventDefault() usually handles it better.
    setTimeout(() => {
        document.getElementById('globalProductSuggestions').classList.add('hidden');
    }, 200);
}

function calculateRow(row) {
    const qty = parseFloat(row.querySelector('input[name="quantity[]"]').value) || 0;
    const price = parseFloat(row.querySelector('input[name="price[]"]').value) || 0;
    const total = qty * price;

    row.querySelector('input[name="total[]"]').value = total.toFixed(2);
    calculateTotals();
}

function calculateTotals() {
    let subtotal = 0;
    document.querySelectorAll('.row-total').forEach(input => {
        subtotal += parseFloat(input.value) || 0;
    });

    // Discount Logic
    let discount = 0;
    if (subtotal > 20000) {
        discount = (subtotal - 20000) * 0.2;
    }

    const priceAfterDiscount = subtotal - discount;
    const tax = priceAfterDiscount * 0.07;
    const grandTotal = priceAfterDiscount + tax;

    document.getElementById('summary_subtotal').innerText = subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('summary_discount').innerText = discount.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('summary_after_discount').innerText = priceAfterDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('summary_tax').innerText = tax.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('summary_grand_total').innerText = grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

// Global listeners to hide dropdown
window.addEventListener('resize', () => {
    document.getElementById('globalProductSuggestions').classList.add('hidden');
});
// Remove scroll listener that was hiding the dropdown


// Initialize with one row
document.addEventListener('DOMContentLoaded', () => {
    addProductRow();

    // Form Submit Mockup
    // Form Submit
    document.getElementById('orderForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Collect Data
        const orderData = {
            order_customer_id: document.getElementById('customer_uuid').value,
            order_date: document.getElementById('order_date').value,
            order_total_amount: parseFloat(document.getElementById('summary_subtotal').innerText.replace(/,/g, '')),
            order_discount: parseFloat(document.getElementById('summary_discount').innerText.replace(/,/g, '')),
            order_price_before_tax: parseFloat(document.getElementById('summary_after_discount').innerText.replace(/,/g, '')),
            order_tax: parseFloat(document.getElementById('summary_tax').innerText.replace(/,/g, '')),
            order_final_price: parseFloat(document.getElementById('summary_grand_total').innerText.replace(/,/g, '')),

            // Optional Relations
            order_recommender_id: document.getElementById('referrer_uuid').value || null,
            order_assistant_id: document.getElementById('assistant_uuid').value || null,
            position: document.getElementById('buyer_position').value || null
        };

        // Collect Items
        const items = [];
        const rows = document.querySelectorAll('#productTableBody tr');
        rows.forEach(row => {
            const code = row.querySelector('input[name="product_code[]"]').value;
            if (code) {
                const realName = row.querySelector('input[name="product_real_name[]"]').value;
                const color = row.querySelector('input[name="product_color[]"]').value;
                const size = row.querySelector('input[name="product_size[]"]').value;

                items.push({
                    product_code: code,
                    product_name: realName,
                    product_color: color,
                    product_size: size,
                    quantity: parseInt(row.querySelector('input[name="quantity[]"]').value),
                    product_price: parseFloat(row.querySelector('input[name="price[]"]').value),
                });
            }
        });

        if (items.length === 0) {
            alert('Please add at least one product.');
            return;
        }

        try {
            const response = await fetch('/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ order: orderData, items })
            });

            const result = await response.json();

            if (response.ok) {
                alert('Order saved successfully!');
                window.location.href = '/orders/history'; // Redirect to history or detail
            } else {
                alert('Error saving order: ' + (result.details || result.error));
            }
        } catch (error) {
            console.error('Error submitting order:', error);
            alert('An unexpected error occurred.');
        }
    });
});
