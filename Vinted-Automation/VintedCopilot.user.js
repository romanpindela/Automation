// ==UserScript==
// @name         Vinted Copilot - Smart Listing Assistant
// @namespace    https://github.com/romanpindela
// @version      1.0.0
// @description  Automates listing products on Vinted: auto-fills titles, descriptions, prices, categories, and handles photo folder workflows.
// @author       Roman Pindela (roman.pindela@gmail.com)
// @match        https://www.vinted.pl/items/new*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    let catalog = [];
    let selectedItem = null;
    const API_URL = 'http://127.0.0.1:8080';

    // Inject styles
    GM_addStyle(`
        #vinted-copilot-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 380px;
            max-height: 85vh;
            background: #18202f;
            color: #f1f5f9;
            border: 2px solid #09b1ba;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        #vinted-copilot-header {
            background: #09b1ba;
            color: #ffffff;
            padding: 10px 14px;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        #vinted-copilot-content {
            padding: 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .vc-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #94a3b8;
            margin-bottom: 3px;
        }
        .vc-select, .vc-input {
            width: 100%;
            background: #0f172a;
            border: 1px solid #334155;
            color: #ffffff;
            padding: 8px;
            border-radius: 6px;
            font-size: 13px;
            box-sizing: border-box;
        }
        .vc-item-details {
            background: #0f172a;
            border-radius: 8px;
            padding: 10px;
            border: 1px solid #334155;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .vc-badge-row {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }
        .vc-badge {
            background: #334155;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 11px;
            color: #e2e8f0;
        }
        .vc-btn {
            cursor: pointer;
            border: none;
            border-radius: 6px;
            padding: 9px 12px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: background 0.2s, transform 0.1s;
        }
        .vc-btn:active { transform: scale(0.98); }
        .vc-btn-primary { background: #09b1ba; color: white; }
        .vc-btn-primary:hover { background: #078e95; }
        .vc-btn-secondary { background: #3b82f6; color: white; }
        .vc-btn-secondary:hover { background: #2563eb; }
        .vc-btn-success { background: #10b981; color: white; }
        .vc-btn-success:hover { background: #059669; }
        .vc-btn-muted { background: #334155; color: #cbd5e1; }
        .vc-status {
            font-size: 11px;
            text-align: center;
            color: #94a3b8;
            margin-top: 4px;
        }
        .vc-minimized #vinted-copilot-content { display: none; }
    `);

    // Create Copilot DOM
    const panel = document.createElement('div');
    panel.id = 'vinted-copilot-panel';
    panel.innerHTML = `
        <div id="vinted-copilot-header">
            <span>🛍️ Vinted Copilot</span>
            <span id="vc-toggle" style="font-size:16px;">−</span>
        </div>
        <div id="vinted-copilot-content">
            <div>
                <div class="vc-label">Wybierz przedmiot ze sprzedaży</div>
                <select id="vc-item-select" class="vc-select">
                    <option value="">Wczytywanie bazy...</option>
                </select>
            </div>

            <div id="vc-details" class="vc-item-details" style="display:none;">
                <div id="vc-title" style="font-weight:600; color:#38bdf8;"></div>
                <div class="vc-badge-row">
                    <span id="vc-brand" class="vc-badge">🏷️ Marka</span>
                    <span id="vc-size" class="vc-badge">📏 Rozmiar</span>
                    <span id="vc-pkg" class="vc-badge">📦 Paczka</span>
                    <span id="vc-photos" class="vc-badge">📷 0 zdjęć</span>
                </div>
                <div style="font-size: 15px; font-weight:700; color:#4ade80;">
                    Cena: <span id="vc-price">0</span> PLN
                </div>
            </div>

            <button id="vc-btn-open-folder" class="vc-btn vc-btn-secondary" style="display:none;">
                📂 Otwórz folder ze zdjęciami
            </button>

            <button id="vc-btn-fill" class="vc-btn vc-btn-primary" style="display:none;">
                ⚡ 1-Click: Wypełnij dane na Vinted
            </button>

            <button id="vc-btn-mark-listed" class="vc-btn vc-btn-success" style="display:none;">
                ✅ Oznacz jako wystawione (archiwizuj)
            </button>

            <div id="vc-status-msg" class="vc-status">Łączenie z lokalnym serwerem...</div>
        </div>
    `;
    document.body.appendChild(panel);

    // Toggle minimize
    const toggleBtn = panel.querySelector('#vc-toggle');
    const header = panel.querySelector('#vinted-copilot-header');
    header.addEventListener('click', () => {
        panel.classList.toggle('vc-minimized');
        toggleBtn.innerText = panel.classList.contains('vc-minimized') ? '+' : '−';
    });

    // Elements
    const itemSelect = panel.querySelector('#vc-item-select');
    const detailsBox = panel.querySelector('#vc-details');
    const btnOpenFolder = panel.querySelector('#vc-btn-open-folder');
    const btnFill = panel.querySelector('#vc-btn-fill');
    const btnMarkListed = panel.querySelector('#vc-btn-mark-listed');
    const statusMsg = panel.querySelector('#vc-status-msg');

    // Fetch catalog from local server or allow manual file selection
    function fetchCatalog() {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_URL}/api/catalog`,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            catalog = JSON.parse(response.responseText);
                            populateDropdown();
                            statusMsg.innerText = `Połączono! Wczytano ${catalog.length} przedmiotów.`;
                        } catch (e) {
                            statusMsg.innerText = 'Błąd parsowania odpowiedzi serwera.';
                        }
                    } else {
                        handleServerError();
                    }
                },
                onerror: function() {
                    handleServerError();
                }
            });
        } else {
            fetch(`${API_URL}/api/catalog`)
                .then(r => r.json())
                .then(data => {
                    catalog = data;
                    populateDropdown();
                    statusMsg.innerText = `Wczytano ${catalog.length} przedmiotów.`;
                })
                .catch(() => handleServerError());
        }
    }

    function handleServerError() {
        statusMsg.innerHTML = `⚠️ Serwer lokalny offline.<br>Uruchom: <b>Start-VintedCopilotServer.ps1</b>`;
    }

    function populateDropdown() {
        itemSelect.innerHTML = '<option value="">-- Wybierz przedmiot --</option>';
        catalog.filter(i => i.status !== 'listed').forEach((item, index) => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.innerText = `${index + 1}. [${item.price} zł] ${item.folder_name}`;
            itemSelect.appendChild(opt);
        });
    }

    itemSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        selectedItem = catalog.find(i => i.id === id);
        if (selectedItem) {
            panel.querySelector('#vc-title').innerText = selectedItem.title;
            panel.querySelector('#vc-brand').innerText = `🏷️ ${selectedItem.brand || 'Brak'}`;
            panel.querySelector('#vc-size').innerText = `📏 ${selectedItem.size || 'Inny'}`;
            panel.querySelector('#vc-pkg').innerText = `📦 ${selectedItem.package_size || 'Średnia'}`;
            panel.querySelector('#vc-photos').innerText = `📷 ${selectedItem.photo_count || 0} zdjęć`;
            panel.querySelector('#vc-price').innerText = selectedItem.price;

            detailsBox.style.display = 'flex';
            btnOpenFolder.style.display = 'flex';
            btnFill.style.display = 'flex';
            btnMarkListed.style.display = 'flex';
            statusMsg.innerText = `Wybrano: ${selectedItem.folder_name}`;
        } else {
            detailsBox.style.display = 'none';
            btnOpenFolder.style.display = 'none';
            btnFill.style.display = 'none';
            btnMarkListed.style.display = 'none';
        }
    });

    // 1-Click Open Folder in Explorer
    btnOpenFolder.addEventListener('click', () => {
        if (!selectedItem) return;
        statusMsg.innerText = 'Otwieram folder w Eksploratorze...';
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_URL}/api/open-folder`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ id: selectedItem.id }),
            onload: () => {
                statusMsg.innerText = 'Folder otwarty! Przeciągnij zdjęcia do pola Vinted.';
            }
        });
    });

    // Helper: simulate React native input setter
    function setReactValue(input, value) {
        if (!input) return;
        const lastValue = input.value;
        input.value = value;
        const event = new Event('input', { bubbles: true });
        // React 16+ tracker
        const tracker = input._valueTracker;
        if (tracker) {
            tracker.setValue(lastValue);
        }
        input.dispatchEvent(event);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // 1-Click Form Fill
    btnFill.addEventListener('click', () => {
        if (!selectedItem) return;

        let fieldsSet = 0;

        // 1. Tytuł
        const titleInput = document.querySelector('input[name="title"], input[id*="title"], input[data-testid*="title"]');
        if (titleInput) {
            setReactValue(titleInput, selectedItem.title);
            fieldsSet++;
        }

        // 2. Opis
        const descTextarea = document.querySelector('textarea[name="description"], textarea[id*="description"], textarea[data-testid*="description"]');
        if (descTextarea) {
            setReactValue(descTextarea, selectedItem.description);
            fieldsSet++;
        }

        // 3. Cena
        const priceInput = document.querySelector('input[name="price"], input[id*="price"], input[data-testid*="price"]');
        if (priceInput) {
            setReactValue(priceInput, String(selectedItem.price));
            fieldsSet++;
        }

        // 4. Stan (Condition matching)
        if (selectedItem.condition) {
            const conditionButtons = Array.from(document.querySelectorAll('button, label, div[role="radio"]'));
            const matchingCondition = conditionButtons.find(b => b.innerText && b.innerText.toLowerCase().includes(selectedItem.condition.toLowerCase()));
            if (matchingCondition) {
                matchingCondition.click();
            }
        }

        // Copy brand / size to clipboard for ultra fast selection
        const clipboardNote = `Marka: ${selectedItem.brand} | Rozmiar: ${selectedItem.size}`;
        navigator.clipboard.writeText(clipboardNote).catch(() => {});

        statusMsg.innerHTML = `✅ Wypełniono pola (${fieldsSet})!<br>Skopiowano do schowka: <b>${clipboardNote}</b>`;
    });

    // 1-Click Mark Listed
    btnMarkListed.addEventListener('click', () => {
        if (!selectedItem) return;
        if (!confirm(`Czy przenieść '${selectedItem.folder_name}' do katalogu _Wystawione?`)) return;

        statusMsg.innerText = 'Przenoszenie do _Wystawione...';
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_URL}/api/mark-listed`,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ id: selectedItem.id }),
            onload: (res) => {
                statusMsg.innerText = 'Przeniesiono pomyślnie!';
                fetchCatalog();
            }
        });
    });

    // Initial load
    fetchCatalog();

})();
