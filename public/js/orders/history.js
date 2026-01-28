document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Data safely
    const dataScript = document.getElementById('orders-data');
    if (!dataScript) return;

    let ordersData = [];
    try {
        ordersData = JSON.parse(dataScript.textContent);
    } catch (e) {
        console.error('Failed to parse orders data', e);
        return;
    }

    // 2. Open Modal for rows
    document.querySelector('tbody').addEventListener('click', (e) => {
        // Prevent if clicking on buttons/links
        if (e.target.closest('a') || e.target.closest('button')) return;

        const row = e.target.closest('tr[data-order-index]');
        if (row) {
            const index = row.dataset.orderIndex;
            openOrderModal(index, ordersData);
        }
    });

    // 3. Delete Action
    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-delete-order]');
        if (deleteBtn) {
            e.preventDefault();
            const orderId = deleteBtn.dataset.deleteOrder;
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการสั่งซื้อนี้?')) {
                try {
                    const response = await fetch(`/orders/${orderId}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.success) window.location.reload();
                    else alert('เกิดข้อผิดพลาดในการลบรายการ: ' + (result.message || 'Unknown error'));
                } catch (error) {
                    console.error('Error:', error);
                    alert('ลบรายการไม่สำเร็จ');
                }
            }
        }
    });

    // 4. Modal Interactions
    const closeModal = () => {
        const modal = document.getElementById('orderModal');
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.addEventListener('click', closeModal);

    // Also allow closing when clicking outside the modal content (on the glass/backdrop)
    const modalContainer = document.querySelector('#orderModal .fixed.inset-0.z-10');
    if (modalContainer) {
        modalContainer.addEventListener('click', (e) => {
            // Only close if clicking directly on the container (backdrop), not its children
            if (e.target === modalContainer || e.target.classList.contains('min-h-full')) {
                closeModal();
            }
        });
    }

    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") closeModal();
    });
});

function openOrderModal(index, ordersData) {
    try {
        const order = ordersData[index];
        if (!order) return;

        // Set Header
        setText('modalOrderDate', new Date(order.order_date).toLocaleDateString('th-TH'));
        setText('modalCustomerName', `คุณ ${order.customers?.customer_fname_th || ''} ${order.customers?.customer_lname_th || ''}`);

        // Set Items Table
        const tbody = document.getElementById('modalOrderItemsBody');
        tbody.innerHTML = '';

        if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.product_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.product_color || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.product_size || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${(item.product_price / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${item.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium text-right">${((item.product_price * item.quantity) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">ไม่พบสินค้าในรายการ</td></tr>';
        }

        // Show Modal
        const modal = document.getElementById('orderModal');
        if (modal) modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');

    } catch (e) {
        console.error('Error opening modal:', e);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
