
// State to track which person field we are searching for ('referrer' or 'assistant')
let currentSearchType = null;
let currentActiveProductInput = null; // Track which input is currently searching for products
let productSearchTimeout;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize with one row
    addProductRow();

    // 2. Form Submit
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', handleFormSubmit);
    }

    // 3. Static Button Listeners
    setupStaticListeners();

    // 4. Table Event Delegation
    setupTableDelegation();

    // 5. Global Listeners
    window.addEventListener('resize', () => {
        document.getElementById('globalProductSuggestions').classList.add('hidden');
    });

    // Search Input Enter Key
    const personSearchInput = document.getElementById('personSearchInput');
    if (personSearchInput) {
        personSearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') performPersonSearch();
        });
    }
});

function setupStaticListeners() {
    // Add Product
    const addBtn = document.getElementById('addProductBtn');
    if (addBtn) addBtn.addEventListener('click', addProductRow);

    // Search Buyer
    const buyerBtn = document.getElementById('searchBuyerBtn');
    if (buyerBtn) buyerBtn.addEventListener('click', () => openPersonSearch('buyer'));

    // Search Assistant
    const assistantBtn = document.getElementById('searchAssistantBtn');
    if (assistantBtn) assistantBtn.addEventListener('click', () => openPersonSearch('assistant'));

    // Perform Search
    const searchBtn = document.getElementById('performSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', performPersonSearch);

    // Close Modal (Button & Background)
    const closeModalBtn = document.getElementById('closeSearchModalBtn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closePersonSearch);

    const modalBg = document.getElementById('modalBackground');
    if (modalBg) modalBg.addEventListener('click', closePersonSearch);
}

function setupTableDelegation() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', (e) => {
        // Remove Row Button
        const removeBtn = e.target.closest('.remove-product-btn');
        if (removeBtn) {
            removeProductRow(removeBtn);
        }

        // Quantity +/- Buttons (Mobile)
        const qtyBtn = e.target.closest('.quantity-btn');
        if (qtyBtn) {
            const row = qtyBtn.closest('tr');
            const input = row.querySelector('input[name="quantity[]"]');
            let val = parseInt(input.value) || 0;

            if (qtyBtn.classList.contains('plus')) {
                val++;
            } else if (qtyBtn.classList.contains('minus')) {
                if (val > 1) val--;
            }

            input.value = val;
            calculateRow(row);
        }
    });

    tbody.addEventListener('input', (e) => {
        // Product Code Input
        if (e.target.classList.contains('product-code-input')) {
            handleProductCodeInput(e.target);
        }
    });

    tbody.addEventListener('focusout', (e) => { // Use focusout for blur delegation
        if (e.target.classList.contains('product-code-input')) {
            hideProductSuggestionsDelayed();
            handleProductCodeBlur(e.target);
        }
    });

    tbody.addEventListener('change', (e) => {
        if (e.target.name === 'quantity[]') {
            calculateRow(e.target.closest('tr'));
        }
    });

    tbody.addEventListener('keyup', (e) => {
        if (e.target.name === 'quantity[]') {
            calculateRow(e.target.closest('tr'));
        }
    });
}

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
            // Need to bind click event to this specific element manually as it is dynamic
            li.addEventListener('click', () => selectPerson(person));

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

async function selectPerson(person) {
    if (currentSearchType === 'buyer') {
        try {
            // Fetch full details
            const response = await fetch(`/customer/api/${person.customer_id}`);
            if (!response.ok) throw new Error('Failed to fetch details');
            const data = await response.json();
            const customer = data.customer;
            const recommender = data.recommender;

            if (customer) {
                document.getElementById('buyer_id').value = customer.customer_citizen_id;
                document.getElementById('buyer_name').value = `${customer.customer_fname_th} ${customer.customer_lname_th}`;
                document.getElementById('buyer_position').value = customer.customer_position || '';
                document.getElementById('customer_uuid').value = customer.customer_id;

                // Update shipping address
                const address = `${customer.customer_fname_th} ${customer.customer_lname_th}\n${customer.customer_phone || ''}\n${customer.customer_address1 || ''} ${customer.customer_address2 || ''} ${customer.customer_zipcode || ''}`;
                document.getElementById('shipping_address').value = address;

                // Update Referrer
                if (recommender) {
                    document.getElementById('referrer_id').value = recommender.customer_citizen_id;
                    document.getElementById('referrer_name').value = `${recommender.customer_fname_th} ${recommender.customer_lname_th}`;
                    document.getElementById('referrer_uuid').value = recommender.customer_id;
                } else {
                    document.getElementById('referrer_id').value = '';
                    document.getElementById('referrer_name').value = '';
                    document.getElementById('referrer_uuid').value = '';
                }
            }
        } catch (error) {
            console.error('Error selecting buyer:', error);
            alert('Failed to load customer details.');
        }

    } else if (currentSearchType === 'referrer') {
        document.getElementById('referrer_id').value = person.customer_citizen_id;
        document.getElementById('referrer_name').value = `${person.customer_fname_th} ${person.customer_lname_th}`;
        document.getElementById('referrer_uuid').value = person.customer_id;
    } else if (currentSearchType === 'assistant') {
        document.getElementById('assistant_id').value = person.customer_citizen_id;
        document.getElementById('assistant_name').value = `${person.customer_fname_th} ${person.customer_lname_th}`;
        document.getElementById('assistant_uuid').value = person.customer_id;
    }
    if (currentSearchType === 'buyer') {
        calculateTotals();
    }
    closePersonSearch();
}


// --- Product List Management ---

function addProductRow() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    // Use a simpler approach than Date.now() for unique row handling if needed, but ID is not strictly required for logic here
    const tr = document.createElement('tr');

    // Note: Removed inline event handlers. They are handled by delegation in setupTableDelegation()
    tr.className = "flex flex-col sm:table-row mb-6 sm:mb-0 bg-white shadow rounded-lg sm:shadow-none sm:rounded-none border border-gray-300 sm:border-none p-4 sm:p-0 space-y-3 sm:space-y-0";

    tr.innerHTML = `
        <td class="p-0 sm:px-3 sm:py-4 whitespace-nowrap relative block sm:table-cell">
            <div class="flex flex-col sm:block">
                <label class="sm:hidden text-xs font-semibold text-gray-500 mb-1">รหัสสินค้า</label>
                <input type="text" name="product_code[]" class="product-code-input shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 sm:p-1 border uppercase" 
                    placeholder="Code" autocomplete="off">
            </div>
        </td>
        <td class="p-0 sm:px-3 sm:py-4 whitespace-nowrap block sm:table-cell">
            <div class="flex flex-col sm:block">
                <label class="sm:hidden text-xs font-semibold text-gray-500 mb-1">จำนวน</label>
                <div class="flex items-center">
                    <button type="button" class="quantity-btn minus sm:hidden bg-gray-200 text-gray-600 hover:bg-gray-300 rounded-l-md px-3 py-2 border border-r-0 border-gray-300 shadow-sm">-</button>
                    <input type="number" name="quantity[]" value="1" min="1" class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-none sm:rounded-md p-2 sm:p-1 border text-center">
                    <button type="button" class="quantity-btn plus sm:hidden bg-gray-200 text-gray-600 hover:bg-gray-300 rounded-r-md px-3 py-2 border border-l-0 border-gray-300 shadow-sm">+</button>
                </div>
            </div>
        </td>
        <td class="p-0 sm:px-3 sm:py-4 whitespace-nowrap block sm:table-cell">
            <div class="flex flex-col sm:block">
                <label class="sm:hidden text-xs font-semibold text-gray-500 mb-1">ชื่อสินค้า (สี/ขนาด)</label>
                <input type="text" name="product_name[]" readonly class="shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md p-2 sm:p-1 border text-gray-500">
                <input type="hidden" name="product_real_name[]">
                <input type="hidden" name="product_color[]">
                <input type="hidden" name="product_size[]">
            </div>
        </td>
        <td class="p-0 sm:px-3 sm:py-4 whitespace-nowrap block sm:table-cell">
            <div class="flex flex-col sm:block">
                <label class="sm:hidden text-xs font-semibold text-gray-500 mb-1">ราคาต่อหน่วย</label>
                <input type="number" name="price[]" readonly class="shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md p-2 sm:p-1 border text-right text-gray-500">
            </div>
        </td>
        <td class="p-0 sm:px-3 sm:py-4 whitespace-nowrap block sm:table-cell">
            <div class="flex flex-col sm:block">
                <label class="sm:hidden text-xs font-semibold text-gray-500 mb-1">รวม</label>
                <input type="text" name="total[]" readonly class="row-total shadow-sm bg-gray-50 block w-full sm:text-sm border-gray-300 rounded-md p-2 sm:p-1 border text-right font-medium">
            </div>
        </td>
        <td class="p-0 sm:px-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium block sm:table-cell mt-2 sm:mt-0">
            <button type="button" class="remove-product-btn w-full sm:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none sm:bg-transparent sm:text-red-600 sm:hover:text-red-900 sm:shadow-none sm:p-0">
                <span class="sm:hidden mr-2">ลบรายการ</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
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

async function handleProductCodeInput(input) {
    currentActiveProductInput = input;
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

            globalSuggestionsDiv.innerHTML = '';

            if (products.length > 0) {
                products.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50';
                    div.innerHTML = `<span class="block font-medium truncate">${p.product_code}</span>
                                     <span class="block text-xs text-gray-500 truncate">${p.product_name_th} (${p.color_th}/${p.product_size}) - ${p.price_per_unit}</span>`;

                    div.onmousedown = (e) => {
                        e.preventDefault();
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

    const positionInput = document.getElementById('buyer_position');
    const position = positionInput ? positionInput.value.toUpperCase().trim() : '';

    const orderTypeInput = document.getElementById('order_type');
    const orderType = orderTypeInput ? orderTypeInput.value : 'f_order';

    if (position === 'SAG') {
        discount = subtotal * 0.60;
    } else if (position === 'SFAG') {
        discount = subtotal * 0.50;
    } else if (position === 'AG') {
        discount = subtotal * 0.40;
    } else if (position === 'BM') {
        if (orderType === 'c_order') {
            // BM Continue Order: 20% flat (no threshold)
            discount = subtotal * 0.20;
        } else {
            // BM First Order: 20% on amount > 20,000
            if (subtotal > 20000) {
                discount = (subtotal - 20000) * 0.20;
            }
        }
    } else {
        // Default Logic (Same as BM First Order)
        if (subtotal > 20000) {
            discount = (subtotal - 20000) * 0.20;
        }
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

async function handleFormSubmit(e) {
    e.preventDefault();

    // 1. Validate General Info
    const orderDate = document.getElementById('order_date').value;
    const customerUuid = document.getElementById('customer_uuid').value;

    if (!orderDate) {
        alert('Please select an Order Date.');
        document.getElementById('order_date').focus();
        return;
    }
    if (!customerUuid) {
        alert('Please select a Buyer (Customer).');
        document.getElementById('buyer_id').focus();
        return;
    }


    // Collect Data
    const orderData = {
        order_customer_id: customerUuid,
        order_date: orderDate,
        order_total_amount: parseFloat(document.getElementById('summary_subtotal').innerText.replace(/,/g, '')),
        order_discount: parseFloat(document.getElementById('summary_discount').innerText.replace(/,/g, '')),
        order_price_before_tax: parseFloat(document.getElementById('summary_after_discount').innerText.replace(/,/g, '')),
        order_tax: parseFloat(document.getElementById('summary_tax').innerText.replace(/,/g, '')),
        order_final_price: parseFloat(document.getElementById('summary_grand_total').innerText.replace(/,/g, '')),

        // Optional Relations
        order_recommender_id: document.getElementById('referrer_uuid').value || null,
        order_assistant_id: document.getElementById('assistant_uuid') ? document.getElementById('assistant_uuid').value : null,
        position: document.getElementById('buyer_position').value || null,
        order_type: document.getElementById('order_type') ? document.getElementById('order_type').value : 'f_order',
        order_shipping_address: document.getElementById('shipping_address').value || null
    };

    // Collect Items & Validate Rows
    const items = [];
    const rows = document.querySelectorAll('#productTableBody tr');
    let hasError = false;
    let firstErrorRow = null;

    rows.forEach(row => {
        const codeInput = row.querySelector('input[name="product_code[]"]');
        const code = codeInput.value.trim();
        const realName = row.querySelector('input[name="product_real_name[]"]').value;

        if (code && !realName) {
            hasError = true;
            codeInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
            if (!firstErrorRow) firstErrorRow = row;
        } else if (!code && rows.length > 1) {
            // Treat empty rows as error if multiple rows, or if strict (assume strict)
            hasError = true;
            codeInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
            if (!firstErrorRow) firstErrorRow = row;
        }

        if (code && realName) {
            items.push({
                product_code: code,
                product_name: realName,
                product_color: row.querySelector('input[name="product_color[]"]').value,
                product_size: row.querySelector('input[name="product_size[]"]').value,
                quantity: parseInt(row.querySelector('input[name="quantity[]"]').value),
                product_price: parseFloat(row.querySelector('input[name="price[]"]').value),
            });
        }
    });

    if (hasError) {
        alert('Please check your items. Remove empty rows or fix invalid product codes.');
        if (firstErrorRow) firstErrorRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (items.length === 0) {
        alert('Please add at least one valid product.');
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
            const orderId = result.orderId;
            window.location.href = `/orders/finish?orderId=${orderId}`;
        } else {
            alert('Error saving order: ' + (result.details || result.error));
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('An unexpected error occurred.');
    }
}

// Auto-Fetch Logic (Blur equivalent)
async function handleProductCodeBlur(input) {
    const code = input.value.trim().toUpperCase();
    input.value = code;

    if (!code) {
        clearRowData(input.closest('tr'));
        input.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
        return;
    }

    const row = input.closest('tr');

    try {
        const response = await fetch(`/products/search?q=${encodeURIComponent(code)}`);
        const products = await response.json();

        const exactMatch = products.find(p => p.product_code === code);

        if (exactMatch) {
            selectProductForRow(exactMatch, row);
            input.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
        } else {
            clearRowData(row);
            input.classList.add('border-red-500', 'ring-1', 'ring-red-500');
        }
    } catch (e) {
        console.error('Auto-fetch error', e);
    }
}

function clearRowData(row) {
    row.querySelector('input[name="product_name[]"]').value = '';
    row.querySelector('input[name="product_real_name[]"]').value = '';
    row.querySelector('input[name="product_color[]"]').value = '';
    row.querySelector('input[name="product_size[]"]').value = '';
    row.querySelector('input[name="price[]"]').value = '';
    row.querySelector('input[name="total[]"]').value = '';
    calculateTotals();
}

function selectProductForRow(product, row) {
    row.querySelector('input[name="product_code[]"]').value = product.product_code;
    row.querySelector('input[name="product_name[]"]').value = `${product.product_name_th} (${product.color_th}/${product.product_size})`;
    row.querySelector('input[name="product_real_name[]"]').value = product.product_name_th;
    row.querySelector('input[name="product_color[]"]').value = product.color_th;
    row.querySelector('input[name="product_size[]"]').value = product.product_size;
    row.querySelector('input[name="price[]"]').value = product.price_per_unit;
    calculateRow(row);
}
