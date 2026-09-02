const defaultProducts = [
    { id: 1, code: "B011", name: "Buriyani", price: 500, stock: 65 },
    { id: 2, code: "B010", name: "Rice and Curry", price: 270, stock: 24 },
    { id: 3, code: "B012", name: "Vegan Rice", price: 300, stock: 65 }
];

let products = JSON.parse(localStorage.getItem("demoPOS_products") || "null") || defaultProducts;
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
const foodSelect = document.getElementById("food-select");

function refreshFoodSelect(filter = "") {
    const q = filter.trim().toLowerCase();
    const matches = products.filter(p =>
        !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    );
    foodSelect.innerHTML = "";
    matches.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.code} - ${p.name} (Rs. ${p.price.toFixed(2)}) [Stock: ${p.stock}]`;
        foodSelect.appendChild(option);
    });
}
foodSearch.addEventListener("input", () => refreshFoodSelect(foodSearch.value));
refreshFoodSelect();

document.getElementById("add-food").addEventListener("click", () => {
    const id = Number(foodSelect.value);
    const qty = Math.max(1, Number(document.getElementById("food-quantity").value) || 1);
    const product = products.find(p => p.id === id);
    if (!product) return toast("Select a product first.");
    if (qty > product.stock) return toast("Not enough stock.");
    const existing = currentOrder.find(i => i.productId === id);
    if (existing) existing.quantity += qty;
    else currentOrder.push({
        productId: product.id, code: product.code, name: product.name,
        price: product.price, quantity: qty
    });
    renderCurrentOrder();
});

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
    refreshFoodSelect();
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
            <td>${i + 1}</td><td>${escapeHtml(p.code)}</td><td>${escapeHtml(p.name)}</td>
            <td>Rs. ${p.price.toFixed(2)}</td><td>${p.stock}</td>
            <td>
                <button class="action-link" onclick="editProduct(${p.id})">Edit</button>
                <button class="action-link" onclick="deleteProduct(${p.id})">Delete</button>
            </td>
        </tr>`).join("");
}

document.getElementById("product-search").addEventListener("input", renderProducts);

function editProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    const name = prompt("Product name:", p.name);
    if (name === null) return;
    const price = Number(prompt("Price:", p.price));
    const stock = Number(prompt("Stock:", p.stock));
    if (!name.trim() || !Number.isFinite(price) || !Number.isFinite(stock)) return toast("Invalid product data.");
    p.name = name.trim(); p.price = price; p.stock = stock;
    saveData(); refreshFoodSelect(foodSearch.value); renderProducts(); renderStock();
}

function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    products = products.filter(p => p.id !== id);
    saveData(); refreshFoodSelect(foodSearch.value); renderProducts(); renderStock();
}

document.getElementById("add-product").addEventListener("click", () => {
    const code = prompt("Product code:");
    if (!code) return;
    const name = prompt("Product name:");
    if (!name) return;
    const price = Number(prompt("Price:"));
    const stock = Number(prompt("Stock:"));
    if (!Number.isFinite(price) || !Number.isFinite(stock)) return toast("Invalid product data.");
    products.push({ id: Date.now(), code: code.trim(), name: name.trim(), price, stock });
    saveData(); refreshFoodSelect(foodSearch.value); renderProducts(); renderStock(); toast("Product added.");
});

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
