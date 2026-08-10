let items = [];

const API_URL = "http://localhost:5001";
const currentUser = JSON.parse(localStorage.getItem("user") || "null");

if (!currentUser) {
    window.location.href = "login.html";
}

const container = document.querySelector(".item-containers");
const reported = document.getElementById("reported");
const statusItem = document.getElementById("statusItem");
const searchInput = document.getElementById("searchInput");
const matchModal = document.getElementById("matchModal");
const mapModal = document.getElementById("mapModal");
const mapFrame = document.getElementById("mapFrame");
const mapHeading = document.getElementById("mapHeading");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");

function escapeText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function updateStats() {
    document.getElementById("totalCount").innerText = items.length;
    document.getElementById("lostCount").innerText =
        items.filter(item => item.status.toLowerCase() === "lost").length;
    document.getElementById("foundCount").innerText =
        items.filter(item => item.status.toLowerCase() === "found").length;
    document.getElementById("claimedCount").innerText =
        items.filter(item => item.status.toLowerCase() === "claimed").length;
}

function displayItems(list = items) {
    updateStats();

    if (!container) {
        return;
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty">
                <h3>No items to display</h3>
                <p>Try adding an item or changing the filters.</p>
                <button onclick="goToAddPage()" class="add-btn">Add New Item</button>
            </div>
        `;
        return;
    }

    container.innerHTML = "";

    list.forEach(item => {
        const card = document.createElement("div");
        card.classList.add("item-card");

        const status = String(item.status || "").toLowerCase();
        const itemName = escapeText(item.itemName);
        const location = escapeText(item.location);
        const encodedLocation = encodeURIComponent(item.location || "");
        const encodedItemName = encodeURIComponent(item.itemName || "");

        card.innerHTML = `
            ${item.image ? `<img src="${item.image}" class="item-img" alt="${itemName}">` : ""}
            <h3>${itemName}</h3>
            <p><strong>Category:</strong> ${escapeText(item.category)}</p>
            <p><strong>Location:</strong> ${location}</p>
            ${item.dateReported ? `<p><strong>Date:</strong> ${escapeText(formatDate(item.dateReported))}</p>` : ""}
            ${item.reportedBy ? `<p><strong>Reported by:</strong> ${escapeText(item.reportedBy)}</p>` : ""}
            <p><strong>Description:</strong> ${escapeText(item.description)}</p>
            <p><strong>Contact:</strong> ${escapeText(item.contact)}</p>
            <p><strong>Status:</strong> <span class="status ${status}">${escapeText(item.status)}</span></p>
            <div class="btns">
                <button onclick="deleteItem(${item.id})">Delete</button>
                <button onclick="editItem(${item.id})">Edit</button>
                ${status === "lost" ? `<button class="mark-btn" onclick="markFound(${item.id})">Mark as Found</button>` : ""}
                ${status === "found" ? `<button class="claim-btn" onclick="claimItem(${item.id})">Claimed by Owner</button>` : ""}
                ${status === "lost" ? `<button class="match-btn" onclick="findMatches(${item.id})">Find Matches</button>` : ""}
                <button class="map-btn" onclick="showMap('${encodedLocation}', '${encodedItemName}')">View on Map</button>
            </div>
        `;

        container.appendChild(card);
        requestAnimationFrame(() => card.classList.add("show"));
    });
}

async function fetchItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        items = await response.json();
        items.sort((a, b) => Number(b.id) - Number(a.id));
        applyFilters();
    } catch (err) {
        console.error(err);
        if (container) {
            container.innerHTML = `
                <div class="empty">
                    <h3>Unable to load items</h3>
                    <p>Please start the backend server and refresh this page.</p>
                </div>
            `;
        }
    }
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

async function findMatches(id) {
    try {
        const response = await fetch(`${API_URL}/matches/${id}`);
        if (!response.ok) {
            throw new Error("Unable to fetch matches");
        }

        const data = await response.json();
        const matches = data.strongMatches || [];
        const allFoundItems = data.allFoundItems || [];
        const results = document.getElementById("matchResults");

        if (matches.length === 0) {
            results.innerHTML = `
                <div class="no-match-box">
                    <h2>No Strong Match Found</h2>
                    <p>We searched the available found items. You can still browse the other reported found items below.</p>
                    <h3>Other Reported Found Items</h3>
                </div>
            `;

            if (allFoundItems.length > 0) {
                allFoundItems.forEach(item => {
                    results.innerHTML += createMatchCard(item, false);
                });
            } else {
                results.innerHTML += `<p class="muted-text">No found items are currently available.</p>`;
            }
        } else {
            results.innerHTML = `<h2 class="modal-section-title">Smart Match Results</h2>`;
            matches.forEach((item, index) => {
                results.innerHTML += createMatchCard(item, index === 0);
            });
        }

        matchModal.style.display = "flex";
    } catch (err) {
        console.error(err);
        showToast("Unable to fetch matches");
    }
}

function createMatchCard(item, isBestMatch) {
    const score = Number(item.score || 0);
    const confidence =
        score >= 80 ? "Excellent Match" :
        score >= 60 ? "Good Match" :
        score > 0 ? "Low Match" :
        "Possible Match";

    return `
        <div class="match-card ${isBestMatch ? "best-match" : ""}">
            ${isBestMatch ? `<div class="best-badge">BEST MATCH</div>` : ""}
            <div class="match-body">
                <div class="match-left">
                    ${item.image
                        ? `<img src="${item.image}" class="match-image" alt="${escapeText(item.itemName)}">`
                        : `<div class="no-image">No Image</div>`}
                </div>
                <div class="match-right">
                    <h2>${escapeText(item.itemName)}</h2>
                    <p><strong>Category:</strong> ${escapeText(item.category)}</p>
                    <p><strong>Location:</strong> ${escapeText(item.location)}</p>
                    ${score > 0 ? `
                        <div class="progress">
                            <div class="progress-fill" style="width:${score}%">${score}%</div>
                        </div>
                        <p class="confidence">${confidence}</p>
                        <p><strong>Matching Keywords:</strong><br>
                            ${(item.matchedWords || []).length ? item.matchedWords.map(escapeText).join(", ") : "No common keywords"}
                        </p>
                    ` : ""}
                </div>
            </div>
        </div>
    `;
}

function goToAddPage() {
    window.location.href = "lost.html";
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.opacity = "1";
    setTimeout(() => {
        toast.style.opacity = "0";
    }, 2200);
}

function updateStatus(id, status) {
    fetch(`${API_URL}/updateStatus/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    })
        .then(() => {
            showToast(`Item marked as ${status}`);
            fetchItems();
        })
        .catch(err => console.error(err));
}

function markFound(id) {
    updateStatus(id, "found");
}

function claimItem(id) {
    updateStatus(id, "claimed");
}

function filterStatus(status, btn) {
    document.querySelectorAll(".filter-container button").forEach(button => {
        button.classList.remove("active");
    });

    if (btn) {
        btn.classList.add("active");
    }

    statusItem.value = status;
    applyFilters();
}

function deleteItem(id) {
    if (!confirm("Delete this item?")) {
        return;
    }

    fetch(`${API_URL}/deleteItem/${id}`, { method: "DELETE" })
        .then(() => {
            showToast("Item deleted");
            fetchItems();
        })
        .catch(err => console.error(err));
}

function editItem(id) {
    const item = items.find(current => current.id === id);
    if (!item) {
        showToast("Item not found");
        return;
    }

    document.getElementById("editId").value = item.id;
    document.getElementById("editItemName").value = item.itemName || "";
    document.getElementById("editCategory").value = item.category || "Other";
    document.getElementById("editDescription").value = item.description || "";
    document.getElementById("editLocation").value = item.location || "";
    document.getElementById("editContact").value = item.contact || "";
    editModal.style.display = "flex";
}

function applyFilters() {
    const reportedValue = reported.value;
    const statusValue = statusItem.value;
    const searchValue = searchInput.value.trim().toLowerCase();

    const filtered = items.filter(item => {
        const searchableText = [
            item.itemName,
            item.category,
            item.location,
            item.description,
            item.contact,
            item.status
        ].join(" ").toLowerCase();

        return (
            (reportedValue === "all" || item.category.toLowerCase() === reportedValue.toLowerCase()) &&
            (statusValue === "all" || item.status.toLowerCase() === statusValue.toLowerCase()) &&
            searchableText.includes(searchValue)
        );
    });

    displayItems(filtered);
}

function rippleEffect(event) {
    const button = event.currentTarget || event.target;
    const rect = button.getBoundingClientRect();
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - diameter / 2}px`;
    circle.style.top = `${event.clientY - rect.top - diameter / 2}px`;
    circle.classList.add("ripple");

    const oldRipple = button.querySelector(".ripple");
    if (oldRipple) oldRipple.remove();

    button.appendChild(circle);
}

function showMap(encodedLocation, encodedItemName) {
    const location = decodeURIComponent(encodedLocation || "");
    const itemName = decodeURIComponent(encodedItemName || "");
    const place = `${location}, Nitte Meenakshi Institute of Technology, Bengaluru`;
    mapHeading.innerText = itemName ? `${itemName} Location` : "Item Location";
    mapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
    mapModal.style.display = "flex";
}

function closeMap() {
    mapModal.style.display = "none";
    mapFrame.src = "";
}

function closeEdit() {
    editModal.style.display = "none";
    editForm.reset();
}

document.getElementById("closeMatch").addEventListener("click", function () {
    matchModal.style.display = "none";
});

document.getElementById("closeMap").addEventListener("click", closeMap);
document.getElementById("closeEdit").addEventListener("click", closeEdit);
document.getElementById("cancelEdit").addEventListener("click", closeEdit);

editForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const id = document.getElementById("editId").value;
    const itemName = document.getElementById("editItemName").value.trim();
    const category = document.getElementById("editCategory").value;
    const description = document.getElementById("editDescription").value.trim();
    const location = document.getElementById("editLocation").value.trim();
    const contact = document.getElementById("editContact").value.trim();

    if (!itemName || !category || !description || !location || !contact) {
        showToast("Please fill all edit details");
        return;
    }

    fetch(`${API_URL}/editItem/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName, category, description, location, contact })
    })
        .then(() => {
            closeEdit();
            showToast("Item updated");
            fetchItems();
        })
        .catch(err => {
            console.error(err);
            showToast("Edit failed");
        });
});

window.addEventListener("click", function (event) {
    if (event.target === matchModal) {
        matchModal.style.display = "none";
    }

    if (event.target === mapModal) {
        closeMap();
    }

    if (event.target === editModal) {
        closeEdit();
    }
});

reported.addEventListener("change", applyFilters);
statusItem.addEventListener("change", applyFilters);
searchInput.addEventListener("input", applyFilters);

fetchItems();
