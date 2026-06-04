document.addEventListener('DOMContentLoaded', () => {
    initReferrerSearch();
    initAddressAutocomplete();
    initOcrReader();
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

    resultsDiv.innerHTML = '<p class="text-sm text-gray-500">กำลังค้นหา...</p>';

    try {
        const response = await fetch(`/customer/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        resultsDiv.innerHTML = '';

        if (data.length === 0) {
            resultsDiv.innerHTML = '<p class="text-sm text-gray-500">ไม่พบข้อมูล</p>';
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
                <button type="button" class="ml-4 bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs">เลือก</button>
            `;
            ul.appendChild(li);
        });

        resultsDiv.appendChild(ul);
    } catch (error) {
        console.error('Error searching:', error);
        resultsDiv.innerHTML = '<p class="text-sm text-red-500">เกิดข้อผิดพลาดในการค้นหา</p>';
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

// --- OCR Reader Logic ---
function initOcrReader() {
    const dropZone = document.getElementById('ocr-drop-zone');
    const fileInput = document.getElementById('ocr-file-input');
    const defaultState = document.getElementById('ocr-default-state');
    const loadingState = document.getElementById('ocr-loading-state');
    const successState = document.getElementById('ocr-success-state');
    const errorAlert = document.getElementById('ocr-error-alert');
    const errorMessage = document.getElementById('ocr-error-message');
    const resetBtn = document.getElementById('ocr-reset-btn');

    if (!fileInput || !dropZone) return;

    // Reset zone state helper
    function showState(state) {
        defaultState.classList.add('hidden');
        loadingState.classList.add('hidden');
        successState.classList.add('hidden');
        errorAlert.classList.add('hidden');

        if (state === 'default') defaultState.classList.remove('hidden');
        else if (state === 'loading') loadingState.classList.remove('hidden');
        else if (state === 'success') successState.classList.remove('hidden');
        else if (state === 'error') errorAlert.classList.remove('hidden');
    }

    // Reset button
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.value = '';
            showState('default');
        });
    }

    // Drag events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-500', 'bg-blue-50/50');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500', 'bg-blue-50/50');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            handleOcrFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleOcrFile(e.target.files[0]);
        }
    });

    // Handle the selected image file
    function handleOcrFile(file) {
        if (!file.type.startsWith('image/')) {
            showError('กรุณาเลือกไฟล์ที่เป็นรูปภาพเท่านั้น');
            return;
        }

        showState('loading');

        // Compress the image before sending
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // Resize image using Canvas
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG format with 0.8 quality
                const base64Data = canvas.toDataURL('image/jpeg', 0.8);
                sendOcrRequest(base64Data);
            };
            img.onerror = () => {
                showError('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
            };
        };
        reader.onerror = () => {
            showError('ไม่สามารถอ่านไฟล์ได้');
        };
    }

    async function sendOcrRequest(base64Image) {
        try {
            const response = await fetch('/customer/api/ocr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: base64Image })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'เกิดข้อผิดพลาดในการประมวลผล OCR');
            }

            if (result.success && result.data) {
                populateFormFields(result.data);
                showState('success');
            } else {
                throw new Error(result.message || 'ไม่สามารถดึงข้อมูลจากบัตรประชาชนได้');
            }
        } catch (error) {
            console.error('OCR client error:', error);
            showError(error.message);
        }
    }

    function showError(msg) {
        if (errorMessage) errorMessage.textContent = msg;
        showState('error');
    }

    function populateFormFields(data) {
        // Autofill logic
        if (data.citizenId) {
            const citizenIdField = document.getElementById('customer_citizen_id');
            if (citizenIdField) citizenIdField.value = data.citizenId;

            const taxIdField = document.getElementById('customer_tax_id');
            if (taxIdField) taxIdField.value = data.citizenId;
        }

        if (data.fnameTh) {
            const fnameThField = document.getElementById('customer_fname_th');
            if (fnameThField) fnameThField.value = data.fnameTh;
        }

        if (data.lnameTh) {
            const lnameThField = document.getElementById('customer_lname_th');
            if (lnameThField) lnameThField.value = data.lnameTh;
        }

        if (data.fnameEn) {
            const fnameEnField = document.getElementById('customer_fname_en');
            if (fnameEnField) fnameEnField.value = data.fnameEn;
        }

        if (data.lnameEn) {
            const lnameEnField = document.getElementById('customer_lname_en');
            if (lnameEnField) lnameEnField.value = data.lnameEn;
        }

        if (data.gender) {
            const genderField = document.getElementById('customer_gender');
            if (genderField) {
                genderField.value = data.gender;
            }
        }

        if (data.birthdate) {
            const birthdateField = document.getElementById('customer_birthdate');
            if (birthdateField) birthdateField.value = data.birthdate;
        }

        if (data.address1) {
            const address1Field = document.getElementById('customer_address1');
            if (address1Field) address1Field.value = data.address1;
        }

        if (data.address2) {
            const address2Field = document.getElementById('customer_address2');
            if (address2Field) {
                address2Field.value = data.address2;
                address2Field.dispatchEvent(new Event('input'));
            }
        }

        if (data.zipcode) {
            const zipcodeField = document.getElementById('customer_zipcode');
            if (zipcodeField) zipcodeField.value = data.zipcode;
        }
    }
}
