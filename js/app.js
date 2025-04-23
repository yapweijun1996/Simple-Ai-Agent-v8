/**
 * Main Application Module - Entry point for the application
 * Coordinates initialization of all other modules
 */
import ApiService from './api-service.js';
import ChatController from './chat-controller.js';
import SettingsController from './settings-controller.js';
import UiController from './ui-controller.js';
import { 
    getElement, 
    showElement, 
    hideElement, 
    createFromTemplate, 
    getSettingsFromCookie, 
    getPasswordFromCookie, 
    savePasswordToCookie, 
    clearSavedPassword 
} from './utils.js';

/**
 * Main application class
 */
class App {
    constructor() {
        // Initialize controllers
        this.uiController = new UiController();
        this.settingsController = new SettingsController();
        this.apiService = new ApiService({ 
            settingsController: this.settingsController, 
            uiController: this.uiController 
        });
        this.chatController = new ChatController(
            this.apiService, 
            this.uiController, 
            this.settingsController
        );
        
        // Private state
        this.loginModal = null;
        
        // Bind initialization to DOM ready event
        window.addEventListener('DOMContentLoaded', this.init.bind(this));
    }
    
    /**
     * Initializes the application
     */
    init() {
        // Initialize UI controller
        this.uiController.init();
        
        // Load saved settings
        const savedSettings = getSettingsFromCookie() || {};
        
        // Initialize settings controller with callback
        this.settingsController.init(() => {
            // This callback is called when settings are saved
            console.log('Settings saved callback triggered');
            // Notify chat controller of settings change if needed
            if (this.chatController.handleSettingsChange) {
                this.chatController.handleSettingsChange();
            }
        });
        
        // Initialize chat controller with settings
        this.chatController.init(savedSettings);
        
        // Show main container (will be visible but login modal on top)
        const chatContainer = getElement('#chat-container');
        if (chatContainer) showElement(chatContainer);
        
        // Check for saved password
        this.checkPasswordOrPrompt();
    }

    /**
     * Checks for a saved password or prompts the user
     */
    checkPasswordOrPrompt() {
        const savedPassword = getPasswordFromCookie();
        
        if (savedPassword) {
            this.doLogin(savedPassword);
        } else {
            this.showLoginModal();
        }
    }
    
    /**
     * Creates and shows the login modal
     */
    showLoginModal() {
        if (!this.loginModal) {
            // Create login modal from template
            this.loginModal = createFromTemplate('login-modal-template');
            document.body.appendChild(this.loginModal);
            
            // Setup event listeners
            const loginButton = getElement('#login-button', this.loginModal);
            const passwordInput = getElement('#api-password', this.loginModal);
            
            if (loginButton) {
                loginButton.addEventListener('click', this.handleLogin.bind(this));
            }
            
            if (passwordInput) {
                passwordInput.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        this.handleLogin();
                    }
                });
                
                // Focus the password input
                setTimeout(() => {
                    passwordInput.focus();
                }, 100);
            }
        }
        
        showElement(this.loginModal);
        const loginError = getElement('#login-error', this.loginModal);
        if (loginError) hideElement(loginError);
    }
    
    /**
     * Handles login form submission
     */
    handleLogin() {
        const passwordInput = getElement('#api-password', this.loginModal);
        const rememberCheckbox = getElement('#remember-password', this.loginModal);
        const loginError = getElement('#login-error', this.loginModal);
        
        if (!passwordInput || !rememberCheckbox || !loginError) {
            console.error('Login form elements not found');
            return;
        }
        
        const password = passwordInput.value.trim();
        
        if (!password) {
            loginError.textContent = 'Password is required.';
            showElement(loginError);
            return;
        }
        
        this.apiService.attemptLoadKey(password)
            .then(success => {
                if (success) {
                    // Store remember password setting if needed
                    if (this.chatController.getSettings && this.chatController.updateSettings) {
                        const settings = this.chatController.getSettings();
                        settings.rememberPassword = rememberCheckbox.checked;
                        this.chatController.updateSettings(settings);
                    }
                    
                    // Save password if remember is checked
                    if (rememberCheckbox.checked) {
                        savePasswordToCookie(password);
                    }
                    
                    // Hide the login modal
                    hideElement(this.loginModal);
                    
                    // Initialize the main app components
                    this.initAfterLogin();
                } else {
                    // Show error message
                    loginError.textContent = 'Invalid password. Please try again.';
                    showElement(loginError);
                    clearSavedPassword();
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            })
            .catch(err => {
                console.error('Login error:', err);
                loginError.textContent = `Error: ${err.message || 'Unknown error'}`;
                showElement(loginError);
            });
    }
    
    /**
     * Attempts to login with the provided password
     * @param {string} password - The API key password
     */
    doLogin(password) {
        this.apiService.attemptLoadKey(password)
            .then(success => {
                if (success) {
                    this.initAfterLogin();
                } else {
                    clearSavedPassword();
                    this.showLoginModal();
                }
            })
            .catch(err => {
                console.error('Auto-login error:', err);
                clearSavedPassword();
                this.showLoginModal();
            });
    }
    
    /**
     * Initialize components after successful login
     */
    initAfterLogin() {
        // Show the chat UI
        const chatContainer = getElement('#chat-container');
        if (chatContainer) showElement(chatContainer);
        
        // Additional initialization after login if needed
        console.log('Login successful, application ready');
    }
    
    /**
     * Logs the user out by clearing saved credentials
     */
    logOut() {
        clearSavedPassword();
        location.reload();
    }
}

// Initialize the application
const app = new App();

// Export for potential external references
export default app; 