document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Data safely
    const dataScript = document.getElementById('products-data');
    if (!dataScript) return;

    let productsData = [];
    try {
        productsData = JSON.parse(dataScript.textContent);
    } catch (e) {
        console.error('Failed to parse products data', e);
        return;
    }

    // 2. Open Modal Buttons
    document.querySelectorAll('[data-product-index]').forEach(btn => {
        btn.addEventListener('click', function () {
            const index = this.dataset.productIndex;
            openProductModal(index, productsData);
        });
    });

    // 3. Close Modal Elements
    const closeModal = () => closeProductModal();

    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.addEventListener('click', closeModal);

    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // 4. Close on escape key
    document.addEventListener('keydown', function (event) {
        if (event.key === "Escape") {
            closeModal();
        }
    });
});

function openProductModal(index, productsData) {
    try {
        const product = productsData[index];
        if (!product) return;

        // Helper to safely show value
        const showVal = (val, unit = '') => (val !== null && val !== undefined && val !== '') ? `${val} ${unit}` : '-';

        // Set Header
        const nameEl = document.getElementById('modalProductName');
        if (nameEl) nameEl.textContent = product.product_name_th || product.product_name_en || 'Product Details';

        const codeEl = document.getElementById('modalProductCode');
        if (codeEl) codeEl.textContent = `#${product.product_code}`;

        // Set Bust
        setText('modalUnderBust', showVal(product.under_bust));
        setText('modalTopBust', showVal(product.top_bust));

        // Set Waist
        setText('modalWaistMin', showVal(product.waist_min));
        setText('modalWaistMax', showVal(product.waist_max));

        // Set Hip
        setText('modalHipMin', showVal(product.hip_min));
        setText('modalHipMax', showVal(product.hip_max));

        // Set Height
        setText('modalHeightMin', showVal(product.hight_min, 'cm'));
        setText('modalHeightMax', showVal(product.hight_max, 'cm'));

        // Show Modal
        const modal = document.getElementById('productModal');
        if (modal) modal.classList.remove('hidden');

        // Prevent body scroll
        document.body.classList.add('overflow-hidden');

    } catch (e) {
        console.error('Error opening modal:', e);
    }
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
