/**
 * Settings Controller Module - Manages application settings
 * Handles settings modal and persistence of user preferences
 */
import { getElement } from './utils.js';

// Define default system prompts
const defaultSystemPrompts = [
    { 
        title: "AI Software Engineer", 
        content: "You are an expert software engineer specializing in JavaScript, HTML, CSS, and Node.js. Provide practical, efficient, and well-documented code solutions. Include clear explanations of your approach and any design patterns used. When providing code examples, focus on readability and best practices." 
    },
    { 
        title: "Scientific Researcher", 
        content: "You are a scientific researcher with expertise across multiple disciplines. Provide evidence-based responses with references where appropriate. Approach questions methodically, considering multiple perspectives and acknowledging limitations in current understanding. Present complex information clearly without oversimplification." 
    },
    { 
        title: "Creative Storyteller", 
        content: "You are a creative storyteller with a flair for engaging narratives. When prompted, craft imaginative stories with well-developed characters and vivid descriptions. Adapt your style to the requested genre, whether fantasy, sci-fi, mystery, or drama. Focus on immersive world-building and emotional depth." 
    }
];

/**
 * @class SettingsController
 * @description Manages application settings and the settings modal UI.
 */
class SettingsController {
    // Private state
    _settingsModal = null;
    _settings = {
        streaming: true,
        enableCoT: false,
        showThinking: true,
        selectedModel: 'gpt-4.1-mini' // Default model
    };
    _systemPromptSelect = null;
    _selectedSystemPromptTitle = '';

    /**
     * Initializes the SettingsController.
     * @param {Function} onSettingsSaved - Callback function when settings are saved.
     */
    init(onSettingsSaved) {
        if (this._settingsModal) return;
        
        // Create modal from template
        this._settingsModal = Utils.createFromTemplate('settings-modal-template');
        document.body.appendChild(this._settingsModal);
        
        // Set initial values based on current settings
        document.getElementById('streaming-toggle').checked = this._settings.streaming;
        document.getElementById('cot-toggle').checked = this._settings.enableCoT;
        document.getElementById('show-thinking-toggle').checked = this._settings.showThinking;
        document.getElementById('model-select').value = this._settings.selectedModel;
        
        // Add event listeners
        document.getElementById('save-settings').addEventListener('click', this._saveSettings.bind(this));
        document.getElementById('close-settings').addEventListener('click', this.hideSettingsModal.bind(this));
        
        // Close when clicking outside the modal content
        this._settingsModal.addEventListener('click', function(event) {
            if (event.target === this._settingsModal) {
                this.hideSettingsModal();
            }
        }.bind(this));

        this._systemPromptSelect = getElement('#system-prompt-select'); // Get the new select element

        // Populate system prompt dropdown
        this._populateSystemPrompts();

        this._loadSettings();
    }

    /**
     * Shows the settings modal
     */
    showSettingsModal() {
        if (!this._settingsModal) {
            this.init();
        }
        
        // Ensure current settings are reflected when opening
        this._settingsModal.style.display = 'flex';
        document.getElementById('streaming-toggle').checked = this._settings.streaming;
        document.getElementById('cot-toggle').checked = this._settings.enableCoT;
        document.getElementById('show-thinking-toggle').checked = this._settings.showThinking;
        document.getElementById('model-select').value = this._settings.selectedModel;
    }

    /**
     * Hides the settings modal
     */
    hideSettingsModal() {
        if (this._settingsModal) {
            this._settingsModal.style.display = 'none';
        }
    }

    /**
     * Saves settings from the modal
     */
    _saveSettings() {
        const streamingEnabled = document.getElementById('streaming-toggle').checked;
        const cotEnabled = document.getElementById('cot-toggle').checked;
        const showThinkingEnabled = document.getElementById('show-thinking-toggle').checked;
        const selectedModelValue = document.getElementById('model-select').value;
        const selectedSystemPrompt = document.getElementById('system-prompt-select').value;
        
        this._settings = {
            ...this._settings,
            streaming: streamingEnabled,
            enableCoT: cotEnabled,
            showThinking: showThinkingEnabled,
            selectedModel: selectedModelValue
        };
        
        // Save the selected system prompt title
        this._selectedSystemPromptTitle = selectedSystemPrompt;
        
        // Update the chat controller settings
        ChatController.updateSettings(this._settings);
        
        // Save settings to localStorage
        localStorage.setItem('selectedModel', selectedModelValue);
        localStorage.setItem('useStreaming', streamingEnabled.toString());
        localStorage.setItem('enableCot', cotEnabled.toString());
        localStorage.setItem('showThinking', showThinkingEnabled.toString());
        localStorage.setItem('selectedSystemPromptTitle', this._selectedSystemPromptTitle); 
        
        // Hide modal
        this.hideSettingsModal();

        if (onSettingsSaved) {
            onSettingsSaved();
        }
        console.log('Settings saved:', {
            model: selectedModelValue,
            streaming: streamingEnabled,
            cot: cotEnabled,
            showThinking: showThinkingEnabled,
            systemPrompt: this._selectedSystemPromptTitle,
        });
    }

    /**
     * Populates the system prompt select dropdown.
     * @private
     */
    _populateSystemPrompts() {
        if (!this._systemPromptSelect) return;

        defaultSystemPrompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.title;
            option.textContent = prompt.title;
            this._systemPromptSelect.appendChild(option);
        });
    }

    /**
     * Loads settings from localStorage and updates the UI.
     * @private
     */
    _loadSettings() {
        const savedModel = localStorage.getItem('selectedModel') || 'gpt-4.1-mini';
        const useStreaming = localStorage.getItem('useStreaming') === 'true';
        const enableCot = localStorage.getItem('enableCot') === 'true';
        const showThinking = localStorage.getItem('showThinking') === 'true';
        const savedPromptTitle = localStorage.getItem('selectedSystemPromptTitle') || '';

        document.getElementById('model-select').value = savedModel;
        document.getElementById('streaming-toggle').checked = useStreaming;
        document.getElementById('cot-toggle').checked = enableCot;
        document.getElementById('show-thinking-toggle').checked = showThinking;
        
        if (this._systemPromptSelect) {
            this._systemPromptSelect.value = savedPromptTitle;
        }

        this._settings = {
            streaming: useStreaming,
            enableCoT: enableCot,
            showThinking: showThinking,
            selectedModel: savedModel
        };
        
        this._selectedSystemPromptTitle = savedPromptTitle;
    }

    /**
     * Get current settings
     * @returns {Object} - The current settings
     */
    getSettings() {
        return { ...this._settings };
    }

    /**
     * Gets the content of the currently selected system prompt.
     * @returns {string | null} The content of the selected system prompt, or null if 'Default (None)' is selected.
     */
    getSelectedSystemPromptContent() {
        if (!this._selectedSystemPromptTitle) {
            return null; // Return null if 'Default (None)' is selected
        }
        const selectedPrompt = defaultSystemPrompts.find(p => p.title === this._selectedSystemPromptTitle);
        return selectedPrompt ? selectedPrompt.content : null;
    }
}

export default SettingsController; 