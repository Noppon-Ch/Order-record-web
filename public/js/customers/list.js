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
    const confirmed = await Swal.fire({
        title: 'ยืนยันการลบลูกค้า?',
        text: `คุณต้องการลบลูกค้า ${customerName} ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ใช่, ลบเลย',
        cancelButtonText: 'ยกเลิก'
    });

    if (confirmed.isConfirmed) {
        try {
            const response = await fetch(`/customer/delete/${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'สำเร็จ!',
                    text: 'ลบข้อมูลลูกค้าเรียบร้อยแล้ว',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.reload();
                });
            } else {
                const data = await response.json();
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: `ไม่สามารถลบข้อมูลได้: ${data.error || 'Unknown error'}`,
                    confirmButtonColor: '#ef4444'
                });
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
                confirmButtonColor: '#ef4444'
            });
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
