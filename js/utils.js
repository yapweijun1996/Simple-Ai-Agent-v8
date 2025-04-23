/**
 * Utilities Module - Contains encryption/decryption and helper functions
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Decrypts text using XOR cipher
 * @param {string} ciphertext - The encrypted text
 * @param {string} key - The decryption key
 * @returns {string} - Decrypted text
 */
export function decrypt(ciphertext, key) {
    let decoded = "";
    for (let i = 0; i < ciphertext.length; i += 3) {
        let numStr = ciphertext.slice(i, i + 3);
        let encryptedChar = parseInt(numStr);
        let keyChar = key.charCodeAt((i / 3) % key.length);
        let decryptedChar = encryptedChar ^ keyChar;
        decoded += String.fromCharCode(decryptedChar);
    }
    return decoder.decode(new Uint8Array(encoder.encode(decoded)));
}

/**
 * Encrypts text using XOR cipher (for cookie storage)
 * @param {string} text - The text to encrypt
 * @param {string} key - The encryption key
 * @returns {string} - Encrypted text
 */
export function encrypt(text, key) {
    let encoded = "";
    const textBytes = encoder.encode(text);
    
    for (let i = 0; i < textBytes.length; i++) {
        const charCode = textBytes[i];
        const keyChar = key.charCodeAt(i % key.length);
        const encryptedChar = charCode ^ keyChar;
        // Pad to ensure 3 digits for each character
        encoded += encryptedChar.toString().padStart(3, '0');
    }
    
    return encoded;
}

/**
 * Alias for the decrypt function (to maintain compatibility with imports)
 */
export const decryptApiKey = decrypt;

/**
 * Alias for the encrypt function (to maintain compatibility with imports)
 */
export const encryptApiKey = encrypt;

/**
 * Handles Server-Sent Events (SSE) parsing from stream responses
 * @param {string} line - The SSE line to parse
 * @returns {Object|null} - Parsed data or null if not parseable
 */
export function parseSSELine(line) {
    if (!line.startsWith('data: ')) return null;
    
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') return { done: true };
    
    try {
        return { data: JSON.parse(dataStr) };
    } catch (err) {
        console.error('Stream parsing error', err);
        return null;
    }
}

/**
 * Creates an element from a template
 * @param {string} templateId - The ID of the template element
 * @returns {Element} - The cloned template content
 */
export function createFromTemplate(templateId) {
    const template = document.getElementById(templateId);
    if (!template) {
        console.error(`Template not found: ${templateId}`);
        return null;
    }
    return template.content.cloneNode(true).firstElementChild;
}

/**
 * Updates the token usage display
 * @param {number} totalTokens - The total tokens used
 */
export function updateTokenDisplay(totalTokens) {
    const tokenDisplay = document.getElementById('token-usage');
    if (tokenDisplay) {
        tokenDisplay.textContent = `Total tokens used: ${totalTokens}`;
    }
}

/**
 * Sets a cookie with the given name, value, and expiration days
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {number} days - Days until expiration
 */
export function setCookie(name, value, days = 30) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    
    const cookieValue = encodeURIComponent(value) + 
        (days ? `; expires=${expirationDate.toUTCString()}` : '') + 
        '; path=/; SameSite=Strict';
    
    document.cookie = `${name}=${cookieValue}`;
}

/**
 * Gets a cookie by name
 * @param {string} name - Cookie name
 * @returns {string|null} - Cookie value or null if not found
 */
export function getCookie(name) {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    
    return null;
}

/**
 * Deletes a cookie by name
 * @param {string} name - Cookie name
 */
export function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

/**
 * Saves the password to a cookie (securely)
 * @param {string} password - The password to save
 */
export function savePasswordToCookie(password) {
    // Create a simple encryption for the password
    // Using a fixed salt + current domain as encryption key
    const encryptionKey = 'AI-Chat-App-' + window.location.hostname;
    const encryptedPassword = encrypt(password, encryptionKey);
    setCookie('chat_pwd', encryptedPassword);
}

/**
 * Gets the saved password from cookie
 * @returns {string|null} - The decrypted password or null if not found
 */
export function getPasswordFromCookie() {
    const encryptedPassword = getCookie('chat_pwd');
    if (!encryptedPassword) return null;
    
    try {
        const encryptionKey = 'AI-Chat-App-' + window.location.hostname;
        return decrypt(encryptedPassword, encryptionKey);
    } catch (err) {
        console.error('Error decrypting password from cookie:', err);
        deleteCookie('chat_pwd');
        return null;
    }
}

/**
 * Clears the saved password from cookie
 */
export function clearSavedPassword() {
    deleteCookie('chat_pwd');
}

/**
 * Saves settings to a cookie
 * @param {Object} settings - The settings object to save
 */
export function saveSettingsToCookie(settings) {
    setCookie('chat_settings', JSON.stringify(settings));
}

/**
 * Gets saved settings from cookie
 * @returns {Object|null} - The settings object or null if not found
 */
export function getSettingsFromCookie() {
    const settingsStr = getCookie('chat_settings');
    if (!settingsStr) return null;
    
    try {
        return JSON.parse(settingsStr);
    } catch (err) {
        console.error('Error parsing settings from cookie:', err);
        deleteCookie('chat_settings');
        return null;
    }
}

// Helper function for DOM element selection
export function getElement(selector, parent = document) {
    return parent.querySelector(selector);
}

// Helper function to show an element
export function showElement(element) {
    if (element) element.style.display = '';
}

// Helper function to hide an element
export function hideElement(element) {
    if (element) element.style.display = 'none';
} 