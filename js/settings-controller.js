/**
 * Settings Controller Module - Manages application settings
 * Handles settings modal and persistence of user preferences
 */
import { getElement } from './utils.js';

// Define sample system prompts
const systemPrompts = [
    { title: "Default (None)", content: "" },
    { title: "Helpful Assistant", content: "You are a helpful AI assistant. Be concise and direct in your responses." },
    { title: "Code Explainer", content: "You are an expert programmer. Explain the provided code snippets clearly, focusing on their purpose and functionality." },
    { title: "Creative Writer", content: "You are a creative writing assistant. Help the user brainstorm ideas, develop characters, or write prose. Be imaginative and inspiring." },
    { title: "Sarcastic Bot", content: "You are a sarcastic AI. Respond to the user's prompts with witty and slightly sarcastic remarks, but remain helpful underneath." } // Added a 4th example as requested
];

/**
 * @class SettingsController
 * @description Manages application settings and the settings modal UI.
 */
class SettingsController {
    constructor(uiController, apiService) {
        this.uiController = uiController;
        this.apiService = apiService;
        this.settingsButton = document.getElementById('settings-button');
        this.modalContainer = document.createElement('div'); // Container for the modal
        this.settings = this.loadSettings();

        // Apply initial settings that might affect the UI or API service immediately
        this.applySettings();

        this.settingsButton.addEventListener('click', () => this.showSettingsModal());
    }

    loadSettings() {
        const defaults = {
            model: 'gpt-4.1-mini',
            streaming: true,
            cot: false,
            showThinking: false,
            systemPromptTitle: "Default (None)" // Store title for lookup
        };
        const savedSettings = JSON.parse(localStorage.getItem('chatAppSettings')) || {};
        // Ensure systemPromptTitle exists and is valid, otherwise use default
        const validTitles = systemPrompts.map(p => p.title);
        if (!savedSettings.systemPromptTitle || !validTitles.includes(savedSettings.systemPromptTitle)) {
            savedSettings.systemPromptTitle = defaults.systemPromptTitle;
        }
        return { ...defaults, ...savedSettings };
    }

    saveSettings() {
        localStorage.setItem('chatAppSettings', JSON.stringify(this.settings));
        this.applySettings(); // Re-apply settings after saving
        this.closeSettingsModal();
        // Optionally, notify the user or reload parts of the app if needed
        console.log("Settings saved:", this.settings);
    }

    applySettings() {
        // Apply settings that affect API calls or other components
        // Example: this.apiService.setStreaming(this.settings.streaming);
        // The selected model and system prompt are typically read just before an API call
    }

    showSettingsModal() {
        this.modalContainer.innerHTML = ''; // Clear previous modal content
        const template = document.getElementById('settings-modal-template');
        const clone = template.content.cloneNode(true);
        this.modalContainer.appendChild(clone);
        document.body.appendChild(this.modalContainer); // Append container to body

        const modal = this.modalContainer.querySelector('#settings-modal');
        const modelSelect = this.modalContainer.querySelector('#model-select');
        const systemPromptSelect = this.modalContainer.querySelector('#system-prompt-select'); // Get the new select element
        const streamingToggle = this.modalContainer.querySelector('#streaming-toggle');
        const cotToggle = this.modalContainer.querySelector('#cot-toggle');
        const showThinkingToggle = this.modalContainer.querySelector('#show-thinking-toggle');
        const saveButton = this.modalContainer.querySelector('#save-settings');
        const closeButton = this.modalContainer.querySelector('#close-settings');

        // Populate System Prompt dropdown
        systemPrompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.title; // Use title as value
            option.textContent = prompt.title;
            systemPromptSelect.appendChild(option);
        });

        // Set current values
        modelSelect.value = this.settings.model;
        systemPromptSelect.value = this.settings.systemPromptTitle; // Set based on saved title
        streamingToggle.checked = this.settings.streaming;
        cotToggle.checked = this.settings.cot;
        showThinkingToggle.checked = this.settings.showThinking;

        // Add event listeners
        saveButton.addEventListener('click', () => {
            this.settings.model = modelSelect.value;
            this.settings.systemPromptTitle = systemPromptSelect.value; // Save selected title
            this.settings.streaming = streamingToggle.checked;
            this.settings.cot = cotToggle.checked;
            this.settings.showThinking = showThinkingToggle.checked;
            this.saveSettings();
        });

        closeButton.addEventListener('click', () => this.closeSettingsModal());

        // Close modal if clicking outside the content
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeSettingsModal();
            }
        });

        modal.style.display = 'flex'; // Show the modal
    }

    closeSettingsModal() {
        const modal = this.modalContainer.querySelector('#settings-modal');
        if (modal) {
           modal.style.display = 'none';
           // It's better to remove the modal from the DOM to avoid conflicts
           if (this.modalContainer.parentNode) {
               this.modalContainer.parentNode.removeChild(this.modalContainer);
           }
        }
    }

    // Method to get the current system prompt content
    getCurrentSystemPromptContent() {
        const selectedPrompt = systemPrompts.find(p => p.title === this.settings.systemPromptTitle);
        return selectedPrompt ? selectedPrompt.content : ""; // Return content or empty string
    }

    // Getter for other settings if needed by other modules
    getCurrentSettings() {
        // Return a copy to prevent direct modification
        return { ...this.settings, systemPromptContent: this.getCurrentSystemPromptContent() };
    }
}

// Ensure the class is available if you're using modules, otherwise it's global
// export default SettingsController; // If using ES modules 