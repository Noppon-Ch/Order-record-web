document.addEventListener('DOMContentLoaded', () => {
    // Delegation for order row interactions
    document.addEventListener('click', (e) => {
        // 1. Handle Delete Button
        const deleteBtn = e.target.closest('[data-delete-order]');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation(); // Stop row toggle
            const orderId = deleteBtn.dataset.deleteOrder;
            deleteOrder(orderId);
            return;
        }

        // 2. Handle PDF Links (or any links)
        if (e.target.closest('a')) {
            e.stopPropagation(); // Stop row toggle
            return;
        }

        // 3. Handle Action Cell (if clicked vacant space in action cell)
        if (e.target.closest('[data-no-row-click]')) {
            e.stopPropagation();
            return;
        }

        // 4. Handle Row Click (Toggle Details)
        // Ensure we are clicking on a main row, not the details row itself
        const row = e.target.closest('.order-row');
        if (row) {
            toggleDetails(row.dataset.orderId);
        }
    });
});

async function deleteOrder(orderId) {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการสั่งซื้อนี้?')) return;

    try {
        const response = await fetch(`/orders/${orderId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            window.location.reload();
        } else {
            alert('เกิดข้อผิดพลาดในการลบรายการ: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('ลบรายการไม่สำเร็จ');
    }
}

function toggleDetails(orderId) {
    const detailsRow = document.getElementById(`details-${orderId}`);
    if (detailsRow) {
        if (detailsRow.classList.contains('hidden')) {
            detailsRow.classList.remove('hidden');
        } else {
            detailsRow.classList.add('hidden');
        }
    }
}
