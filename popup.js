/**
 * TimeCurrency Extension - Version Finale V1
 * Copyright (c) 2025 Souvenirs Parlants (YukomiFPS)
 * License: GPLv3
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. GESTION DU THÈME ---
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-theme');
            themeToggle.textContent = '☾';
        } else {
            body.classList.remove('dark-theme');
            themeToggle.textContent = '☀︎';
        }
    }

    chrome.storage.sync.get(['userTheme'], function(result) {
        applyTheme(result.userTheme || 'light');
    });

    themeToggle.addEventListener('click', function() {
        let newTheme = body.classList.contains('dark-theme') ? 'light' : 'dark';
        applyTheme(newTheme);
        chrome.storage.sync.set({ userTheme: newTheme });
    });

    // --- 2. TRADUCTION ---
    function localizeHtml() {
        document.querySelectorAll('[data-i18n]').forEach(elem => {
            const key = elem.getAttribute('data-i18n');
            const msg = chrome.i18n.getMessage(key);
            if (msg) elem.textContent = msg;
        });
    }
    localizeHtml();

    // --- 3. VARIABLES UI ---
    var wageInput = document.getElementById('wageInput');
    var wagePeriod = document.getElementById('wagePeriod');
    var currencySelect = document.getElementById('currencySelect');
    var taxInput = document.getElementById('taxInput');
    var budgetInput = document.getElementById('budgetInput');
    var saveBtn = document.getElementById('saveBtn');
    var status = document.getElementById('status');
    var coffeeLink = document.getElementById('coffeeLink');
    
    // Nouveaux éléments Liste Noire
    var currentSiteLabel = document.getElementById('currentSite');
    var toggleSiteBtn = document.getElementById('toggleSiteBtn');

    // --- 4. CALCUL SALAIRE INTELLIGENT ---
    function calculateHourlyRate(amount, period) {
        amount = parseFloat(amount);
        if (!amount || isNaN(amount)) return 0;
        switch (period) {
            case 'year': return (amount / 52 / 40).toFixed(2);
            case 'month': return (amount / 4.33 / 40).toFixed(2);
            case 'week': return (amount / 40).toFixed(2);
            default: return amount;
        }
    }

    // --- 5. CHARGEMENT DONNÉES ---
    chrome.storage.sync.get(['hourlyWage', 'displayWage', 'displayPeriod', 'taxRate', 'monthlyBudget', 'userCurrency', 'disabledSites'], function(result) {
        if (result.displayWage) wageInput.value = result.displayWage;
        else if (result.hourlyWage) wageInput.value = result.hourlyWage;
        
        if (result.displayPeriod) wagePeriod.value = result.displayPeriod;
        if (result.taxRate) taxInput.value = result.taxRate;
        if (result.monthlyBudget) budgetInput.value = result.monthlyBudget;
        if (result.userCurrency) currencySelect.value = result.userCurrency;

        // --- GESTION LISTE NOIRE ---
        let disabledSites = result.disabledSites || [];
        
        // On récupère l'URL de l'onglet actif
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) return;
            
            try {
                const url = new URL(tabs[0].url);
                const hostname = url.hostname; // ex: www.amazon.fr
                currentSiteLabel.textContent = hostname;

                updateSiteButton(hostname, disabledSites);

                // Clic sur le bouton Activer/Désactiver
                toggleSiteBtn.onclick = function() {
                    if (disabledSites.includes(hostname)) {
                        // On le retire (Activer)
                        disabledSites = disabledSites.filter(site => site !== hostname);
                    } else {
                        // On l'ajoute (Désactiver)
                        disabledSites.push(hostname);
                    }

                    // Sauvegarde et mise à jour
                    chrome.storage.sync.set({ disabledSites: disabledSites }, function() {
                        updateSiteButton(hostname, disabledSites);
                        // On recharge la page pour appliquer l'effet
                        chrome.tabs.reload(tabs[0].id);
                    });
                };
            } catch (e) {
                currentSiteLabel.textContent = "Page locale / Système";
                toggleSiteBtn.style.display = 'none';
            }
        });
    });

    function updateSiteButton(hostname, list) {
        if (list.includes(hostname)) {
            // Site est désactivé -> Bouton pour ACTIVER
            toggleSiteBtn.textContent = chrome.i18n.getMessage("btnEnable");
            toggleSiteBtn.style.borderColor = "#4caf50"; // Vert
            toggleSiteBtn.style.color = "#4caf50";
        } else {
            // Site est actif -> Bouton pour DÉSACTIVER
            toggleSiteBtn.textContent = chrome.i18n.getMessage("btnDisable");
            toggleSiteBtn.style.borderColor = "#f44336"; // Rouge
            toggleSiteBtn.style.color = "#f44336";
        }
    }
  
    // --- 6. SAUVEGARDE PRINCIPALE ---
    saveBtn.addEventListener('click', function() {
      var rawWage = wageInput.value;
      var period = wagePeriod.value;
      var finalHourlyWage = calculateHourlyRate(rawWage, period);
      
      if (finalHourlyWage > 0) {
        chrome.storage.sync.set({
            hourlyWage: finalHourlyWage,
            displayWage: rawWage,
            displayPeriod: period,
            taxRate: taxInput.value || 0,
            monthlyBudget: budgetInput.value || 0,
            userCurrency: currencySelect.value || 'USD'
        }, function() {
            let msg = chrome.i18n.getMessage("msgSaved") || "Sauvegardé !";
            if (period !== 'hour') msg = `Sauvegardé ! (~${finalHourlyWage}/h)`;
            
            status.textContent = msg;
            status.style.color = '#cfb16a';
            setTimeout(function() { status.textContent = ''; }, 3000);
        });
      }
    });

    if (coffeeLink) {
        coffeeLink.addEventListener('click', function() {
            chrome.tabs.create({ url: 'https://www.paypal.com/ncp/payment/GGXUMTLMZV962' }); 
        });
    }
});