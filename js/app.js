/**
 * Main Application Module - Entry point for the application
 * Coordinates initialization of all other modules
 */
import ApiService from './api-service.js';
import ChatController from './chat-controller.js';
import SettingsController from './settings-controller.js';
import UiController from './ui-controller.js';
import { getElement, showElement, hideElement } from './utils.js';

const App = (function() {
    'use strict';
    
    // Private state
    let loginModal = null;

    /**
     * Initializes the application
     */
    function init() {
        // Initialize UI controller
        UIController.init();
        
        // Load saved settings from cookie
        const savedSettings = Utils.getSettingsFromCookie() || {};
        
        // Initialize settings controller with saved settings
        SettingsController.init();
        
        // Initialize chat controller with settings
        ChatController.init(savedSettings);
        
        // Show main container (will be visible but login modal on top)
        document.getElementById('chat-container').style.display = 'flex';
        
        // Check for saved password
        checkPasswordOrPrompt();
    }

    /**
     * Checks for a saved password or prompts the user
     */
    function checkPasswordOrPrompt() {
        const savedPassword = Utils.getPasswordFromCookie();
        
        if (savedPassword) {
            doLogin(savedPassword);
        } else {
            showLoginModal();
        }
    }
    
    /**
     * Creates and shows the login modal
     */
    function showLoginModal() {
        if (!loginModal) {
            // Create login modal from template
            loginModal = Utils.createFromTemplate('login-modal-template');
            document.body.appendChild(loginModal);
            
            // Setup event listeners
            document.getElementById('login-button').addEventListener('click', handleLogin);
            document.getElementById('api-password').addEventListener('keydown', function(event) {
                if (event.key === 'Enter') {
                    handleLogin();
                }
            });
            
            // Focus the password input
            setTimeout(() => {
                document.getElementById('api-password').focus();
            }, 100);
        }
        
        loginModal.style.display = 'flex';
        document.getElementById('login-error').style.display = 'none';
    }
    
    /**
     * Handles login form submission
     */
    function handleLogin() {
        const passwordInput = document.getElementById('api-password');
        const rememberCheckbox = document.getElementById('remember-password');
        const password = passwordInput.value.trim();
        
        if (!password) {
            document.getElementById('login-error').textContent = 'Password is required.';
            document.getElementById('login-error').style.display = 'block';
            return;
        }
        
        const success = ApiService.init(password);
        
        if (success) {
            // Store remember password setting
            const settings = ChatController.getSettings();
            settings.rememberPassword = rememberCheckbox.checked;
            ChatController.updateSettings(settings);
            
            // Save password if remember is checked
            if (rememberCheckbox.checked) {
                Utils.savePasswordToCookie(password);
            }
            
            // Hide the login modal
            loginModal.style.display = 'none';
        } else {
            // Show error message
            document.getElementById('login-error').textContent = 'Invalid password. Please try again.';
            document.getElementById('login-error').style.display = 'block';
            Utils.clearSavedPassword();
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
    
    /**
     * Attempts to login with the provided password
     * @param {string} password - The API key password
     */
    function doLogin(password) {
        const success = ApiService.init(password);
        
        if (!success) {
            Utils.clearSavedPassword();
            showLoginModal();
        }
    }
    
    /**
     * Logs the user out by clearing saved credentials
     */
    function logOut() {
        Utils.clearSavedPassword();
        location.reload();
    }

    // Initialize the app when the DOM is ready
    window.addEventListener('DOMContentLoaded', init);
    
    // Public API
    return {
        init,
        logOut
    };
})();

// The app will auto-initialize when the DOM is loaded 

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate necessary components
    const uiController = new UIController();
    const apiService = new ApiService(uiController); // Pass uiController if needed for error display or callbacks
    const settingsController = new SettingsController(uiController, apiService); // Instantiate SettingsController
    const chatController = new ChatController(uiController, apiService, settingsController); // Pass all three

    // Initialize the application (e.g., check for API key, show login if needed)
    initializeApp(uiController, apiService, chatController, settingsController);
});

async function initializeApp(uiController, apiService, chatController, settingsController) {
    console.log("Initializing App...");
    uiController.init(); // Basic UI setup if any

    try {
        // Check if API key needs password or is directly available
        const needsPassword = await apiService.isPasswordRequired();

        if (needsPassword) {
            console.log("Password required for API key.");
            // Show login modal and wait for successful login
            const loginSuccess = await uiController.showLoginModal(async (password, remember) => {
                try {
                    await apiService.setApiKeyPassword(password, remember);
                    console.log("Password accepted, API key decrypted.");
                    return true; // Indicate success
                } catch (error) {
                    console.error("Login failed:", error);
                    uiController.showLoginError(error.message || "Invalid password.");
                    return false; // Indicate failure
                }
            });

            if (!loginSuccess) {
                console.log("Login process aborted or failed.");
                // Handle login failure (e.g., show error message, prevent app usage)
                uiController.displayError("API Key access failed. Please refresh and try again.", false); // Non-dismissible error
                return; // Stop initialization
            }
            // If login was successful, modal is hidden by showLoginModal upon success
        } else {
            console.log("API key available or password remembered.");
            // Password not required or already remembered, proceed.
        }

        // API key is ready, show the main chat interface
        uiController.showChatInterface();
        console.log("Chat interface shown.");

        // Initialize controllers that depend on the main UI being visible
        // ChatController's event listeners are already set up in its constructor
        // SettingsController's event listeners are also set up

        console.log("App Initialized Successfully.");

    } catch (error) {
        console.error("Initialization failed:", error);
        uiController.displayError(`Initialization failed: ${error.message}. Please check console and refresh.`, false);
    }
}


// Utility function to check if running in Electron
function isElectron() {
    return typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
}

// Utility function to check if running as a Chrome Extension
function isChromeExtension() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

// Add any other shared initialization logic here 