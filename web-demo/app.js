const defaultProducts = [
    { id: 1, code: "B011", name: "Buriyani", price: 500, stock: 65 },
    { id: 2, code: "B010", name: "Rice and Curry", price: 270, stock: 24 },
    { id: 3, code: "B012", name: "Vegan Rice", price: 300, stock: 65 }
];

let products = (JSON.parse(localStorage.getItem("demoPOS_products") || "null") || defaultProducts).map(p => ({ ...p, image: p.image || "" }));
let orders = JSON.parse(localStorage.getItem("demoPOS_orders") || "null") || [];
let currentOrder = [];
let selectedOrderIndex = null;

function saveData() {
    localStorage.setItem("demoPOS_products", JSON.stringify(products));
    localStorage.setItem("demoPOS_orders", JSON.stringify(orders));
}

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");

navItems.forEach(btn => btn.addEventListener("click", () => {
    navItems.forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    pages.forEach(x => x.classList.remove("active"));
    document.getElementById(`${btn.dataset.page}-page`).classList.add("active");
    renderPage(btn.dataset.page);
}));

function renderPage(page) {
    if (page === "kitchen") renderKitchen();
    if (page === "status") renderStatus();
    if (page === "history") renderHistory();
    if (page === "products") renderProducts();
    if (page === "stock") renderStock();
}

const foodSearch = document.getElementById("food-search");
const productCards = document.getElementById("product-cards");
let selectedProductId = null;

function refreshProductCards(filter = "") {
    const q = filter.trim().toLowerCase();
    const matches = products.filter(p =>
        p.stock > 0 &&
        (!q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    );

    productCards.innerHTML = "";
    selectedProductId = null;

    matches.forEach(p => {
        const card = document.createElement("article");
        card.className = "product-card" + (p.image ? " has-image" : "");
        const imageMarkup = p.image
            ? `<img class="product-image" src="${p.image}" alt="${escapeHtml(p.name)}">`
            : `<div class="product-image-placeholder">🍽</div>`;
        card.innerHTML = `
            <div class="product-code">${escapeHtml(p.code)}</div>
            ${imageMarkup}
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-price">Rs. ${p.price.toFixed(2)}</div>
            <div class="product-stock">Stock: ${p.stock}</div>
        `;

        card.addEventListener("click", () => {
            productCards.querySelectorAll(".product-card").forEach(x => x.classList.remove("selected"));
            card.classList.add("selected");
            selectedProductId = p.id;
        });

        productCards.appendChild(card);
    });
}

foodSearch.addEventListener("input", () => refreshProductCards(foodSearch.value));
refreshProductCards();

document.getElementById("add-food").addEventListener("click", () => {
    const qty = Math.max(1, Number(document.getElementById("food-quantity").value) || 1);
    const product = products.find(p => p.id === selectedProductId);

    if (!product) return toast("Select a product first.");
    if (qty > product.stock) return toast("Not enough stock.");

    const existing = currentOrder.find(i => i.productId === product.id);
    const existingQty = existing ? existing.quantity : 0;
    if (existingQty + qty > product.stock) return toast("Not enough stock.");

    if (existing) existing.quantity += qty;
    else currentOrder.push({
        productId: product.id,
        code: product.code,
        name: product.name,
        price: product.price,
        quantity: qty
    });

    document.getElementById("food-quantity").value = "1";
    renderCurrentOrder();
});

// Touchscreen-friendly horizontal swipe / mouse drag.
// Keep normal taps/clicks available for selecting product cards.
let productDragging = false;
let productPointerDown = false;
let productStartX = 0;
let productStartScroll = 0;
let suppressProductClick = false;

productCards.addEventListener("pointerdown", event => {
    productPointerDown = true;
    productDragging = false;
    suppressProductClick = false;
    productStartX = event.clientX;
    productStartScroll = productCards.scrollLeft;
});

productCards.addEventListener("pointermove", event => {
    if (!productPointerDown) return;
    const distance = event.clientX - productStartX;

    // A small movement is still a tap, so the card can be selected normally.
    if (!productDragging && Math.abs(distance) < 8) return;

    productDragging = true;
    suppressProductClick = true;
    productCards.classList.add("dragging");
    productCards.scrollLeft = productStartScroll - distance;
});

function stopProductDrag() {
    productPointerDown = false;
    productDragging = false;
    productCards.classList.remove("dragging");
}

productCards.addEventListener("pointerup", stopProductDrag);
productCards.addEventListener("pointercancel", stopProductDrag);

productCards.addEventListener("click", event => {
    if (suppressProductClick) {
        suppressProductClick = false;
        event.preventDefault();
        event.stopPropagation();
    }
}, true);

function renderCurrentOrder() {
    const tbody = document.getElementById("current-items");
    tbody.innerHTML = "";
    if (!currentOrder.length) {
        tbody.innerHTML = '<tr class="empty-table"><td colspan="5"></td></tr>';
        updateTotal();
        return;
    }
    currentOrder.forEach((item, index) => {
        const tr = document.createElement("tr");
        tr.dataset.index = index;
        tr.innerHTML = `<td>${item.code}</td><td>${item.name}</td><td>Rs. ${item.price.toFixed(2)}</td><td>${item.quantity}</td><td>Rs. ${(item.price * item.quantity).toFixed(2)}</td>`;
        tr.addEventListener("click", () => {
            document.querySelectorAll("#current-items tr").forEach(r => r.classList.remove("row-selected"));
            tr.classList.add("row-selected");
            tr.dataset.selected = "true";
        });
        tbody.appendChild(tr);
    });
    updateTotal();
}

function updateTotal() {
    const total = currentOrder.reduce((sum, i) => sum + i.price * i.quantity, 0);
    document.getElementById("order-total").textContent = `Total: Rs. ${total.toFixed(2)}`;
}

document.getElementById("remove-selected").addEventListener("click", () => {
    const row = document.querySelector("#current-items tr[data-selected='true']");
    if (!row) return toast("Select an item first.");
    currentOrder.splice(Number(row.dataset.index), 1);
    renderCurrentOrder();
});

document.getElementById("clear-order").addEventListener("click", () => {
    currentOrder = [];
    clearCustomerForm();
    renderCurrentOrder();
});

document.getElementById("save-order").addEventListener("click", () => {
    if (!currentOrder.length) return toast("Add at least one food item.");
    const order = {
        id: orders.length ? Math.max(...orders.map(o => o.id)) + 1 : 1,
        customerName: document.getElementById("customer-name").value.trim() || "Walk-in Customer",
        phone1: document.getElementById("phone1").value.trim(),
        phone2: document.getElementById("phone2").value.trim(),
        address: document.getElementById("address").value.trim(),
        tableNumber: document.getElementById("table-number").value || "1",
        items: structuredClone(currentOrder),
        total: currentOrder.reduce((s, i) => s + i.price * i.quantity, 0),
        status: "PENDING",
        createdAt: new Date().toISOString()
    };
    currentOrder.forEach(item => {
        const p = products.find(x => x.id === item.productId);
        if (p) p.stock = Math.max(0, p.stock - item.quantity);
    });
    orders.push(order);
    saveData();
    currentOrder = [];
    clearCustomerForm();
    renderCurrentOrder();
    toast(`Order #${order.id} saved.`);
});

function clearCustomerForm() {
    ["customer-name", "phone1", "phone2", "address"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("table-number").value = "1";
    document.getElementById("food-search").value = "";
    document.getElementById("food-quantity").value = "1";
    refreshProductCards();
}

function renderKitchen() {
    const container = document.getElementById("kitchen-list");
    const active = orders.filter(o => ["PENDING", "PREPARING"].includes(o.status));
    if (!active.length) {
        container.innerHTML = '<div class="center-message">No orders waiting for preparation.</div>';
        return;
    }
    container.innerHTML = active.map(o => `
        <div class="kitchen-card">
            <strong>Order #${o.id}</strong><br>
            <span>Customer: ${escapeHtml(o.customerName)} · Table ${escapeHtml(String(o.tableNumber))}</span>
            <div style="margin:12px 0">${o.items.map(i => `<div>${escapeHtml(i.name)} × ${i.quantity}</div>`).join("")}</div>
            <button class="small-button" onclick="advanceKitchen(${o.id})">${o.status === "PENDING" ? "Start Preparing" : "Mark Ready"}</button>
        </div>`).join("");
}

function advanceKitchen(id) {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    o.status = o.status === "PENDING" ? "PREPARING" : "READY";
    saveData(); renderKitchen(); toast(`Order #${id}: ${o.status}`);
}

function renderStatus() {
    const tbody = document.getElementById("status-list");
    tbody.innerHTML = orders.length ? orders.map(o => `
        <tr>
            <td>#${o.id}</td><td>${escapeHtml(o.customerName)}</td><td>${escapeHtml(String(o.tableNumber))}</td>
            <td>Rs. ${o.total.toFixed(2)}</td><td class="status-badge">${o.status}</td>
            <td>${formatDate(o.createdAt)}</td>
        </tr>`).join("") : "";
}

function renderHistory() {
    const q = document.getElementById("history-search").value.trim().toLowerCase();
    const list = orders.filter(o => o.status === "COMPLETED").filter(o =>
        !q || String(o.id).includes(q) || o.customerName.toLowerCase().includes(q)
    );
    document.getElementById("history-list").innerHTML = list.map(o => `
        <tr data-id="${o.id}" onclick="selectHistory(${o.id}, this)">
            <td>${selectedOrderIndex === o.id ? "●" : ""}</td>
            <td>#${o.id}</td><td>${escapeHtml(o.customerName)}</td><td>${escapeHtml(String(o.tableNumber))}</td>
            <td>Rs. ${o.total.toFixed(2)}</td><td>${o.status}</td><td>${formatDate(o.createdAt)}</td>
        </tr>`).join("");
}

function selectHistory(id, row) {
    selectedOrderIndex = id;
    document.querySelectorAll("#history-list tr").forEach(r => r.classList.remove("row-selected"));
    row.classList.add("row-selected");
}

document.getElementById("view-history").addEventListener("click", () => {
    if (selectedOrderIndex == null) return toast("Select an order first.");
    const o = orders.find(x => x.id === selectedOrderIndex);
    if (o) alert(`Order #${o.id}\nCustomer: ${o.customerName}\nTable: ${o.tableNumber}\nTotal: Rs. ${o.total.toFixed(2)}`);
});

function renderProducts() {
    const q = document.getElementById("product-search").value.trim().toLowerCase();
    const list = products.filter(p => !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    document.getElementById("products-list").innerHTML = list.map((p, i) => `
        <tr>
            <td>${p.image ? `<img class="product-thumb" src="${p.image}" alt="">` : `<div class="product-thumb-placeholder">🍽</div>`}</td>
            <td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.name)}</td>
            <td>Rs. ${p.price.toFixed(2)}</td><td>${p.stock}</td>
            <td>
                <button class="action-link" onclick="editProduct(${p.id})">Edit</button>
                <button class="action-link delete" onclick="deleteProduct(${p.id})">Delete</button>
            </td>
        </tr>`).join("");
}

document.getElementById("product-search").addEventListener("input", renderProducts);

const productModal = document.getElementById("product-modal");
const productModalTitle = document.getElementById("product-modal-title");
const productCodeInput = document.getElementById("product-code-input");
const productNameInput = document.getElementById("product-name-input");
const productPriceInput = document.getElementById("product-price-input");
const productStockInput = document.getElementById("product-stock-input");
const productImageInput = document.getElementById("product-image-input");
const productImagePreview = document.getElementById("product-image-preview");
let editingProductId = null;
let pendingProductImage = "";

function showProductImagePreview(src) {
    productImagePreview.innerHTML = src ? `<img src="${src}" alt="Product preview">` : "No image";
}

function openProductModal(product = null) {
    editingProductId = product ? product.id : null;
    pendingProductImage = product?.image || "";
    productModalTitle.textContent = product ? "Edit Product" : "Add Product";
    productCodeInput.value = product?.code || "";
    productNameInput.value = product?.name || "";
    productPriceInput.value = product?.price ?? "";
    productStockInput.value = product?.stock ?? "";
    productImageInput.value = "";
    showProductImagePreview(pendingProductImage);
    productModal.classList.remove("hidden");
    productModal.setAttribute("aria-hidden", "false");
    setTimeout(() => productCodeInput.focus(), 0);
}

function closeProductModal() {
    productModal.classList.add("hidden");
    productModal.setAttribute("aria-hidden", "true");
    editingProductId = null;
    pendingProductImage = "";
}

document.getElementById("product-modal-close").addEventListener("click", closeProductModal);
document.getElementById("product-modal-cancel").addEventListener("click", closeProductModal);
productModal.addEventListener("click", event => { if (event.target === productModal) closeProductModal(); });

const removeProductImageButton = document.getElementById("remove-product-image");
if (removeProductImageButton) {
    removeProductImageButton.addEventListener("click", () => {
        pendingProductImage = "";
        productImageInput.value = "";
        showProductImagePreview("");
    });
}

productImageInput.addEventListener("change", () => {
    const file = productImageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Please choose an image file.");
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const max = 700;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            pendingProductImage = canvas.toDataURL("image/jpeg", 0.82);
            showProductImagePreview(pendingProductImage);
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById("product-form").addEventListener("submit", event => {
    event.preventDefault();
    const code = productCodeInput.value.trim();
    const name = productNameInput.value.trim();
    const price = Number(productPriceInput.value);
    const stock = Number(productStockInput.value);
    if (!code || !name || !Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
        return toast("Please enter valid product details.");
    }
    if (products.some(p => p.code.toLowerCase() === code.toLowerCase() && p.id !== editingProductId)) {
        return toast("Product code already exists.");
    }
    if (editingProductId != null) {
        const p = products.find(x => x.id === editingProductId);
        if (!p) return closeProductModal();
        p.code = code; p.name = name; p.price = price; p.stock = stock; p.image = pendingProductImage;
        toast("Product updated.");
    } else {
        products.push({ id: Date.now(), code, name, price, stock, image: pendingProductImage });
        toast("Product added.");
    }
    saveData();
    refreshProductCards(foodSearch.value);
    renderProducts();
    renderStock();
    closeProductModal();
});

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (p) openProductModal(p);
}

function deleteProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Delete ${p.name}?`)) return;
    products = products.filter(x => x.id !== id);
    if (selectedProductId === id) selectedProductId = null;
    saveData();
    refreshProductCards(foodSearch.value);
    renderProducts();
    renderStock();
    toast("Product deleted.");
}

document.getElementById("add-product").addEventListener("click", () => openProductModal());

function renderStock() {
    document.getElementById("stock-list").innerHTML = products.map(p => `
        <tr><td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.name)}</td><td>${p.stock}</td>
        <td>${p.stock > 0 ? "Available" : "Out of Stock"}</td></tr>`).join("");
}

document.getElementById("history-search").addEventListener("input", renderHistory);
["kitchen-refresh","status-refresh","history-refresh","stock-refresh"].forEach(id => {
    document.getElementById(id).addEventListener("click", () => {
        const page = id.split("-")[0];
        renderPage(page);
    });
});

function formatDate(value) {
    const d = new Date(value);
    return d.toISOString().slice(0, 19).replace("T", " ");
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
}

let toastTimer;
function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

renderCurrentOrder();
renderProducts();
renderStock();
