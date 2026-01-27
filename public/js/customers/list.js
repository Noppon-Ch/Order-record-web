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
