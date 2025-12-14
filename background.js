/**
 * TimeCurrency - Background Script
 * Copyright (c) 2025 Souvenirs Parlants (YukomiFPS)
 * License: GPLv3
 */

// 1. Créer le menu au moment de l'installation (Texte traduit)
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "tc-convert",
        title: chrome.i18n.getMessage("ctxMenu"), // Titre traduit
        contexts: ["selection"]
    });
});

// 2. Écouter le clic sur le menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "tc-convert" && info.selectionText) {
        processSelection(info.selectionText, tab.id);
    }
});

function processSelection(text, tabId) {
    // Nettoyage du prix
    let cleanText = text.replace(/[^0-9.,]/g, '');
    if (cleanText.includes(',') && !cleanText.includes('.')) cleanText = cleanText.replace(',', '.');
    const amount = parseFloat(cleanText);

    if (!amount || isNaN(amount)) {
        sendMessage(tabId, chrome.i18n.getMessage("alertErrorPrice"));
        return;
    }

    // Récupérer les données
    chrome.storage.sync.get(['hourlyWage', 'taxRate', 'userCurrency'], (prefs) => {
        chrome.storage.local.get(['cachedRates'], (ratesData) => {
            
            const wage = parseFloat(prefs.hourlyWage);
            if (!wage) {
                sendMessage(tabId, chrome.i18n.getMessage("alertErrorConfig"));
                return;
            }

            const tax = parseFloat(prefs.taxRate) || 0;
            const targetCurrency = prefs.userCurrency || 'USD';
            const rates = ratesData.cachedRates || { USD: 1, CAD: 1, EUR: 1, GBP: 1 };

            // Détection devise
            let sourceCurrency = 'USD';
            if (text.includes('€') || text.includes('EUR')) sourceCurrency = 'EUR';
            else if (text.includes('£') || text.includes('GBP')) sourceCurrency = 'GBP';
            else if (text.includes('CAD') || text.includes('C$')) sourceCurrency = 'CAD';

            // Calculs
            const rateSource = rates[sourceCurrency] || 1;
            const rateTarget = rates[targetCurrency] || 1;
            const convertedAmount = (amount / rateSource) * rateTarget;
            const finalPrice = convertedAmount * (1 + (tax / 100));
            const hours = (finalPrice / wage).toFixed(2);

            // Construction du message traduit
            // On récupère le modèle et on remplace les #BALISES#
            let msg = chrome.i18n.getMessage("alertResult");
            msg = msg.replace('#AMOUNT#', amount)
                     .replace('#CURRENCY#', sourceCurrency)
                     .replace('#HOURS#', hours)
                     .replace('#TAX#', tax);

            sendMessage(tabId, msg);
        });
    });
}

// Fonction pour afficher une alerte
function sendMessage(tabId, msg) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (m) => alert(m),
        args: [msg]
    });
}