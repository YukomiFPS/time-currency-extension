/**
 * TimeCurrency Extension
 * Copyright (c) 2025 Souvenirs Parlants (YukomiFPS)
 * License: GPLv3
 */

// --- CONFIGURATION V3 PRO ---
const BADGE_CLASS = 'tc-badge-ultimate';
const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

let savedWage = null;
let savedTax = 0;
let savedBudget = 0;
let userCurrency = 'USD';
let exchangeRates = null;

// --- INITIALISATION ---
chrome.storage.sync.get(['hourlyWage', 'taxRate', 'monthlyBudget', 'userCurrency'], function(data) {
    savedWage = parseFloat(data.hourlyWage);
    savedTax = parseFloat(data.taxRate) || 0;
    savedBudget = parseFloat(data.monthlyBudget) || 0;
    userCurrency = data.userCurrency || 'USD';

    if (savedWage && !isNaN(savedWage)) {
        initializeExchangeRates().then(() => {
            injectStyles();
            runScanner();
            const observer = new MutationObserver((mutations) => runScanner());
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
});

// --- API ---
async function initializeExchangeRates() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['cachedRates', 'ratesTimestamp'], async function(data) {
            const now = new Date().getTime();
            const oneDay = 24 * 60 * 60 * 1000;

            if (data.cachedRates && data.ratesTimestamp && (now - data.ratesTimestamp < oneDay)) {
                exchangeRates = data.cachedRates;
                resolve();
            } else {
                try {
                    const response = await fetch(API_URL);
                    const jsonData = await response.json();
                    exchangeRates = jsonData.rates;
                    chrome.storage.local.set({ cachedRates: exchangeRates, ratesTimestamp: now });
                    resolve();
                } catch (error) {
                    exchangeRates = { USD: 1, CAD: 1, EUR: 1, GBP: 1 };
                    resolve();
                }
            }
        });
    });
}

// --- VISUEL & CALCUL ---
function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .${BADGE_CLASS} {
            display: inline-block; background-color: #2b2b2b; color: #fff; font-size: 0.8em; font-weight: bold;
            padding: 2px 6px; margin-left: 6px; border-radius: 4px; vertical-align: middle;
            font-family: sans-serif; z-index: 9999; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        .${BADGE_CLASS}.danger { background-color: #d32f2f; border: 1px solid #b71c1c; }
    `;
    document.head.appendChild(style);
}

function parsePrice(priceString) {
    let clean = priceString.replace(/[^0-9.,]/g, '');
    if (clean.includes(',') && !clean.includes('.')) clean = clean.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
}

function convertToUserCurrency(amount, foundCurrencySymbol) {
    if (!exchangeRates) return amount;
    let detectedCode = 'USD';
    if (foundCurrencySymbol.includes('€') || foundCurrencySymbol.includes('EUR')) detectedCode = 'EUR';
    else if (foundCurrencySymbol.includes('£') || foundCurrencySymbol.includes('GBP')) detectedCode = 'GBP';
    else if (foundCurrencySymbol.includes('CAD') || foundCurrencySymbol.includes('C$')) detectedCode = 'CAD';

    if (detectedCode === userCurrency) return amount;

    const rateDetected = exchangeRates[detectedCode] || 1;
    const rateUser = exchangeRates[userCurrency] || 1;
    return (amount / rateDetected) * rateUser;
}

function calculateHours(price, currencySymbol) {
    const convertedPrice = convertToUserCurrency(price, currencySymbol);
    const priceWithTax = convertedPrice * (1 + (savedTax / 100));
    return (priceWithTax / savedWage).toFixed(1);
}

function createBadge(hours) {
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    
    // TRADUCTION
    const hLabel = chrome.i18n.getMessage("badgeTime") || "h";
    
    let icon = savedTax > 0 ? '⏱+' : '⏱';
    let text = `${icon} ${hours}${hLabel}`;
    
    // Traduction Tooltip Taxes (CORRIGÉ AVEC #)
    let tooltipMsg = chrome.i18n.getMessage("badgeTaxTooltip") || "Includes taxes";
    tooltipMsg = tooltipMsg.replace('#TAX#', savedTax); // On remplace #TAX#
    
    let tooltip = savedTax > 0 ? tooltipMsg : "Work time";

    if (savedBudget > 0) {
        const percent = ((hours / savedBudget) * 100).toFixed(0);
        text += ` (${percent}%)`;
        
        // Traduction Tooltip Budget (CORRIGÉ AVEC #)
        let budgetMsg = chrome.i18n.getMessage("badgeBudgetTooltip") || "Budget usage";
        budgetMsg = budgetMsg.replace('#PERCENT#', percent); // On remplace #PERCENT#
        tooltip += `\n${budgetMsg}`;

        if (percent > 10) badge.classList.add('danger');
    }

    badge.textContent = text;
    badge.title = tooltip;
    return badge;
}

function runScanner() {
    if (!savedWage || !exchangeRates) return;

    // Amazon
    const amazonPrices = document.querySelectorAll('.a-price:not(.tc-processed)');
    amazonPrices.forEach(priceContainer => {
        const hiddenPrice = priceContainer.querySelector('.a-offscreen');
        if (hiddenPrice) {
            const priceText = hiddenPrice.textContent;
            const amount = parsePrice(priceText);
            const symbolSpan = priceContainer.querySelector('.a-price-symbol');
            const symbol = symbolSpan ? symbolSpan.textContent : '$';

            if (amount && amount > 0) {
                const hours = calculateHours(amount, symbol);
                if (hours >= 0.1) {
                    priceContainer.classList.add('tc-processed');
                    priceContainer.appendChild(createBadge(hours));
                }
            }
        }
    });

    // General
    const currencyRegex = /((?:\$|CAD|USD|€|£|C\$))\s?([0-9]+(?:[.,][0-9]{2})?)|([0-9]+(?:[.,][0-9]{2})?)\s?((?:\$|€|£|USD|CAD))/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const parent = node.parentElement;
        const text = node.nodeValue.trim();
        if (!parent.classList.contains('tc-processed') && !parent.classList.contains(BADGE_CLASS) && ['SPAN', 'DIV', 'P', 'STRONG', 'B', 'TD'].includes(parent.tagName) && text.length < 20 && text.length > 1) {
            const match = text.match(currencyRegex);
            if (match) {
                const symbol = match[1] || match[4];
                const amount = parsePrice(text);
                if (amount && amount > 0 && symbol) {
                    const hours = calculateHours(amount, symbol);
                    if (hours >= 0.1) {
                        parent.classList.add('tc-processed');
                        parent.appendChild(createBadge(hours));
                    }
                }
            }
        }
    }
}