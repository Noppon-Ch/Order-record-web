document.addEventListener('DOMContentLoaded', () => {
    // Dropdown Toggle Delegation
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('[data-dropdown-toggle]');
        if (toggleBtn) {
            const id = toggleBtn.dataset.dropdownToggle;
            toggleDropdown(id, toggleBtn);
            e.stopPropagation();
            return; // Handling toggle click
        }

        // Close dropdowns if clicking outside
        const isDropdown = e.target.closest('div[id^=dropdown-]');
        if (!isDropdown) {
            closeAllDropdowns();
        }
    });

    // Close dropdowns on scroll
    window.addEventListener('scroll', closeAllDropdowns, true);

    // Delete Customer Delegation
    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-delete-id]');
        if (deleteBtn) {
            e.preventDefault();
            const id = deleteBtn.dataset.deleteId;
            const name = deleteBtn.dataset.deleteName;
            deleteCustomer(id, name);
        }
    });
});

function closeAllDropdowns() {
    document.querySelectorAll('[id^=dropdown-]').forEach(el => {
        el.classList.add('hidden');
        el.style.position = '';
        el.style.top = '';
        el.style.left = '';
        el.style.right = '';
        el.style.zIndex = '';
    });
}

function toggleDropdown(id, button) {
    const dropdown = document.getElementById('dropdown-' + id);
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');

    // Close all first
    closeAllDropdowns();

    if (isHidden) {
        dropdown.classList.remove('hidden');

        const rect = button.getBoundingClientRect();

        // Apply fixed positioning to avoid overflow clipping
        dropdown.style.position = 'fixed';
        dropdown.style.zIndex = '50';
        dropdown.style.right = 'auto';

        // Calculate position
        dropdown.style.top = (rect.bottom + 5) + 'px';
        const dropdownWidth = dropdown.offsetWidth;
        // Align right edge of dropdown with right edge of button if possible, or left
        dropdown.style.left = (rect.right - dropdownWidth) + 'px';
    }
}

async function deleteCustomer(customerId, customerName) {
    if (confirm(`Are you sure you want to delete ${customerName}? This action cannot be undone.`)) {
        try {
            const response = await fetch(`/customer/delete/${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // If redirect logic is handled by server (302), fetch might follow it or return ok.
                // Assuming standard reload needed as per old script
                alert('Customer deleted successfully.');
                window.location.reload();
            } else {
                const data = await response.json();
                alert(`Failed to delete customer: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            alert('An error occurred while deleting the customer.');
        }
    }
}

// Customer Modal Handling added via update
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('customerInfoModal');
    const modalName = document.getElementById('modalCustomerName');
    const modalPhone = document.getElementById('modalCustomerPhone');
    const closeBtn = document.getElementById('closeModalBtn');
    const copyBtn = document.getElementById('copyPhoneBtn');

    // Row Click Delegation
    document.querySelector('tbody')?.addEventListener('click', (e) => {
        // Find closest row
        const row = e.target.closest('.customer-row');
        if (!row) return;

        // Ignore clicks on buttons, links, or dropdown toggles inside the row
        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('[data-dropdown-toggle]')) {
            return;
        }

        const name = row.dataset.customerName;
        const phone = row.dataset.customerPhone;

        if (modalName) modalName.textContent = name;
        if (modalPhone) modalPhone.value = phone || '-';

        if (modal) modal.classList.remove('hidden');
    });

    // Close Modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }

    // Close on background click
    if (modal) {
        modal.addEventListener('click', (e) => {
            // Check if click is on the background overlay (which is the parent div typically if structure allows, or specifically targeted)
            // The structure is fixed overlay covering screen. The content is centered.
            // If e.target is the modal container itself (providing it has padding and user clicked outside the inner panel)
            // However, looking at structure:
            // #customerInfoModal > div.fixed...bg-gray-500 (backdrop)
            // #customerInfoModal > div.fixed...z-10... (scroll container) > div.flex... > div.relative...bg-white (panel)

            // Check if click is outside the modal panel (on the background)
            // The modal panel has .relative.transform.overflow-hidden
            const modalPanel = e.target.closest('.relative.transform.overflow-hidden');
            if (!modalPanel) {
                modal.classList.add('hidden');
            }
        });
    }

    // Copy Phone
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (modalPhone) {
                modalPhone.select();
                modalPhone.setSelectionRange(0, 99999); // Mobile
                navigator.clipboard.writeText(modalPhone.value).catch(err => {
                    console.error('Failed to copy', err);
                });
            }
        });
    }
});
